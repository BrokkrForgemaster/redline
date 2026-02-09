import type { Metadata } from "next";
import Gallery from "@/components/Gallery";
import { getGalleryItems } from "@/lib/wordpress";

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

export default async function GalleryPage() {
  const wpItems = await getGalleryItems();
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
          <Gallery items={wpItems.length > 0 ? wpItems : undefined} />
        </div>
      </section>
    </>
  );
}
