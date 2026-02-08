import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Landscaping Services | Redline Landscaping & Snow Removal",
  description:
    "Custom landscaping, mulching, garden beds, and hardscaping services in Central Kentucky. Transform your outdoor space with Redline.",
};

export default function LandscapingPage() {
  return (
    <>
      {/* Hero with image */}
      <section className="relative h-72 md:h-96 overflow-hidden">
        <Image
          src="/images/landscaping.jpeg"
          alt="Landscaping project by Redline"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-charcoal/80 to-charcoal/40" />
        <div className="relative z-10 max-w-7xl mx-auto px-6 h-full flex flex-col justify-end pb-12">
          <Link
            href="/services"
            className="text-sm text-gray-300 hover:text-white transition-colors mb-4"
          >
            &larr; Back to Services
          </Link>
          <span className="inline-block bg-lawn text-white text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full w-fit mb-3">
            Outdoor Living
          </span>
          <h1 className="animate-fade-in-up text-4xl md:text-5xl font-bold text-white">
            Landscaping
          </h1>
        </div>
      </section>

      {/* Intro */}
      <section className="bg-white py-12 px-6 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <p className="text-lg text-muted max-w-3xl leading-relaxed">
            Whether you need fresh mulch, new plantings, or a complete outdoor
            transformation, our landscaping team brings your vision to life with
            professional design and installation.
          </p>
        </div>
      </section>

      {/* Details */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16">
          {/* Services */}
          <div className="animate-fade-in-up">
            <h2 className="text-3xl font-bold text-charcoal">
              What We Offer
            </h2>
            <ul className="mt-6 space-y-4">
              {[
                "Custom landscape design tailored to your property and budget",
                "Mulch installation and garden bed maintenance",
                "Shrub, tree, and flower planting",
                "Hardscaping — patios, walkways, and retaining walls",
                "Seasonal cleanups and property refresh",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-charcoal">
                  <svg className="w-5 h-5 text-lawn flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Process */}
          <div className="animate-fade-in-up delay-200">
            <h2 className="text-3xl font-bold text-charcoal">
              Our Process
            </h2>
            <div className="mt-6 space-y-6">
              {[
                {
                  step: "1",
                  title: "Consultation",
                  text: "We visit your property, discuss your goals, and assess the space.",
                },
                {
                  step: "2",
                  title: "Design & Quote",
                  text: "You receive a clear plan and transparent pricing before any work begins.",
                },
                {
                  step: "3",
                  title: "Installation",
                  text: "Our crew handles everything — from prep to cleanup — with minimal disruption.",
                },
                {
                  step: "4",
                  title: "Follow-Up",
                  text: "We check in to make sure everything looks great and you're fully satisfied.",
                },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-4">
                  <span className="flex-shrink-0 w-9 h-9 bg-lawn text-white rounded-full flex items-center justify-center text-sm font-bold shadow-sm">
                    {item.step}
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold text-charcoal">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-muted leading-relaxed">
                      {item.text}
                    </p>
                  </div>
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
            Let&apos;s Transform Your Property
          </h2>
          <p className="mt-4 text-muted max-w-xl mx-auto leading-relaxed">
            Tell us what you have in mind and we&apos;ll schedule a free
            on-site consultation.
          </p>
          <Link
            href="/contact"
            className="inline-block mt-8 bg-lawn text-white text-sm font-semibold uppercase tracking-wide px-8 py-3.5 rounded-md hover:bg-lawn-dark transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            Request a Consultation
          </Link>
        </div>
      </section>
    </>
  );
}
