"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Briefcase, Clock } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Profile } from "@/types/database";

export default function MobileNav({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const isOwner = profile.role === "owner";
  const mobileNav = [
    { label: "Home", href: "/dashboard", icon: LayoutDashboard },
    ...(profile.role === "developer" ? [] : [
      { label: isOwner ? "Jobs" : "My Jobs", href: isOwner ? "/jobs" : "/my-jobs", icon: Briefcase },
      { label: "Clock", href: "/time-tracking", icon: Clock },
    ]),
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 lg:hidden safe-area-inset-bottom">
      <div className="flex">
        {mobileNav.map(item => {
          const isActive = item.href !== "#" && (
            pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
          );
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                isActive ? "text-redline" : "text-gray-500 hover:text-charcoal"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
