/**
 * One-time migration: pulls all images from the WordPress gallery and imports
 * them into Supabase (Storage bucket + gallery_projects + gallery_images tables).
 *
 * Run with:
 *   node scripts/migrate-wp-gallery.mjs
 *
 * Requires .env.local to contain:
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// ── Env loading ──────────────────────────────────────────────────────────────

function parseEnvFile(filePath) {
  try {
    const content = readFileSync(filePath, "utf8");
    const env = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

const envFile = parseEnvFile(".env.local");
const SUPABASE_URL =
  envFile.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY =
  envFile.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── Constants ────────────────────────────────────────────────────────────────

const WP_API = "https://cms.redlinelandscapingky.com/wp-json/wp/v2";

// WordPress gallery_category taxonomy slug → Supabase category value
const WP_CATEGORY_MAP = {
  "lawn-care": "lawn_mowing",
  landscaping: "landscaping",
  "snow-removal": "snow_removal",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function stripHtml(html = "") {
  return html.replace(/<[^>]*>/g, "").trim();
}

function slugify(text, index) {
  const base = (text || `photo-${index}`)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
  return `${base}-${index}`;
}

function inferExt(url, contentType) {
  const fromUrl = url.split(".").pop()?.split("?")[0]?.toLowerCase();
  if (fromUrl && ["jpg", "jpeg", "png", "webp", "gif"].includes(fromUrl)) {
    return fromUrl === "jpeg" ? "jpg" : fromUrl;
  }
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("gif")) return "gif";
  return "jpg";
}

// ── WordPress fetch ──────────────────────────────────────────────────────────

async function fetchWpGalleryItems() {
  // Try custom post type 'gallery' first
  let res = await fetch(
    `${WP_API}/gallery?per_page=100&_embed&orderby=date&order=desc`
  );

  if (res.ok) {
    const posts = await res.json();
    if (Array.isArray(posts) && posts.length > 0) {
      console.log(`Found ${posts.length} items via WordPress 'gallery' CPT`);
      return posts;
    }
  }

  // Fallback: posts in 'gallery' category
  const catRes = await fetch(`${WP_API}/categories?slug=gallery`);
  if (catRes.ok) {
    const cats = await catRes.json();
    const catId = cats[0]?.id;
    if (catId) {
      res = await fetch(
        `${WP_API}/posts?categories=${catId}&per_page=100&_embed&orderby=date&order=desc`
      );
      if (res.ok) {
        const posts = await res.json();
        if (Array.isArray(posts)) {
          console.log(
            `Found ${posts.length} items via WordPress 'gallery' category fallback`
          );
          return posts;
        }
      }
    }
  }

  return [];
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Redline Gallery Migration: WordPress → Supabase ===\n");

  const allPosts = await fetchWpGalleryItems();
  const posts = allPosts.filter(
    (p) => p._embedded?.["wp:featuredmedia"]?.[0]?.source_url
  );

  if (posts.length === 0) {
    console.log("No WordPress gallery items with images found. Nothing to migrate.");
    return;
  }

  console.log(`${posts.length} items have images. Starting migration...\n`);

  let success = 0;
  let skipped = 0;

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const media = post._embedded["wp:featuredmedia"][0];
    const imageUrl = media.source_url;
    const altText =
      media.alt_text || stripHtml(post.title?.rendered) || `Photo ${i + 1}`;
    const title = stripHtml(post.title?.rendered) || altText;

    // Determine category from taxonomy terms
    const terms = post._embedded?.["wp:term"]?.flat() ?? [];
    const wpCatSlug = terms.find((t) => WP_CATEGORY_MAP[t.slug])?.slug;
    const category = wpCatSlug ? WP_CATEGORY_MAP[wpCatSlug] : "lawn_mowing";

    const slug = slugify(title, i + 1);

    process.stdout.write(`[${i + 1}/${posts.length}] "${title}" (${category}) ... `);

    // 1. Download image from WordPress
    let imgBuffer, mimeType, ext;
    try {
      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error(`HTTP ${imgRes.status}`);
      imgBuffer = await imgRes.arrayBuffer();
      mimeType = imgRes.headers.get("content-type") ?? "image/jpeg";
      ext = inferExt(imageUrl, mimeType);
    } catch (err) {
      console.log(`SKIP (download failed: ${err.message})`);
      skipped++;
      continue;
    }

    // 2. Create gallery_project row
    const { data: project, error: projErr } = await supabase
      .from("gallery_projects")
      .insert({
        title,
        slug,
        category,
        services_performed: [category],
        status: "published",
        display_order: i,
        publication_date: post.date ?? new Date().toISOString(),
      })
      .select("id")
      .single();

    if (projErr) {
      console.log(`SKIP (DB: ${projErr.message})`);
      skipped++;
      continue;
    }

    // 3. Upload image to Supabase Storage
    const storagePath = `${project.id}/${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("gallery")
      .upload(storagePath, imgBuffer, { contentType: mimeType, upsert: false });

    if (uploadErr) {
      console.log(`SKIP (upload: ${uploadErr.message})`);
      await supabase.from("gallery_projects").delete().eq("id", project.id);
      skipped++;
      continue;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("gallery").getPublicUrl(storagePath);

    // 4. Create gallery_image row
    const { error: imgErr } = await supabase.from("gallery_images").insert({
      project_id: project.id,
      storage_path: storagePath,
      url: publicUrl,
      alt_text: altText,
      image_type: "general",
      sort_order: 0,
    });

    if (imgErr) {
      // Non-fatal — project and file exist, just the DB row is missing
      console.log(`WARN (image record: ${imgErr.message})`);
    } else {
      console.log("OK");
    }

    success++;
  }

  console.log(
    `\n=== Done: ${success} migrated, ${skipped} skipped ===`
  );
  console.log(
    "\nYou can now manage all gallery photos from the backend at /media."
  );
  console.log(
    "The public gallery page already prefers Supabase over WordPress."
  );
}

main().catch((err) => {
  console.error("\nFatal:", err);
  process.exit(1);
});
