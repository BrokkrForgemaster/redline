import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title:
    "Aeration & Overseeding Services | Redline Landscaping & Snow Removal",
  description:
    "Professional core aeration and overseeding services in Central Kentucky. Relieve soil compaction, promote root growth, and build a thicker, healthier lawn.",
  openGraph: {
    images: [
      {
        url: "/images/aeration.png",
        width: 1200,
        height: 630,
        alt: "Professional lawn aeration in Central Kentucky",
      },
    ],
  },
};

export default function AerationOverseedingPage() {
  return (
    <>
      {/* Hero with image */}
      <section className="relative w-full aspect-[16/9] md:aspect-[21/9] max-h-[60vh] overflow-hidden">
        <Image
          src="/images/aeration.png"
          alt="Close-up of lawn aeration by Redline"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_40%]"
        />

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-charcoal/80 to-charcoal/40" />

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 h-full flex flex-col justify-end pb-12">
          <Link
            href="/services"
            className="text-sm text-gray-300 hover:text-white transition-colors mb-4"
          >
            &larr; Back to Services
          </Link>

          <span className="inline-block bg-lawn text-white text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full w-fit mb-3">
            Lawn Care
          </span>

          <h1 className="text-4xl md:text-5xl font-bold text-white">
            Aeration &amp; Overseeding
          </h1>
        </div>
      </section>

      {/* Intro */}
      <section className="bg-white py-12 px-6 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <p className="text-lg text-muted max-w-3xl leading-relaxed">
            Over time, foot traffic and weather pack down your soil, starving
            grass roots of air, water, and nutrients. Core aeration opens up the
            ground, and overseeding fills in thin spots — giving you a thicker,
            healthier lawn that stands up to Kentucky&apos;s heat and cold.
          </p>
        </div>
      </section>

      {/* Details */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16">
          {/* What's Included */}
          <div className="animate-fade-in-up">
            <h2 className="text-3xl font-bold text-charcoal">
              What&apos;s Included
            </h2>
            <ul className="mt-6 space-y-4">
              {[
                "Core aeration across the entire lawn to relieve soil compaction",
                "Overseeding with a premium, region-appropriate seed blend",
                "Soil surface prep to maximize seed-to-soil contact",
                "Post-service watering and care guidance",
                "Seasonal timing recommendations for best results",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-charcoal">
                  <svg
                    className="w-5 h-5 text-lawn flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Why It Matters */}
          <div className="animate-fade-in-up delay-200">
            <h2 className="text-3xl font-bold text-charcoal">
              Why It Matters
            </h2>
            <div className="mt-6 space-y-6">
              {[
                {
                  title: "Deeper Root Growth",
                  text: "Aeration loosens compacted soil so roots can grow deeper, making your lawn more drought-resistant and resilient.",
                },
                {
                  title: "Thicker, Fuller Lawn",
                  text: "Overseeding introduces fresh grass varieties that fill in bare and thin patches for a lush, uniform look.",
                },
                {
                  title: "Seasonal Timing",
                  text: "We schedule aeration and overseeding for early fall or spring — the sweet spots when seed germination is strongest in Central Kentucky.",
                },
              ].map((item) => (
                <div key={item.title} className="border-l-4 border-lawn pl-4">
                  <h3 className="text-xl font-semibold text-charcoal">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-muted leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-offwhite py-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-charcoal">
            Revive Your Lawn
          </h2>
          <p className="mt-4 text-muted max-w-xl mx-auto leading-relaxed">
            Ready for a thicker, healthier yard? Contact us for a free aeration
            &amp; overseeding quote — we&apos;ll get back to you fast.
          </p>
          <Link
            href="/contact"
            className="inline-block mt-8 bg-lawn text-white text-sm font-semibold uppercase tracking-wide px-8 py-3.5 rounded-md hover:bg-lawn-dark transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            Request a Quote
          </Link>
        </div>
      </section>
    </>
  );
}
