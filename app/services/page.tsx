import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Our Services | Redline Landscaping & Snow Removal",
  description:
    "Lawn mowing, landscaping, and snow removal services in Central Kentucky. Year-round property maintenance you can count on.",
  openGraph: {
    images: [{ url: "/images/mowing1.jpeg", width: 1200, height: 630, alt: "Redline Landscaping services in Central Kentucky" }],
  },
};

const services = [
  {
    title: "Lawn Mowing",
    slug: "lawn-mowing",
    description:
      "Keep your lawn looking sharp with our weekly and bi-weekly mowing services. We handle edging, trimming, and cleanup so you don't have to.",
    features: [
      "Weekly & bi-weekly scheduling",
      "Edging & string trimming",
      "Grass clipping cleanup",
      "Consistent cut height",
    ],
    image: "/images/mowing1.jpeg",
    accent: "border-lawn",
    checkColor: "text-lawn",
    buttonClass: "bg-lawn hover:bg-lawn-dark",
  },
  {
    title: "Landscaping",
    slug: "landscaping",
    description:
      "From garden beds to complete outdoor transformations, our landscaping services bring your vision to life with professional design and installation.",
    features: [
      "Custom landscape design",
      "Mulching & garden beds",
      "Shrub & tree planting",
      "Hardscaping & retaining walls",
    ],
    image: "/images/landscaping.jpeg",
    accent: "border-lawn",
    checkColor: "text-lawn",
    buttonClass: "bg-lawn hover:bg-lawn-dark",
  },
  {
    title: "Snow Removal",
    slug: "snow-removal",
    description:
      "Don't let winter slow you down. Our snow plowing and ice management keeps your driveways, parking lots, and walkways safe and clear.",
    features: [
      "Residential & commercial plowing",
      "Sidewalk & walkway clearing",
      "Ice treatment & salting",
      "24/7 storm response",
    ],
    image: "/images/snow.png",
    accent: "border-redline",
    checkColor: "text-redline",
    buttonClass: "bg-redline hover:bg-redline-dark",
  },
];

export default function ServicesPage() {
  return (
    <>
      {/* Page Header */}
      <section className="bg-offwhite py-16 px-6">
        <div className="max-w-7xl mx-auto text-center animate-fade-in-up">
          <span className="text-sm font-semibold uppercase tracking-widest text-lawn">
            Year-Round Care
          </span>
          <h1 className="mt-2 text-4xl md:text-5xl font-bold text-charcoal">
            Our Services
          </h1>
          <p className="mt-4 text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            Year-round property maintenance for homes and businesses across
            Central Kentucky.
          </p>
        </div>
      </section>

      {/* Services List */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-7xl mx-auto space-y-24">
          {services.map((service, i) => (
            <div
              key={service.slug}
              className={`flex flex-col md:flex-row items-center gap-12 ${
                i % 2 === 1 ? "md:flex-row-reverse" : ""
              }`}
            >
              {/* Image */}
              <div className={`w-full md:w-1/2 relative h-72 md:h-96 rounded-xl overflow-hidden shadow-lg border-t-4 ${service.accent} animate-fade-in-up`}>
                <Image
                  src={service.image}
                  alt={service.title}
                  fill
                  className="object-cover"
                />
              </div>

              {/* Content */}
              <div className="w-full md:w-1/2 animate-fade-in-up delay-200">
                <h2 className="text-3xl font-bold text-charcoal">
                  {service.title}
                </h2>
                <p className="mt-4 text-muted leading-relaxed">
                  {service.description}
                </p>
                <ul className="mt-6 space-y-2">
                  {service.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-charcoal">
                      <svg className={`w-5 h-5 ${service.checkColor} flex-shrink-0 mt-0.5`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link
                    href={`/services/${service.slug}`}
                    className={`${service.buttonClass} text-white text-sm font-semibold uppercase tracking-wide px-6 py-3 rounded-md transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5`}
                  >
                    Learn More
                  </Link>
                  <Link
                    href="/contact"
                    className="border border-border text-charcoal text-sm font-semibold uppercase tracking-wide px-6 py-3 rounded-md hover:bg-offwhite transition-colors"
                  >
                    Get a Quote
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-offwhite py-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-charcoal">
            Ready to Get Started?
          </h2>
          <p className="mt-4 text-muted max-w-xl mx-auto leading-relaxed">
            Contact us today for a free, no-obligation quote. We respond fast.
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
