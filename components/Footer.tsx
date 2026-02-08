import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-charcoal text-white">
      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-redline via-lawn to-redline" />

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Company */}
          <div className="md:col-span-2">
            <Image
              src="/images/logo.png"
              alt="Redline Landscaping & Snow Removal"
              width={200}
              height={67}
              className="h-14 w-auto brightness-0 invert"
            />
            <p className="mt-4 text-sm text-gray-400 leading-relaxed max-w-sm">
              Firefighter owned and operated. Professional lawn care,
              landscaping, and snow removal services proudly serving Central
              Kentucky.
            </p>
            <p className="mt-3 text-sm text-gray-500">
              <span className="text-gray-400 font-medium">(606) 425-0891</span>
            </p>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
              Services
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-gray-400">
              <li>
                <Link
                  href="/services/lawn-mowing"
                  className="hover:text-white transition-colors"
                >
                  Lawn Mowing
                </Link>
              </li>
              <li>
                <Link
                  href="/services/landscaping"
                  className="hover:text-white transition-colors"
                >
                  Landscaping
                </Link>
              </li>
              <li>
                <Link
                  href="/services/snow-removal"
                  className="hover:text-white transition-colors"
                >
                  Snow Removal
                </Link>
              </li>
            </ul>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
              Company
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-gray-400">
              <li>
                <Link
                  href="/reviews"
                  className="hover:text-white transition-colors"
                >
                  Reviews
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="hover:text-white transition-colors"
                >
                  Contact
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="hover:text-white transition-colors"
                >
                  Request a Quote
                </Link>
              </li>
            </ul>
            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
                Service Area
              </h3>
              <p className="mt-2 text-sm text-gray-400 leading-relaxed">
                Lexington, Richmond, Danville, Berea, Somerset &amp; surrounding areas.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright Bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
          <p>
            &copy; {new Date().getFullYear()} Redline Landscaping &amp; Snow
            Removal. All rights reserved.
          </p>
          <p>Firefighter Owned &amp; Operated</p>
        </div>
      </div>
    </footer>
  );
}
