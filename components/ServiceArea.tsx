"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

const ServiceAreaMap = dynamic(() => import("./ServiceAreaMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] rounded-xl bg-gray-800 animate-pulse" />
  ),
});

const cities = [
  "Lexington",
  "Richmond",
  "Danville",
  "Nicholasville",
  "Berea",
  "Winchester",
  "Paris",
  "Stanford",
  "Mount Vernon",
  "Somerset",
  "Eubank",
];

const stats = [
  { value: "10+", label: "Cities Served" },
  { value: "24/7", label: "Snow Response" },
  { value: "100%", label: "Locally Owned" },
];

export default function ServiceArea() {
  return (
    <section className="bg-charcoal py-24 px-6 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center animate-fade-in-up">
          <span className="text-sm font-semibold uppercase tracking-widest text-redline">
            Where We Work
          </span>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold text-white leading-tight">
            Proudly Serving Central Kentucky
          </h2>
          <p className="mt-4 text-gray-400 max-w-2xl mx-auto leading-relaxed">
            From Lexington to Somerset and everywhere in between — we bring
            reliable lawn care, landscaping, and snow removal to your door.
          </p>
        </div>

        {/* Stats */}
        <div className="mt-12 grid grid-cols-3 gap-6 max-w-lg mx-auto animate-fade-in-up delay-100">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl md:text-4xl font-bold text-redline">
                {stat.value}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-gray-400">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Map + Cities grid */}
        <div className="mt-16 grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          {/* Map */}
          <div className="lg:col-span-3 animate-slide-in-left">
            <div className="rounded-xl overflow-hidden shadow-2xl border border-gray-700">
              <ServiceAreaMap />
            </div>
          </div>

          {/* Cities list */}
          <div className="lg:col-span-2 animate-slide-in-right">
            <h3 className="text-lg font-bold text-white mb-4">
              Cities We Serve
            </h3>
            <div className="flex flex-wrap gap-2">
              {cities.map((city) => (
                <span
                  key={city}
                  className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 text-gray-300 text-sm px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors"
                >
                  <svg
                    className="w-3 h-3 text-redline"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {city}, KY
                </span>
              ))}
            </div>

            <div className="mt-8 p-5 bg-white/5 border border-white/10 rounded-xl">
              <p className="text-sm text-gray-400 leading-relaxed">
                Don&apos;t see your city? We may still cover your area.
                Reach out and we&apos;ll let you know.
              </p>
              <Link
                href="/contact"
                className="inline-block mt-4 bg-redline text-white text-sm font-semibold uppercase tracking-wide px-6 py-2.5 rounded-md hover:bg-redline-dark transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                Check Availability
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
