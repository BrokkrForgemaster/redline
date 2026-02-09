const WP_API_URL =
  process.env.WORDPRESS_API_URL ||
  "https://redlinelandscapingky.com/wp-json/wp/v2";

/* ──────────────────────────────────────────────
   Types
   ────────────────────────────────────────────── */

export interface WPReview {
  name: string;
  location: string;
  text: string;
  service: string;
}

export interface WPPost {
  title: string;
  slug: string;
  date: string;
  excerpt: string;
  content: string;
  featuredImage: string | null;
}

/* ──────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────── */

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

async function getCategoryId(slug: string): Promise<number | null> {
  try {
    const res = await fetch(`${WP_API_URL}/categories?slug=${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const cats = await res.json();
    return cats[0]?.id ?? null;
  } catch {
    return null;
  }
}

/* ──────────────────────────────────────────────
   Reviews
   ──────────────────────────────────────────────
   WordPress setup:
   1. Create a category called "Reviews"
   2. Add a post for each review:
      - Title  = Reviewer name (e.g. "Ava B.")
      - Content = The review text
      - Excerpt = "Richmond, KY | Lawn Mowing"
                  (location | service, separated by pipe)
      - Category = Reviews
   ────────────────────────────────────────────── */

export async function getReviews(): Promise<WPReview[]> {
  try {
    const catId = await getCategoryId("reviews");
    if (!catId) return [];

    const res = await fetch(
      `${WP_API_URL}/posts?categories=${catId}&per_page=50&orderby=date&order=desc`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];

    const posts = await res.json();
    return posts.map((post: Record<string, unknown>) => {
      const excerpt = stripHtml(
        (post.excerpt as { rendered?: string })?.rendered || ""
      );
      const parts = excerpt.split("|").map((s: string) => s.trim());

      return {
        name: stripHtml(
          (post.title as { rendered?: string })?.rendered || ""
        ),
        location: parts[0] || "Central Kentucky",
        text: stripHtml(
          (post.content as { rendered?: string })?.rendered || ""
        ),
        service: parts[1] || "Lawn Care",
      };
    });
  } catch {
    return [];
  }
}

/* ──────────────────────────────────────────────
   Blog posts (excludes "reviews" category)
   ────────────────────────────────────────────── */

export async function getBlogPosts(): Promise<WPPost[]> {
  try {
    const reviewsCatId = await getCategoryId("reviews");

    const excludeParam = reviewsCatId
      ? `&categories_exclude=${reviewsCatId}`
      : "";

    const res = await fetch(
      `${WP_API_URL}/posts?per_page=50&_embed${excludeParam}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];

    const posts = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return posts.map((post: any) => ({
      title: stripHtml(post.title?.rendered || ""),
      slug: post.slug,
      date: post.date,
      excerpt: stripHtml(post.excerpt?.rendered || ""),
      content: post.content?.rendered || "",
      featuredImage:
        post._embedded?.["wp:featuredmedia"]?.[0]?.source_url || null,
    }));
  } catch {
    return [];
  }
}

/* ──────────────────────────────────────────────
   Single blog post by slug
   ────────────────────────────────────────────── */

export async function getPostBySlug(slug: string): Promise<WPPost | null> {
  try {
    const res = await fetch(
      `${WP_API_URL}/posts?slug=${encodeURIComponent(slug)}&_embed`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;

    const posts = await res.json();
    if (!posts.length) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const post: any = posts[0];
    return {
      title: stripHtml(post.title?.rendered || ""),
      slug: post.slug,
      date: post.date,
      excerpt: stripHtml(post.excerpt?.rendered || ""),
      content: post.content?.rendered || "",
      featuredImage:
        post._embedded?.["wp:featuredmedia"]?.[0]?.source_url || null,
    };
  } catch {
    return null;
  }
}
