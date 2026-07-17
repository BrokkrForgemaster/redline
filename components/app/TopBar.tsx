"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";
import { Menu, Bell, Search, LogOut, User, Settings, ChevronDown, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface Props {
  profile: Profile;
  onMenuClick: () => void;
}

export default function TopBar({ profile, onMenuClick }: Props) {
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOnline() { setIsOnline(true); }
    function handleOffline() { setIsOnline(false); }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Clear any PWA caches on logout
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.filter(n => n.includes("redline-app")).map(n => caches.delete(n)));
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 bg-white border-b border-gray-200 flex items-center gap-4 px-4 md:px-6 h-16">
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
        aria-label="Open navigation menu"
      >
        <Menu size={20} />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-xl hidden sm:block">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search customers, jobs, invoices…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Online status */}
        <div className={cn(
          "hidden sm:flex items-center gap-1 text-xs px-2 py-1 rounded-full",
          isOnline ? "text-lawn bg-lawn/10" : "text-red-600 bg-red-50"
        )}>
          {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span className="font-medium">{isOnline ? "Online" : "Offline"}</span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-md text-gray-500 hover:bg-gray-100 transition-colors" aria-label="Notifications">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-redline rounded-full" />
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
          >
            <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={`${profile.first_name} ${profile.last_name}`}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-redline flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {profile.first_name[0]}{profile.last_name[0]}
                  </span>
                </div>
              )}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-charcoal leading-none">
                {profile.first_name} {profile.last_name}
              </p>
            </div>
            <ChevronDown size={14} className="text-gray-400 hidden sm:block" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-100 mb-1">
                <p className="text-sm font-medium text-charcoal">{profile.first_name} {profile.last_name}</p>
                <p className="text-xs text-muted">{profile.email}</p>
              </div>
              <Link
                href="/settings/profile"
                className="flex items-center gap-3 px-4 py-2 text-sm text-charcoal hover:bg-gray-50 transition-colors"
                onClick={() => setUserMenuOpen(false)}
              >
                <User size={15} className="text-gray-400" />
                My Profile
              </Link>
              <Link
                href="/settings/security"
                className="flex items-center gap-3 px-4 py-2 text-sm text-charcoal hover:bg-gray-50 transition-colors"
                onClick={() => setUserMenuOpen(false)}
              >
                <Settings size={15} className="text-gray-400" />
                Security & MFA
              </Link>
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={15} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
