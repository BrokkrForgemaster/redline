import type { Metadata } from "next";
import Gallery, { type GalleryItem } from "@/components/Gallery";
import { getGalleryItems } from "@/lib/wordpress";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Gallery | Redline Landscaping & Snow Removal",
  description:
    "Browse our project gallery — lawn care, landscaping, and snow removal work across Central Kentucky. See the quality for yourself.",
  openGraph: {
    images: [
      {
        url: "/images/mowing1.jpeg",
        width: 1200,
        height: 630,
        alt: "Redline Landscaping project gallery",
      },
    ],
  },
};

const CATEGORY_MAP: Record<string, string> = {
  lawn_mowing: "lawn-care",
  aeration_overseeding: "lawn-care",
  spring_cleanup: "lawn-care",
  landscaping: "landscaping",
  hardscaping: "landscaping",
  irrigation: "landscaping",
  snow_removal: "snow-removal",
  other: "lawn-care",
};

async function getSupabaseGalleryItems(): Promise<GalleryItem[]> {
  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("gallery_projects")
    .select(`
      title, category,
      gallery_images(url, thumbnail_url, alt_text, caption, image_type, sort_order)
    `)
    .eq("status", "published")
    .order("display_order", { ascending: true })
    .limit(60);

  if (!projects || projects.length === 0) return [];

  const items: GalleryItem[] = [];
  for (const project of projects) {
    const cat = CATEGORY_MAP[project.category ?? ""] ?? "lawn-care";
    const imgs = Array.isArray(project.gallery_images) ? project.gallery_images : [];
    const sorted = [...imgs].sort(
      (a, b) => ((a as { sort_order?: number }).sort_order ?? 0) - ((b as { sort_order?: number }).sort_order ?? 0)
    );
    for (const img of sorted) {
      const i = img as { url?: string; thumbnail_url?: string; alt_text?: string; caption?: string };
      if (!i.url) continue;
      items.push({
        src: i.url,
        alt: i.alt_text || i.caption || project.title,
        title: project.title,
        categories: [cat],
      });
    }
  }
  return items;
}

export default async function GalleryPage() {
  const [wpItems, supabaseItems] = await Promise.all([
    getGalleryItems(),
    getSupabaseGalleryItems(),
  ]);

  const items = wpItems.length > 0 ? wpItems : supabaseItems.length > 0 ? supabaseItems : undefined;

  return (
    <>
      {/* Page Header */}
      <section className="bg-offwhite py-16 px-6">
        <div className="max-w-7xl mx-auto text-center animate-fade-in-up">
          <span className="text-sm font-semibold uppercase tracking-widest text-lawn">
            Project Showcase
          </span>
          <h1 className="mt-2 text-4xl md:text-5xl font-bold text-charcoal">
            Our Work
          </h1>
          <p className="mt-4 text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            From striped lawns to snow-cleared lots, here&apos;s a look at what
            we do across Central Kentucky.
          </p>
        </div>
      </section>

      {/* Gallery */}
      <section className="bg-white py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <Gallery items={items} />
        </div>
      </section>
    </>
  );
}
