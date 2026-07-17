"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface CachedPage {
  url: string;
  label: string;
}

const PUBLIC_LABELS: Record<string, string> = {
  "/": "Home",
  "/about": "About Us",
  "/services": "Services",
  "/services/lawn-mowing": "Lawn Mowing",
  "/services/landscaping": "Landscaping",
  "/services/aeration-overseeding": "Aeration & Overseeding",
  "/services/snow-removal": "Snow Removal",
  "/contact": "Contact",
  "/gallery": "Gallery",
  "/reviews": "Reviews",
};

const APP_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/leads": "Leads",
  "/customers": "Customers",
  "/jobs": "Jobs",
  "/estimates": "Estimates",
  "/invoices": "Invoices",
  "/snow-events": "Snow Events",
  "/inventory": "Inventory",
};

export default function OfflinePage() {
  const [cachedPages, setCachedPages] = useState<CachedPage[]>([]);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function findCachedPages() {
      if (!("caches" in window)) {
        setChecking(false);
        return;
      }
      try {
        const cacheNames = await caches.keys();
        const allMatches: CachedPage[] = [];
        const allLabels = { ...PUBLIC_LABELS, ...APP_LABELS };

        for (const name of cacheNames) {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          for (const req of keys) {
            const pathname = new URL(req.url).pathname;
            const label = allLabels[pathname];
            if (label) {
              allMatches.push({ url: pathname, label });
            }
          }
        }

        // Deduplicate
        const seen = new Set<string>();
        setCachedPages(
          allMatches.filter((p) => {
            if (seen.has(p.url)) return false;
            seen.add(p.url);
            return true;
          })
        );
      } catch {
        // caches API unavailable
      } finally {
        setChecking(false);
      }
    }

    findCachedPages();
  }, []);

  const publicPages = cachedPages.filter((p) => PUBLIC_LABELS[p.url]);
  const appPages = cachedPages.filter((p) => APP_LABELS[p.url]);

  function tryAgain() {
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full">
        {/* Icon */}
        <div className="w-16 h-16 bg-charcoal rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-charcoal text-center">
          You&apos;re offline
        </h1>
        <p className="mt-2 text-muted text-center text-sm">
          No internet connection. Pages you&apos;ve visited before are still available.
        </p>

        <button
          onClick={tryAgain}
          className="mt-6 w-full px-6 py-2.5 bg-redline text-white font-semibold rounded-lg hover:bg-redline-dark transition-colors"
        >
          Try Again
        </button>

        {/* Cached content */}
        {!checking && cachedPages.length > 0 && (
          <div className="mt-8 space-y-4">
            {appPages.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                  App — last loaded data
                </p>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {appPages.map((page) => (
                    <Link
                      key={page.url}
                      href={page.url}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm font-medium text-charcoal">
                        {page.label}
                      </span>
                      <svg
                        className="w-4 h-4 text-muted"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </Link>
                  ))}
                </div>
                <p className="mt-1 text-xs text-muted px-1">
                  Showing data from your last visit. Changes won&apos;t save until you&apos;re back online.
                </p>
              </div>
            )}

            {publicPages.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                  Website
                </p>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {publicPages.map((page) => (
                    <Link
                      key={page.url}
                      href={page.url}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm font-medium text-charcoal">
                        {page.label}
                      </span>
                      <svg
                        className="w-4 h-4 text-muted"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!checking && cachedPages.length === 0 && (
          <p className="mt-6 text-sm text-muted text-center">
            No cached pages found. Visit some pages while online to enable offline access.
          </p>
        )}

        {checking && (
          <p className="mt-6 text-sm text-muted text-center">
            Checking cached pages…
          </p>
        )}
      </div>
    </div>
  );
}
