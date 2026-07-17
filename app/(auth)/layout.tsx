import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: {
    default: "Sign In",
    template: "%s | Redline Landscaping",
  },
  robots: { index: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-offwhite flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-charcoal flex-col justify-between p-12 relative overflow-hidden">
        <div className="h-1 absolute top-0 left-0 right-0 bg-gradient-to-r from-redline via-lawn to-redline" />
        <div>
          <Link href="/">
            <Image
              src="/images/logo.png"
              alt="Redline Landscaping & Snow Removal"
              width={200}
              height={67}
              className="h-16 w-auto brightness-0 invert"
            />
          </Link>
          <div className="mt-12">
            <h2 className="text-3xl font-bold text-white leading-tight">
              Professional landscape<br />
              management, simplified.
            </h2>
            <p className="mt-4 text-gray-400 leading-relaxed max-w-sm">
              Manage your entire landscaping and snow removal business from one
              place — estimates, crews, routes, and invoices.
            </p>
          </div>
          <div className="mt-12 space-y-4">
            {[
              "Estimates & contracts",
              "Job scheduling & dispatch",
              "Snow event management",
              "Invoicing & payments",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-redline flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-gray-300 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-600">
          © {new Date().getFullYear()} Redline Landscaping & Snow Removal
        </p>
      </div>

      {/* Right content panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 text-center">
            <Link href="/">
              <Image
                src="/images/logo.png"
                alt="Redline Landscaping & Snow Removal"
                width={160}
                height={54}
                className="h-12 w-auto mx-auto"
              />
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
