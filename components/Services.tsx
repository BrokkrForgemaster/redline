import Link from "next/link";
import Image from "next/image";

const services = [
  {
    title: "Lawn Mowing",
    slug: "lawn-mowing",
    description:
      "Regular mowing, edging, and trimming to keep your lawn looking pristine all season long.",
    image: "/images/mowing.png",
    accent: "bg-lawn",
    delay: "",
  },
  {
    title: "Landscaping",
    slug: "landscaping",
    description:
      "Custom landscape design, mulching, planting, and hardscaping to transform your outdoor space.",
    image: "/images/landscaping.jpeg",
    accent: "bg-lawn",
    delay: "delay-100",
  },
  {
    title: "Aeration & Overseeding",
    slug: "aeration-overseeding",
    description:
      "Revive your lawn with core aeration and premium overseeding for a thicker, healthier turf.",
    image: "/images/aeration.png",
    accent: "bg-lawn",
    delay: "delay-200",
  },
  {
    title: "Snow Removal",
    slug: "snow-removal",
    description:
      "Fast, dependable snow plowing and ice management to keep your property safe and accessible.",
    image: "/images/snow.png",
    accent: "bg-redline",
    delay: "delay-300",
  },
];

export default function Services() {
  return (
    <section id="services" className="bg-white py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center animate-fade-in-up">
          <span className="text-sm font-semibold uppercase tracking-widest text-lawn">
            What We Do
          </span>
          <h2 className="mt-2 text-3xl md:text-4xl font-bold text-charcoal">
            Our Services
          </h2>
          <p className="mt-4 text-muted max-w-xl mx-auto leading-relaxed">
            From weekly lawn maintenance to emergency snow removal, we have you
            covered year-round.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service) => (
            <Link
              key={service.title}
              href={`/services/${service.slug}`}
              className={`group animate-fade-in-up ${service.delay} block bg-white rounded-xl overflow-hidden border border-border shadow-sm hover:shadow-lg transition-all hover:-translate-y-1`}
            >
              {/* Image */}
              <div className="relative h-56 overflow-hidden">
                <Image
                  src={service.image}
                  alt={service.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 to-transparent" />
                <span className={`absolute bottom-4 left-4 ${service.accent} text-white text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full`}>
                  {service.title}
                </span>
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="text-xl font-semibold text-charcoal group-hover:text-redline transition-colors">
                  {service.title}
                </h3>
                <p className="mt-2 text-muted leading-relaxed text-sm">
                  {service.description}
                </p>
                <span className="mt-4 inline-flex items-center text-sm font-medium text-redline group-hover:gap-2 gap-1 transition-all">
                  Learn more
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
