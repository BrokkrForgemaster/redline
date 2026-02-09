import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Lawn Mowing Services | Redline Landscaping & Snow Removal",
  description:
    "Professional lawn mowing, edging, and trimming services in Central Kentucky. Weekly and bi-weekly scheduling available. Get a free quote today.",
  openGraph: {
    images: [{ url: "/images/mowing1.jpeg", width: 1200, height: 630, alt: "Professional lawn mowing in Central Kentucky" }],
  },
};

export default function LawnMowingPage() {
  return (
    <>
      {/* Hero with image */}
      <section className="relative w-full aspect-[16/9] md:aspect-[21/9] max-h-[60vh] overflow-hidden">
        <Image
          src="/images/mowing1.jpeg"
          alt="Professional mowing by Redline"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_35%]"
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
            Lawn Mowing
          </h1>
        </div>
      </section>

      {/* Intro */}
      <section className="bg-white py-12 px-6 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <p className="text-lg text-muted max-w-3xl leading-relaxed">
            A well-maintained lawn is the foundation of great curb appeal. Our
            mowing service keeps your property looking clean, healthy, and
            professionally manicured — week after week.
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
                "Professional-grade mowing at the optimal height for your grass type",
                "Edging along sidewalks, driveways, and garden beds",
                "String trimming around fences, trees, and obstacles",
                "Grass clipping cleanup and blowing of hard surfaces",
                "Consistent weekly or bi-weekly scheduling",
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

          {/* Why Choose Us */}
          <div className="animate-fade-in-up delay-200">
            <h2 className="text-3xl font-bold text-charcoal">
              Why Choose Redline
            </h2>
            <div className="mt-6 space-y-6">
              {[
                {
                  title: "Reliable Scheduling",
                  text: "We show up on the same day each week so you never have to wonder when your lawn will be done.",
                },
                {
                  title: "Fair, Transparent Pricing",
                  text: "No surprise charges. You'll know exactly what you're paying before we start.",
                },
                {
                  title: "Firefighter Owned",
                  text: "We bring the same discipline and reliability from the firehouse to your front yard.",
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

      {/* Photo break */}
      <section className="relative w-full aspect-[16/9] max-h-[50vh] overflow-hidden">
        <Image
          src="/images/mowing.jpeg"
          alt="Freshly mowed residential lawn"
          fill
          sizes="100vw"
          className="object-cover object-[center_40%]"
        />
        <div className="absolute inset-0 bg-charcoal/30" />
      </section>

      {/* CTA */}
      <section className="bg-offwhite py-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-charcoal">
            Get a Free Lawn Mowing Quote
          </h2>
          <p className="mt-4 text-muted max-w-xl mx-auto leading-relaxed">
            Tell us about your property and we&apos;ll send you a fair, honest
            quote — usually within 24 hours.
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
