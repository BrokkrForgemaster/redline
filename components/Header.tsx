"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50">
      {/* Top accent stripe */}
      <div className="h-1 bg-gradient-to-r from-redline via-lawn to-redline" />

      {/* Main navigation */}
      <div className="bg-charcoal shadow-lg">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-24">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <Image
              src="/images/logo.png"
              alt="Redline Landscaping & Snow Removal"
              width={200}
              height={67}
              className="h-20 w-auto"
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-2">
            <Link
              href="/services"
              className="text-base font-semibold text-gray-300 px-5 py-2.5 rounded-md hover:bg-white/10 hover:text-redline transition-all duration-200"
            >
              Services
            </Link>
            <Link
              href="/gallery"
              className="text-base font-semibold text-gray-300 px-5 py-2.5 rounded-md hover:bg-white/10 hover:text-redline transition-all duration-200"
            >
              Gallery
            </Link>
            <Link
              href="/about"
              className="text-base font-semibold text-gray-300 px-5 py-2.5 rounded-md hover:bg-white/10 hover:text-redline transition-all duration-200"
            >
              About
            </Link>
            <Link
              href="/reviews"
              className="text-base font-semibold text-gray-300 px-5 py-2.5 rounded-md hover:bg-white/10 hover:text-redline transition-all duration-200"
            >
              Reviews
            </Link>
            <Link
              href="/contact"
              className="text-base font-semibold text-gray-300 px-5 py-2.5 rounded-md hover:bg-white/10 hover:text-redline transition-all duration-200"
            >
              Contact
            </Link>
            <span className="w-px h-6 bg-gray-600 mx-2" />
            <Link
              href="/contact"
              className="bg-redline text-white text-base font-bold uppercase tracking-wide px-7 py-2.5 rounded-md hover:bg-redline-dark transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
              Get a Free Quote
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-gray-300 p-2 rounded-md hover:bg-white/10 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileOpen && (
        <nav className="md:hidden bg-charcoal border-t border-gray-700 shadow-lg px-6 py-5 space-y-1 animate-fade-in">
          <Link
            href="/services"
            className="block text-base font-semibold text-gray-300 hover:text-redline hover:bg-white/10 px-4 py-3 rounded-md transition-all duration-200"
            onClick={() => setMobileOpen(false)}
          >
            Services
          </Link>
          <Link
            href="/gallery"
            className="block text-base font-semibold text-gray-300 hover:text-redline hover:bg-white/10 px-4 py-3 rounded-md transition-all duration-200"
            onClick={() => setMobileOpen(false)}
          >
            Gallery
          </Link>
          <Link
            href="/about"
            className="block text-base font-semibold text-gray-300 hover:text-redline hover:bg-white/10 px-4 py-3 rounded-md transition-all duration-200"
            onClick={() => setMobileOpen(false)}
          >
            About
          </Link>
          <Link
            href="/reviews"
            className="block text-base font-semibold text-gray-300 hover:text-redline hover:bg-white/10 px-4 py-3 rounded-md transition-all duration-200"
            onClick={() => setMobileOpen(false)}
          >
            Reviews
          </Link>
          <Link
            href="/contact"
            className="block text-base font-semibold text-gray-300 hover:text-redline hover:bg-white/10 px-4 py-3 rounded-md transition-all duration-200"
            onClick={() => setMobileOpen(false)}
          >
            Contact
          </Link>
          <div className="pt-3 border-t border-gray-700 mt-3">
            <Link
              href="/contact"
              className="block bg-redline text-white text-base font-bold uppercase tracking-wide px-6 py-3 rounded-md hover:bg-redline-dark transition-colors text-center shadow-md"
              onClick={() => setMobileOpen(false)}
            >
              Get a Free Quote
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
