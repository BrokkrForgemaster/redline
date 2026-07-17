"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, Users, Receipt, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const MOBILE_NAV = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Jobs", href: "/my-jobs", icon: Briefcase },
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Invoices", href: "/invoices", icon: Receipt },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 lg:hidden safe-area-inset-bottom">
      <div className="flex">
        {MOBILE_NAV.map(item => {
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
