import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Reviews | Redline Landscaping & Snow Removal",
  description:
    "See what our customers are saying about Redline Landscaping & Snow Removal. Trusted lawn care and snow removal in Central Kentucky.",
  openGraph: {
    images: [{ url: "/images/mowing1.jpeg", width: 1200, height: 630, alt: "Redline Landscaping customer reviews" }],
  },
};

const reviews = [
  {
    name: "Ava B.",
    location: "Richmond, KY",
    text: "I couldn't be happier with my lawn mowing service! Thanks to Ryan, my yard looks outstanding, and the attention to detail is impressive! It's never looked better. I'll definitely be using his company long term!",
    service: "Lawn Mowing",
  },
  {
    name: "Nick C.",
    location: "Somerset, KY",
    text: "Ryan has been super helpful and friendly. He is helping us out with my mother's property because we are unfortunately not close enough to consistently keep up with the property. The lawn had been neglected and getting pretty bad and we let Ryan do his thing and the lawn has never looked so good. 100% would recommend.",
    service: "Lawn Care",
  },
  {
    name: "Cody B.",
    location: "Berea, KY",
    text: "These guys have done a great job for me and are incredibly transparent with pricing. Also won't keep you waiting!! Great way to support a local firefighter!",
    service: "Lawn Care",
  },
];

function StarRating() {
  return (
    <div className="flex gap-0.5 text-yellow-500">
      {[...Array(5)].map((_, i) => (
        <svg key={i} className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <>
      {/* Page Header */}
      <section className="bg-offwhite py-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-charcoal">
            Customer Reviews
          </h1>
          <p className="mt-4 text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            Don&apos;t just take our word for it — here&apos;s what our
            customers have to say.
          </p>
        </div>
      </section>

      {/* Reviews Grid */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {reviews.map((review) => (
            <div
              key={review.name}
              className="bg-white border border-border rounded-lg p-8 shadow-sm hover:shadow-md transition-shadow"
            >
              <StarRating />
              <p className="mt-4 text-charcoal leading-relaxed">
                &ldquo;{review.text}&rdquo;
              </p>
              <div className="mt-6 border-t border-border pt-4">
                <p className="font-semibold text-charcoal">{review.name}</p>
                <p className="text-sm text-muted">
                  {review.location} &middot; {review.service}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-offwhite py-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-charcoal">
            Ready to See for Yourself?
          </h2>
          <p className="mt-4 text-muted max-w-xl mx-auto leading-relaxed">
            Join our growing list of satisfied customers across Central Kentucky.
          </p>
          <Link
            href="/contact"
            className="inline-block mt-8 bg-redline text-white text-sm font-semibold uppercase tracking-wide px-8 py-3 rounded-md hover:bg-red-800 transition-colors"
          >
            Request a Quote
          </Link>
        </div>
      </section>
    </>
  );
}
