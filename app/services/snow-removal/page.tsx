import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Snow Removal Services | Redline Landscaping & Snow Removal",
  description:
    "Reliable snow plowing, ice treatment, and winter storm response in Central Kentucky. Keep your property safe and accessible all winter.",
  openGraph: {
    images: [{ url: "/images/snow.png", width: 1200, height: 630, alt: "Redline snow removal trucks ready for winter in Central Kentucky" }],
  },
};

export default function SnowRemovalPage() {
  return (
    <>
      {/* Hero with image — ice/redline accent */}
      <section className="relative w-full aspect-[16/9] md:aspect-[21/9] max-h-[60vh] overflow-hidden">
        <Image
          src="/images/snow.png"
          alt="Redline snow plow trucks ready for action"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_55%]"
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

          <span className="inline-block bg-redline text-white text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full w-fit mb-3">
            Winter Services
          </span>

          <h1 className="text-4xl md:text-5xl font-bold text-white">
            Snow Removal
          </h1>
        </div>
      </section>

      {/* Intro */}
      <section className="bg-ice py-12 px-6 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <p className="text-lg text-muted max-w-3xl leading-relaxed">
            When winter hits, Redline is ready. Our snow removal crew keeps your
            driveways, parking lots, and walkways safe and clear — day or night,
            storm after storm.
          </p>
        </div>
      </section>

      {/* Details */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16">
          {/* Services */}
          <div className="animate-fade-in-up">
            <h2 className="text-3xl font-bold text-charcoal">What We Offer</h2>
            <ul className="mt-6 space-y-4">
              {[
                "Residential driveway and walkway plowing",
                "Commercial parking lot clearing",
                "Sidewalk shoveling and snow blowing",
                "Ice treatment and salt application",
                "24/7 emergency storm response",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-charcoal">
                  <svg
                    className="w-5 h-5 text-redline flex-shrink-0 mt-0.5"
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

          {/* Why Trust Us */}
          <div className="animate-fade-in-up delay-200">
            <h2 className="text-3xl font-bold text-charcoal">
              Why Trust Redline in Winter
            </h2>
            <div className="mt-6 space-y-6">
              {[
                {
                  title: "Fast Response Times",
                  text: "We monitor weather around the clock and dispatch crews as soon as accumulation starts.",
                },
                {
                  title: "Dependable Coverage",
                  text: "Seasonal contracts ensure you're always covered — no scrambling to find a plow when a storm hits.",
                },
                {
                  title: "Safety First",
                  text: "Our ice treatment and salting reduces slip-and-fall risk on your property.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="border-l-4 border-redline pl-4"
                >
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

      {/* Equipment photo break */}
      <section className="relative w-full aspect-[16/9] max-h-[50vh] overflow-hidden">
        <Image
          src="/images/snow2.png"
          alt="Freshly mowed residential lawn"
          fill
          sizes="100vw"
          className="object-cover object-[center_50%]"
        />
        <div className="absolute inset-0 bg-charcoal/30" />
      </section>

      {/* CTA — ice accent */}
      <section className="bg-ice py-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-charcoal">
            Be Ready Before the First Snowfall
          </h2>
          <p className="mt-4 text-muted max-w-xl mx-auto leading-relaxed">
            Lock in your seasonal snow removal contract now. We&apos;ll be there
            when you need us.
          </p>
          <Link
            href="/contact"
            className="inline-block mt-8 bg-redline text-white text-sm font-semibold uppercase tracking-wide px-8 py-3.5 rounded-md hover:bg-redline-dark transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            Request a Quote
          </Link>
        </div>
      </section>
    </>
  );
}
