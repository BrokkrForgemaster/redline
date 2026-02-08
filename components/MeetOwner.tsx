import Image from "next/image";

export default function MeetOwner() {
  return (
    <section className="bg-white py-24 px-6 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Photo */}
          <div className="relative animate-slide-in-left order-2 lg:order-1">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <Image
                src="/images/Ryan_Shelby.jpg"
                alt="Ryan Gretz, owner of Redline Landscaping & Snow Removal, with Shelby"
                width={600}
                height={750}
                className="w-full h-auto object-cover"
              />
              {/* Subtle gradient at bottom */}
              <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-charcoal/40 to-transparent" />
            </div>
            {/* Decorative accent */}
            <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-redline/10 rounded-2xl -z-10" />
            <div className="absolute -top-4 -right-4 w-32 h-32 bg-lawn/10 rounded-2xl -z-10" />
          </div>

          {/* Content */}
          <div className="order-1 lg:order-2 animate-slide-in-right">
            <span className="text-sm font-semibold uppercase tracking-widest text-redline">
              About Redline
            </span>
            <h2 className="mt-2 text-3xl md:text-4xl font-bold text-charcoal leading-tight">
              Meet the Owner
            </h2>

            <div className="mt-6 space-y-4 text-muted leading-relaxed">
              <p>
                Meet Ryan Gretz, a dedicated firefighter with over 12 years of
                experience in the lawn care industry. As the heart of our
                family-owned, firefighter-operated business, Ryan brings a unique
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
                Somerset and local areas. You can trust Redline to deliver
                exceptional service that enhances the beauty and functionality of
                your home or business.
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
  );
}
