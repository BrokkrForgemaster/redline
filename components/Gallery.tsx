"use client";

import { useState, useCallback } from "react";
import Image from "next/image";

/* ──────────────────────────────────────────────
   Gallery data — add new images here
   ────────────────────────────────────────────── */
const galleryItems = [
  // Lawn Care
  {
    src: "/images/mowing.jpeg",
    alt: "Freshly mowed residential lawn with striped pattern",
    title: "Residential Lawn Care",
    category: "lawn-care",
  },
  {
    src: "/images/mowing1.jpeg",
    alt: "Commercial property with professional mowing stripes",
    title: "Commercial Mowing",
    category: "lawn-care",
  },
  {
    src: "/images/mowing2.jpeg",
    alt: "Striped lawn in front of residential brick home",
    title: "Residential Striping",
    category: "lawn-care",
  },
  {
    src: "/images/mowing3.jpeg",
    alt: "Clean mowing stripes on a commercial roadside lot",
    title: "Commercial Roadside Mowing",
    category: "lawn-care",
  },
  {
    src: "/images/mowing4.jpeg",
    alt: "Freshly mowed residential yard with mature trees",
    title: "Neighborhood Lawn Care",
    category: "lawn-care",
  },
  {
    src: "/images/mowing5.jpeg",
    alt: "Commercial lot mowing with clean stripes along the road",
    title: "Commercial Lot Maintenance",
    category: "lawn-care",
  },
  {
    src: "/images/mowing6.jpeg",
    alt: "Large backyard with professional mowing stripes and brick home",
    title: "Large Property Mowing",
    category: "lawn-care",
  },
  {
    src: "/images/burnside.jpeg",
    alt: "Night shot of baseball field mowing at Burnside",
    title: "Athletic Field Maintenance",
    category: "lawn-care",
  },
  {
    src: "/images/burnside1.JPG",
    alt: "Aerial view of baseball field mowing patterns",
    title: "Burnside Ball Field",
    category: "lawn-care",
  },
  {
    src: "/images/aeration.jpeg",
    alt: "Close-up of lawn aeration plugs",
    title: "Core Aeration",
    category: "lawn-care",
  },
  {
    src: "/images/aeration.jpeg",
    alt: "Close-up of soil plugs after core aeration",
    title: "Aeration Results",
    category: "lawn-care",
  },

  // Landscaping
  {
    src: "/images/landscaping.jpeg",
    alt: "Stone steps, patio, and fire pit hardscaping project",
    title: "Hardscaping & Patio",
    category: "landscaping",
  },
  {
    src: "/images/landscaping1.jpeg",
    alt: "Crew clearing overgrown bamboo and brush",
    title: "Brush & Bamboo Clearing",
    category: "landscaping",
  },
  {
    src: "/images/landscaping2.jpeg",
    alt: "Large bamboo and brush removal project in progress",
    title: "Land Clearing",
    category: "landscaping",
  },

  // Snow Removal
  {
    src: "/images/snow.jpeg",
    alt: "Red Chevy trucks equipped with Western snow plows",
    title: "Snow Plow Fleet",
    category: "snow-removal",
  },
  {
    src: "/images/snow2.jpeg",
    alt: "Trucks with SnowEx salt spreaders ready for winter",
    title: "Salt & Ice Management",
    category: "snow-removal",
  },
  {
    src: "/images/snow3.jpeg",
    alt: "Red Chevy truck with Western plow ready for snow removal",
    title: "Plow Truck Ready",
    category: "snow-removal",
  },
];

type Category = "all" | "lawn-care" | "landscaping" | "snow-removal";

const categories: { label: string; value: Category }[] = [
  { label: "All", value: "all" },
  { label: "Lawn Care", value: "lawn-care" },
  { label: "Landscaping", value: "landscaping" },
  { label: "Snow Removal", value: "snow-removal" },
];

export default function Gallery() {
  const [active, setActive] = useState<Category>("all");
  const [lightbox, setLightbox] = useState<number | null>(null);

  const filtered =
    active === "all"
      ? galleryItems
      : galleryItems.filter((item) => item.category === active);

  const openLightbox = useCallback((index: number) => setLightbox(index), []);
  const closeLightbox = useCallback(() => setLightbox(null), []);

  const goPrev = useCallback(() => {
    setLightbox((prev) =>
      prev !== null ? (prev - 1 + filtered.length) % filtered.length : null
    );
  }, [filtered.length]);

  const goNext = useCallback(() => {
    setLightbox((prev) =>
      prev !== null ? (prev + 1) % filtered.length : null
    );
  }, [filtered.length]);

  return (
    <>
      {/* Category Filter Tabs */}
      <div className="flex flex-wrap justify-center gap-3 mb-12">
        {categories.map((cat) => (
          <button
            key={cat.value}
            onClick={() => {
              setActive(cat.value);
              setLightbox(null);
            }}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
              active === cat.value
                ? "bg-lawn text-white shadow-md"
                : "bg-white text-charcoal border border-border hover:border-lawn/40 hover:text-lawn"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Image Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item, i) => (
          <button
            key={item.src}
            onClick={() => openLightbox(i)}
            className="group relative aspect-[4/3] rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02] animate-fade-in-up cursor-pointer"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <Image
              src={item.src}
              alt={item.alt}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />

            {/* Hover caption */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-charcoal/80 to-transparent p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
              <p className="text-white font-semibold text-sm">{item.title}</p>
              <p className="text-gray-300 text-xs capitalize">
                {item.category.replace("-", " ")}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox !== null && filtered[lightbox] && (
        <div
          className="fixed inset-0 z-50 bg-charcoal/90 flex items-center justify-center p-4 animate-fade-in"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors z-10"
            aria-label="Close lightbox"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Prev button */}
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white transition-colors z-10"
            aria-label="Previous image"
          >
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Next button */}
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white transition-colors z-10"
            aria-label="Next image"
          >
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Image */}
          <div
            className="relative w-full max-w-4xl aspect-[4/3] rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={filtered[lightbox].src}
              alt={filtered[lightbox].alt}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>

          {/* Caption */}
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-white font-semibold">{filtered[lightbox].title}</p>
            <p className="text-gray-400 text-sm capitalize">
              {filtered[lightbox].category.replace("-", " ")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
