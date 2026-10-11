"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { Profile } from "@/types/database";
import { cn } from "@/lib/utils/cn";
import { getProfileDisplayName, getProfileInitials } from "@/lib/auth/profile-display";

interface NavItem {
  label: string;
  href?: string;
  icon: string;
  children?: { label: string; href: string }[];
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "□" },
  { label: "My Jobs", href: "/my-jobs", icon: "▣", roles: ["crew_member", "crew_leader", "subcontractor"] },
  { label: "Jobs", href: "/jobs", icon: "▣", roles: ["developer", "owner"] },
  { label: "Service Runs", href: "/service-runs", icon: "○", roles: ["developer", "owner"] },
  { label: "Crews", href: "/crews", icon: "◇", roles: ["developer", "owner"] },
  { label: "Settings", href: "/settings", icon: "⚙", roles: ["developer", "owner"] },
];

interface Props {
  profile: Profile;
  mobile?: boolean;
  onClose?: () => void;
}

function NavGroup({ item, pathname }: { item: NavItem; pathname: string }) {
  return (
    <Link
      href={item.href ?? "/dashboard"}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href ?? ""))
          ? "bg-redline text-white"
          : "text-gray-300 hover:bg-white/10 hover:text-white"
      )}
    >
      <span className="w-[18px] flex-shrink-0 text-center text-base leading-none">{item.icon}</span>
      {item.label}
    </Link>
  );
}

export default function Sidebar({ profile, mobile, onClose }: Props) {
  const pathname = usePathname();

  const role = profile.role as string;
  const displayName = getProfileDisplayName(profile);
  const initials = getProfileInitials(profile);
  const visibleItems = NAV_ITEMS.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(role);
  });

  return (
    <aside className={cn(
      "bg-charcoal flex flex-col w-64 flex-shrink-0",
      mobile ? "h-full" : "fixed inset-y-0 left-0 hidden lg:flex z-30"
    )}>
      {/* Top accent */}
      <div className="h-1 bg-gradient-to-r from-redline via-lawn to-redline flex-shrink-0" />

      {/* Logo */}
      <div className="px-5 py-5 flex items-center justify-between border-b border-white/10">
        <Link href="/dashboard">
          <Image
            src="/images/logo.png"
            alt="Redline"
            width={140}
            height={47}
            className="h-10 w-auto brightness-0 invert"
          />
        </Link>
        {mobile && (
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1" aria-label="Close menu">
            <span className="block text-xl leading-none">×</span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleItems.map(item => (
          <NavGroup key={item.label} item={item} pathname={pathname} />
        ))}
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-white/10 flex-shrink-0">
        <Link href="/settings/profile" className="flex items-center gap-3 group">
          <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={displayName}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full bg-redline flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {initials}
                </span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate group-hover:text-redline/90 transition-colors">
              {displayName}
            </p>
            <p className="text-xs text-gray-400 truncate capitalize">
              {profile.role.replace(/_/g, " ")}
            </p>
          </div>
        </Link>
      </div>
    </aside>
  );
}
