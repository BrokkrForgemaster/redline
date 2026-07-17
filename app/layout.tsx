import type { Metadata } from "next";
import "./globals.css";

const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"
).replace(/\/$/, "");

const googleMapsUrl =
    "https://maps.google.com/?cid=13116220797947642750";

const serviceAreas = [
  "Lexington, Kentucky",
  "Georgetown, Kentucky",
  "Paris, Kentucky",
  "Versailles, Kentucky",
  "Winchester, Kentucky",
  "Nicholasville, Kentucky",
  "Harrodsburg, Kentucky",
  "Danville, Kentucky",
  "Richmond, Kentucky",
  "Berea, Kentucky",
  "Stanford, Kentucky",
  "Lancaster, Kentucky",
  "Mount Vernon, Kentucky",
  "Somerset, Kentucky",
  "Burnside, Kentucky",
  "Liberty, Kentucky",
  "Eubank, Kentucky",
];

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${siteUrl}/#business`,

  name: "Redline Landscaping & Snow Removal",
  description:
      "Professional lawn care, landscaping, aeration, overseeding, and snow removal services throughout Central and South-Central Kentucky.",

  url: siteUrl,
  telephone: "+16064250891",
  image: `${siteUrl}/images/mowing1.jpeg`,
  priceRange: "$$",

  hasMap: googleMapsUrl,

  sameAs: [
    googleMapsUrl,
    // Add official Facebook and Instagram URLs here.
  ],

  areaServed: [
    {
      "@type": "AdministrativeArea",
      name: "Central and South-Central Kentucky",
    },
    ...serviceAreas.map((name) => ({
      "@type": "City",
      name,
    })),
  ],

  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "https://schema.org/Monday",
        "https://schema.org/Tuesday",
        "https://schema.org/Wednesday",
        "https://schema.org/Thursday",
        "https://schema.org/Friday",
      ],
      opens: "07:00",
      closes: "18:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: "https://schema.org/Saturday",
      opens: "08:00",
      closes: "14:00",
    },
  ],

  makesOffer: [
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Lawn Mowing",
      },
    },
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Landscaping",
      },
    },
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Aeration and Overseeding",
      },
    },
    {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: "Snow Removal",
      },
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "Redline Landscaping & Snow Removal | Central Kentucky",
    template: "%s | Redline Landscaping & Snow Removal",
  },

  description:
      "Professional lawn care, landscaping, aeration, overseeding, and snow removal services throughout Central and South-Central Kentucky.",

  alternates: {
    canonical: "/",
  },

  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Redline Landscaping & Snow Removal",
    title: "Redline Landscaping & Snow Removal | Central Kentucky",
    description:
        "Professional lawn care, landscaping, and snow removal services throughout Central and South-Central Kentucky.",
    images: [
      {
        url: "/images/mowing1.jpeg",
        width: 1200,
        height: 630,
        alt: "Redline Landscaping & Snow Removal providing professional lawn care in Central Kentucky",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Redline Landscaping & Snow Removal | Central Kentucky",
    description:
        "Professional lawn care, landscaping, and snow removal services throughout Central and South-Central Kentucky. Firefighter owned and operated.",
    images: ["/images/mowing1.jpeg"],
  },
};

export default function RootLayout({
                                     children,
                                   }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#B11226" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Redline" />
        <link rel="apple-touch-icon" href="/images/logo.png" />
        <script
            dangerouslySetInnerHTML={{
              __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{});})}`,
            }}
        />
        <script
            async
            src="https://www.googletagmanager.com/gtag/js?id=GT-T5MRJWHC"
        />

        <script
            dangerouslySetInnerHTML={{
              __html:
                  "window.dataLayer=window.dataLayer||[];" +
                  "function gtag(){dataLayer.push(arguments);}" +
                  "gtag('js',new Date());" +
                  "gtag('config','GT-T5MRJWHC');",
            }}
        />

        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(localBusinessSchema).replace(
                  /</g,
                  "\\u003c",
              ),
            }}
        />
      </head>

      <body className="min-h-screen flex flex-col">
      {children}
      </body>
      </html>
  );
}