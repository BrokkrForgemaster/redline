import Link from "next/link";
import Image from "next/image";

const highlights = [
  {
    label: "Firefighter Owned",
    description:
      "Built on the same values we carry on the job — integrity, hard work, and serving others.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    label: "Reliable Service",
    description:
      "We show up on time, every time — rain, shine, or snow. Your property is always taken care of.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Fair Pricing",
    description:
      "Honest quotes with no hidden fees or surprise charges. You know what you're paying upfront.",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function Trust() {
  return (
    <section className="bg-offwhite py-24 px-6 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Top: Work showcase */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Images */}
          <div className="grid grid-cols-2 gap-4 animate-slide-in-left">
            <div className="relative h-64 rounded-xl overflow-hidden shadow-lg">
              <Image
                src="/images/burnside.png"
                alt="Professional field mowing at Burnside"
                fill
                className="object-cover"
              />
            </div>
            <div className="relative h-64 rounded-xl overflow-hidden shadow-lg mt-8">
              <Image
                src="/images/burnside1.JPG"
                alt="Aerial view of Burnside field mowing"
                fill
                className="object-cover"
              />
            </div>
          </div>

          {/* Text */}
          <div className="animate-slide-in-right">
            <span className="text-sm font-semibold uppercase tracking-widest text-redline">
              Why Choose Us
            </span>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold text-charcoal leading-tight">
              Serving Central Kentucky
              <br />
              &amp; Surrounding Areas
            </h2>
            <p className="mt-4 text-muted leading-relaxed">
              Redline Landscaping &amp; Snow Removal is a firefighter-owned
              business built on reliability, professionalism, and quality work
              across Central Kentucky. When you call us, you get us — not a
              call center.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Image
                src="/images/logo.png"
                alt="Redline logo"
                width={120}
                height={40}
                className="h-10 w-auto opacity-60"
              />
            </div>
          </div>
        </div>

        {/* Trust pillars */}
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          {highlights.map((item, i) => (
            <div
              key={item.label}
              className={`animate-fade-in-up delay-${(i + 1) * 100} bg-white rounded-xl p-8 border border-border shadow-sm hover:shadow-md transition-shadow text-center`}
            >
              <div className="inline-flex items-center justify-center w-14 h-14 bg-redline/10 text-redline rounded-full mb-4">
                {item.icon}
              </div>
              <h3 className="text-xl font-semibold text-charcoal">
                {item.label}
              </h3>
              <p className="mt-2 text-muted leading-relaxed text-sm">
                {item.description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center animate-fade-in-up">
          <Link
            href="/contact"
            className="inline-block bg-redline text-white text-sm font-semibold uppercase tracking-wide px-8 py-3.5 rounded-md hover:bg-redline-dark transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            Get Your Free Quote
          </Link>
        </div>
      </div>
    </section>
  );
}
