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

export interface WPPage {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  featuredImage: string | null;
}

export interface WPGalleryItem {
  src: string;
  alt: string;
  title: string;
  category: string;
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

/* ──────────────────────────────────────────────
   Single WP page by slug
   ────────────────────────────────────────────── */

export async function getPageBySlug(slug: string): Promise<WPPage | null> {
  try {
    const res = await fetch(
      `${WP_API_URL}/pages?slug=${encodeURIComponent(slug)}&_embed`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return null;

    const pages = await res.json();
    if (!pages.length) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page: any = pages[0];
    return {
      title: stripHtml(page.title?.rendered || ""),
      slug: page.slug,
      content: page.content?.rendered || "",
      excerpt: stripHtml(page.excerpt?.rendered || ""),
      featuredImage:
        page._embedded?.["wp:featuredmedia"]?.[0]?.source_url || null,
    };
  } catch {
    return null;
  }
}

/* ──────────────────────────────────────────────
   Gallery items from "Gallery" category posts
   ──────────────────────────────────────────────
   WordPress setup:
   1. Create a category called "Gallery"
   2. Add a post for each photo:
      - Title = caption (e.g. "Residential Lawn Striping")
      - Featured Image = the photo
      - Category = Gallery
      - Tag = lawn-care, landscaping, or snow-removal
   ────────────────────────────────────────────── */

export async function getGalleryItems(): Promise<WPGalleryItem[]> {
  try {
    const catId = await getCategoryId("gallery");
    if (!catId) return [];

    const res = await fetch(
      `${WP_API_URL}/posts?categories=${catId}&per_page=100&_embed&orderby=date&order=desc`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];

    const posts = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return posts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((post: any) => post._embedded?.["wp:featuredmedia"]?.[0]?.source_url)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((post: any) => {
        const imageUrl =
          post._embedded["wp:featuredmedia"][0].source_url as string;
        const altText =
          post._embedded["wp:featuredmedia"][0].alt_text ||
          stripHtml(post.title?.rendered || "");

        // Use first tag slug as category, default to "lawn-care"
        const tags: { slug: string }[] =
          post._embedded?.["wp:term"]?.[1] || [];
        const category = tags[0]?.slug || "lawn-care";

        return {
          src: imageUrl,
          alt: altText,
          title: stripHtml(post.title?.rendered || ""),
          category,
        };
      });
  } catch {
    return [];
  }
}

/* ──────────────────────────────────────────────
   Service pages — fetch WP pages by known slugs
   ────────────────────────────────────────────── */

const SERVICE_PAGE_SLUGS = [
  "lawn-care",
  "landscaping",
  "snow-services",
  "aeration-overseeding",
];

export async function getServicePages(): Promise<WPPage[]> {
  try {
    const slugParam = SERVICE_PAGE_SLUGS.join(",");
    const res = await fetch(
      `${WP_API_URL}/pages?slug=${slugParam}&per_page=10&_embed`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];

    const pages = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return pages.map((page: any) => ({
      title: stripHtml(page.title?.rendered || ""),
      slug: page.slug,
      content: page.content?.rendered || "",
      excerpt: stripHtml(page.excerpt?.rendered || ""),
      featuredImage:
        page._embedded?.["wp:featuredmedia"]?.[0]?.source_url || null,
    }));
  } catch {
    return [];
  }
}
