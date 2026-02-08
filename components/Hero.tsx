import Link from "next/link";
import Image from "next/image";

export default function Hero() {
  return (
    <section className="relative min-h-[600px] flex items-center overflow-hidden">
      {/* Background Image */}
      <div className="relative w-full aspect-[16/9] md:aspect-[21/9] max-h-[70vh] lg:max-h-[60vh]">
        <Image
          src="/images/mowing1.jpeg"
          alt="Professional lawn mowing by Redline"
          fill
          className="object-cover object-[center_30%]"
          priority
          sizes="100vw"
        />
        {/* Dark overlay with slight green tint */}
        <div className="absolute inset-0 bg-gradient-to-br from-charcoal/80 via-charcoal/70 to-lawn/30" />

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-28 w-full">
          <div className="max-w-2xl">
            {/* Firefighter badge */}
            <span className="animate-fade-in inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-semibold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
              <svg
                className="w-4 h-4 text-redline"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 1l2.928 5.856L19 7.928l-4.5 4.382L15.856 19 10 15.928 4.144 19l1.356-6.69L1 7.928l6.072-1.072L10 1z"
                  clipRule="evenodd"
                />
              </svg>
              Firefighter Owned &amp; Operated
            </span>

            <h1 className="animate-fade-in-up text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
              Redline Landscaping
              <br />
              <span className="text-redline">&amp; Snow Removal</span>
            </h1>

            <p className="animate-fade-in-up-slow mt-6 text-lg md:text-xl text-gray-200 leading-relaxed max-w-lg">
              Professional lawn care, landscaping, and snow removal for Central
              Kentucky. Reliable, affordable, and always on time.
            </p>

            <div className="animate-fade-in-up-slow delay-200 mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/contact"
                className="bg-redline text-white text-sm font-semibold uppercase tracking-wide px-8 py-3.5 rounded-md hover:bg-redline-dark transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-center"
              >
                Request a Quote
              </Link>
              <Link
                href="/services"
                className="bg-lawn text-white text-sm font-semibold uppercase tracking-wide px-8 py-3.5 rounded-md hover:bg-lawn-dark transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-center"
              >
                Our Services
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-offwhite to-transparent" />
      </div>
    </section>
  );
}
