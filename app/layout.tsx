import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: {
    default: "Redline Landscaping & Snow Removal | Central Kentucky",
    template: "%s | Redline Landscaping & Snow Removal",
  },
  description:
    "Professional lawn care, landscaping, and snow removal services in Central Kentucky. Reliable, affordable, and always on time.",
  metadataBase: new URL("https://redlinelandscaping.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Redline Landscaping & Snow Removal",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
              name: "Redline Landscaping & Snow Removal",
              description:
                "Professional lawn care, landscaping, and snow removal services in Central Kentucky.",
              url: "https://redlinelandscaping.com",
              telephone: "+16064250891",
              address: {
                "@type": "PostalAddress",
                addressLocality: "Lexington",
                addressRegion: "KY",
                addressCountry: "US",
              },
              areaServed: [
                { "@type": "City", name: "Lexington" },
                { "@type": "City", name: "Richmond" },
                { "@type": "City", name: "Danville" },
                { "@type": "City", name: "Nicholasville" },
                { "@type": "City", name: "Berea" },
                { "@type": "City", name: "Winchester" },
                { "@type": "City", name: "Paris" },
                { "@type": "City", name: "Somerset" },
                { "@type": "City", name: "Mount Vernon" },
                { "@type": "City", name: "Stanford" },
                { "@type": "City", name: "Eubank" },
              ],
              serviceType: [
                "Lawn Mowing",
                "Landscaping",
                "Snow Removal",
              ],
              openingHours: ["Mo-Fr 07:00-18:00", "Sa 08:00-14:00"],
            }),
          }}
        />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
