import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us | Redline Landscaping & Snow Removal",
  description:
    "Get in touch with Redline Landscaping & Snow Removal for a free quote. Serving Central Kentucky with lawn care, landscaping, and snow removal.",
};

export default function ContactPage() {
  return (
    <>
      {/* Page Header */}
      <section className="bg-offwhite py-16 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-charcoal">
            Contact Us
          </h1>
          <p className="mt-4 text-lg text-muted max-w-2xl mx-auto leading-relaxed">
            Have a question or ready to get started? Fill out the form below and
            we&apos;ll get back to you within 24 hours.
          </p>
        </div>
      </section>

      {/* Form + Info */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-16">
          {/* Form */}
          <div className="md:col-span-3">
            <h2 className="text-3xl font-bold text-charcoal">
              Request a Free Quote
            </h2>
            <form className="mt-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-charcoal"
                  >
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    className="mt-1 block w-full rounded-md border border-border bg-white px-4 py-3 text-charcoal placeholder:text-muted focus:border-redline focus:ring-1 focus:ring-redline outline-none transition-colors"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-charcoal"
                  >
                    Phone
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    className="mt-1 block w-full rounded-md border border-border bg-white px-4 py-3 text-charcoal placeholder:text-muted focus:border-redline focus:ring-1 focus:ring-redline outline-none transition-colors"
                    placeholder="(606) 425-0891"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-charcoal"
                >
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  className="mt-1 block w-full rounded-md border border-border bg-white px-4 py-3 text-charcoal placeholder:text-muted focus:border-redline focus:ring-1 focus:ring-redline outline-none transition-colors"
                  placeholder="redlineofkentucky@gmail.com"
                />
              </div>

              <div>
                <label
                  htmlFor="service"
                  className="block text-sm font-medium text-charcoal"
                >
                  Service Interested In
                </label>
                <select
                  id="service"
                  name="service"
                  className="mt-1 block w-full rounded-md border border-border bg-white px-4 py-3 text-charcoal focus:border-redline focus:ring-1 focus:ring-redline outline-none transition-colors"
                >
                  <option value="">Select a service</option>
                  <option value="lawn-mowing">Lawn Mowing</option>
                  <option value="landscaping">Landscaping</option>
                  <option value="snow-removal">Snow Removal</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium text-charcoal"
                >
                  Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={5}
                  required
                  className="mt-1 block w-full rounded-md border border-border bg-white px-4 py-3 text-charcoal placeholder:text-muted focus:border-redline focus:ring-1 focus:ring-redline outline-none transition-colors resize-y"
                  placeholder="Tell us about your property and what you need..."
                />
              </div>

              <button
                type="submit"
                className="bg-redline text-white text-sm font-semibold uppercase tracking-wide px-8 py-3 rounded-md hover:bg-red-800 transition-colors"
              >
                Send Message
              </button>
            </form>
          </div>

          {/* Contact Info */}
          <div className="md:col-span-2">
            <h2 className="text-3xl font-bold text-charcoal">Get in Touch</h2>
            <div className="mt-8 space-y-6">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Phone
                </h3>
                <p className="mt-1 text-lg text-charcoal">(606) 425-0891</p>
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Email
                </h3>
                <p className="mt-1 text-lg text-charcoal">
                  redlineofkentucky@gmail.com
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Service Area
                </h3>
                <p className="mt-1 text-charcoal leading-relaxed">
                  Central Kentucky including Lexington, Richmond, Danville,
                  Berea, Somerset, and surrounding communities.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
                  Hours
                </h3>
                <p className="mt-1 text-charcoal leading-relaxed">
                  Monday – Friday: 7:00 AM – 6:00 PM
                  <br />
                  Saturday: 8:00 AM – 2:00 PM
                  <br />
                  Sunday: Closed
                </p>
                <p className="mt-2 text-sm text-muted">
                  Snow removal available 24/7 during winter storms.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
