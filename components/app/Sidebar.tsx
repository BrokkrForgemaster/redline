"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { Profile } from "@/types/database";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard, Users, Building2, FileText, ClipboardList,
  Calendar, Snowflake, MapPin, Receipt, Package, Truck, Store,
  ShoppingCart, UserCog, Users2, Clock, Image as ImageIcon,
  BarChart3, Settings, Shield, X, ChevronDown
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: { label: string; href: string }[];
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: ClipboardList, roles: ["owner","administrator","operations_manager","office_manager","estimator"] },
  { label: "Customers", href: "/customers", icon: Users },
  { label: "Properties", href: "/properties", icon: Building2 },
  {
    label: "Sales",
    icon: FileText,
    children: [
      { label: "Estimates", href: "/estimates" },
      { label: "Contracts", href: "/contracts" },
    ],
  },
  {
    label: "Operations",
    icon: Calendar,
    children: [
      { label: "Jobs", href: "/jobs" },
      { label: "Calendar", href: "/calendar" },
      { label: "Crews", href: "/crews" },
      { label: "Time Tracking", href: "/time-tracking" },
    ],
  },
  {
    label: "Snow",
    icon: Snowflake,
    children: [
      { label: "Snow Events", href: "/snow-events" },
      { label: "Routes", href: "/routes" },
    ],
  },
  {
    label: "Finance",
    icon: Receipt,
    children: [
      { label: "Invoices", href: "/invoices" },
      { label: "Payments", href: "/payments" },
    ],
    roles: ["owner","administrator","office_manager","bookkeeper"],
  },
  {
    label: "Inventory",
    icon: Package,
    children: [
      { label: "Products", href: "/inventory" },
      { label: "Purchase Orders", href: "/purchase-orders" },
      { label: "Suppliers", href: "/suppliers" },
    ],
  },
  {
    label: "Equipment",
    icon: Truck,
    children: [
      { label: "All Assets", href: "/equipment" },
      { label: "Vehicles", href: "/vehicles" },
    ],
  },
  { label: "Employees", href: "/employees", icon: UserCog, roles: ["owner","administrator","operations_manager","office_manager"] },
  { label: "Gallery", href: "/media", icon: ImageIcon },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Audit Logs", href: "/audit-logs", icon: Shield, roles: ["owner","administrator"] },
  { label: "Settings", href: "/settings", icon: Settings, roles: ["owner","administrator"] },
];

interface Props {
  profile: Profile;
  mobile?: boolean;
  onClose?: () => void;
}

function NavGroup({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = item.children?.some(c => pathname.startsWith(c.href)) ||
    (item.href && pathname.startsWith(item.href));
  const [open, setOpen] = useState(isActive);

  if (item.href && !item.children) {
    return (
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
            ? "bg-redline text-white"
            : "text-gray-300 hover:bg-white/10 hover:text-white"
        )}
      >
        <item.icon size={18} className="flex-shrink-0" />
        {item.label}
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          isActive ? "text-white" : "text-gray-300 hover:bg-white/10 hover:text-white"
        )}
      >
        <item.icon size={18} className="flex-shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown size={14} className={cn("transition-transform", open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div className="ml-7 mt-1 space-y-1">
          {item.children?.map(child => (
            <Link
              key={child.href}
              href={child.href}
              className={cn(
                "block px-3 py-1.5 rounded-md text-sm transition-colors",
                pathname.startsWith(child.href)
                  ? "bg-redline/20 text-redline font-medium"
                  : "text-gray-400 hover:text-white hover:bg-white/10"
              )}
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ profile, mobile, onClose }: Props) {
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter(item =>
    !item.roles || item.roles.includes(profile.role)
  );

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
            <X size={20} />
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
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-redline flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">
              {profile.first_name[0]}{profile.last_name[0]}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {profile.first_name} {profile.last_name}
            </p>
            <p className="text-xs text-gray-400 truncate capitalize">
              {profile.role.replace(/_/g, " ")}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
