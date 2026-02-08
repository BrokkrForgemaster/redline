import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us | Redline Landscaping & Snow Removal",
  description:
    "Meet Ryan Gretz, firefighter and owner of Redline Landscaping & Snow Removal. Over 12 years of lawn care experience serving Central Kentucky.",
};

export default function AboutPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-offwhite py-16 px-6">
        <div className="max-w-7xl mx-auto text-center animate-fade-in-up">
          <span className="text-sm font-semibold uppercase tracking-widest text-redline">
            Our Story
          </span>
          <h1 className="mt-2 text-4xl md:text-5xl font-bold text-charcoal">
            About Redline
          </h1>
          <p className="mt-4 text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            A firefighter-owned business built on hard work, integrity, and
            serving our Central Kentucky community.
          </p>
        </div>
      </section>

      {/* Owner section */}
      <section className="bg-white py-24 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Photo */}
            <div className="relative animate-slide-in-left">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src="/images/Ryan_Shelby.jpg"
                  alt="Ryan Gretz, owner of Redline Landscaping & Snow Removal, with Shelby"
                  width={600}
                  height={750}
                  className="w-full h-auto object-cover"
                  priority
                />
                <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-charcoal/40 to-transparent" />
              </div>
              <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-redline/10 rounded-2xl -z-10" />
              <div className="absolute -top-4 -right-4 w-32 h-32 bg-lawn/10 rounded-2xl -z-10" />
            </div>

            {/* Content */}
            <div className="animate-slide-in-right">
              <h2 className="text-3xl md:text-4xl font-bold text-charcoal leading-tight">
                Meet Ryan Gretz
              </h2>
              <p className="mt-2 text-lg text-redline font-semibold">
                Founder &amp; Owner
              </p>

              <div className="mt-6 space-y-4 text-muted leading-relaxed">
                <p>
                  Ryan is a dedicated firefighter with over 12 years of
                  experience in the lawn care industry. As the heart of our
                  family-owned, firefighter-operated business, he brings a unique
                  perspective and strong commitment to serving both our community
                  and your outdoor spaces with the utmost care and expertise.
                </p>
                <p>
                  With a passion for the outdoors and a dedication to excellence,
                  Ryan brings years of industry knowledge and hands-on experience
                  to every project. Focused on ensuring customer satisfaction, he
                  takes pride in transforming outdoor spaces through comprehensive
                  lawn care services, expert landscaping design, and efficient snow
                  removal operations.
                </p>
                <p>
                  Serving areas including Richmond, Berea, Winchester, Paris,
                  Somerset and surrounding communities. You can trust Redline to
                  deliver exceptional service that enhances the beauty and
                  functionality of your home or business.
                </p>
              </div>

              {/* Trust badges */}
              <div className="mt-8 flex flex-wrap gap-4">
                <div className="flex items-center gap-2 bg-offwhite border border-border rounded-lg px-4 py-2.5">
                  <svg className="w-5 h-5 text-redline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                  </svg>
                  <span className="text-sm font-semibold text-charcoal">Firefighter Owned</span>
                </div>
                <div className="flex items-center gap-2 bg-offwhite border border-border rounded-lg px-4 py-2.5">
                  <svg className="w-5 h-5 text-lawn" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-semibold text-charcoal">12+ Years Experience</span>
                </div>
                <div className="flex items-center gap-2 bg-offwhite border border-border rounded-lg px-4 py-2.5">
                  <svg className="w-5 h-5 text-lawn" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span className="text-sm font-semibold text-charcoal">Family Owned</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-offwhite py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-charcoal text-center animate-fade-in-up">
            What We Stand For
          </h2>
          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: "Service Before Self",
                text: "The same values Ryan carries as a firefighter — showing up when people need us, no matter what.",
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
              },
              {
                title: "Quality Workmanship",
                text: "We treat every property like it's our own. No shortcuts, no cutting corners — just honest, quality work.",
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                ),
              },
              {
                title: "Community First",
                text: "We live here, work here, and raise our families here. Supporting Central Kentucky is personal to us.",
                icon: (
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div
                key={item.title}
                className="animate-fade-in-up bg-white rounded-xl p-8 border border-border shadow-sm hover:shadow-md transition-shadow text-center"
              >
                <div className="inline-flex items-center justify-center w-14 h-14 bg-redline/10 text-redline rounded-full mb-4">
                  {item.icon}
                </div>
                <h3 className="text-xl font-semibold text-charcoal">
                  {item.title}
                </h3>
                <p className="mt-2 text-muted leading-relaxed text-sm">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white py-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-charcoal">
            Ready to Work With Us?
          </h2>
          <p className="mt-4 text-muted max-w-xl mx-auto leading-relaxed">
            Get in touch today for a free quote. We&apos;d love to help with
            your next project.
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
