"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";
import { Menu, Bell, Search, LogOut, User, Settings, ChevronDown, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { getProfileDisplayName, getProfileInitials } from "@/lib/auth/profile-display";
import { toast } from "sonner";

interface Props {
  profile: Profile;
  onMenuClick: () => void;
}

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  action_url: string | null;
  created_at: string;
  read: boolean;
}

interface NotificationQueryClient {
  from(table: "notifications"): {
    select(
      columns: string,
      options?: { count?: "exact" }
    ): {
      eq(column: string, value: string | boolean): {
        eq(column: string, value: string | boolean): {
          order(column: string, options: { ascending: boolean }): {
            limit(count: number): Promise<{ data: NotificationItem[] | null; count: number | null; error: { message: string } | null }>;
          };
        };
        order(column: string, options: { ascending: boolean }): {
          limit(count: number): Promise<{ data: NotificationItem[] | null; count: number | null; error: { message: string } | null }>;
        };
      };
    };
    update(values: Record<string, unknown>): {
      eq(column: string, value: string | boolean): {
        eq(column: string, value: string | boolean): {
          select(columns: string): Promise<{ data: { id: string }[] | null; error: { message: string } | null }>;
        };
        select(columns: string): Promise<{ data: { id: string }[] | null; error: { message: string } | null }>;
      };
    };
  };
}

export default function TopBar({ profile, onMenuClick }: Props) {
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [alertError, setAlertError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const seenAlertIds = useRef(new Set<string>());
  const alertRevision = useRef(0);
  const displayName = getProfileDisplayName(profile);
  const initials = getProfileInitials(profile);

  const playAlertTone = useCallback(async () => {
    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return false;

      const ctx = audioRef.current ?? new AudioContextCtor();
      audioRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();
      if (ctx.state !== "running") return false;

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      oscillator.frequency.setValueAtTime(1175, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.35);
      return true;
    } catch {
      // Browser autoplay/audio policy can block this until the first user gesture.
      return false;
    }
  }, []);

  const primeAlertAudio = useCallback(async () => {
    try {
      const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const ctx = audioRef.current ?? new AudioContextCtor();
      audioRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();
    } catch {
      // Audio is optional; the persisted inbox remains the source of truth.
    }
  }, []);

  function showSystemNotification(notification: NotificationItem) {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const payload = {
      title: notification.title || "Redline alert",
      body: notification.body || "New alert",
      url: notification.action_url || "/dashboard",
      tag: notification.id,
    };

    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SHOW_NOTIFICATION",
        payload,
      });
      return;
    }

    new Notification(payload.title, {
      body: payload.body,
      icon: "/images/logo.png",
      data: { url: payload.url },
    });
  }

  useEffect(() => {
    function handleOnline() { setIsOnline(true); }
    function handleOffline() { setIsOnline(false); }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    const id = window.setTimeout(() => setIsOnline(navigator.onLine), 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    // Browsers require a user gesture before Web Audio can play. Any normal
    // interaction with the open portal can unlock subsequent alert tones.
    const unlock = () => { void primeAlertAudio(); };
    document.addEventListener("pointerdown", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, [primeAlertAudio]);

  useEffect(() => {
    const supabase = createClient();
    let checkedSince: string | null = null;
    let requestSequence = 0;
    let checkingNew = false;
    let initializing = false;
    let active = true;

    function announce(next: NotificationItem) {
      if (!next.id || next.read || seenAlertIds.current.has(next.id)) return false;
      seenAlertIds.current.add(next.id);
      setUnreadCount((count) => count + 1);
      setNotifications((items) => [next, ...items.filter((item) => item.id !== next.id)].slice(0, 10));
      void playAlertTone();
      showSystemNotification(next);
      toast.info(next.title || "New alert", { description: next.body });
      return true;
    }

    async function loadUnread() {
      const sequence = ++requestSequence;
      const revision = alertRevision.current;
      const { data, count, error } = await (supabase as unknown as NotificationQueryClient)
        .from("notifications")
        .select("id, title, body, action_url, created_at, read", { count: "exact" })
        .eq("user_id", profile.id)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!active || sequence !== requestSequence || revision !== alertRevision.current) return;
      if (error) {
        setAlertError("Alerts could not be refreshed. Retry when connected.");
        return;
      }
      setAlertError(null);

      setUnreadCount(count ?? 0);
      setNotifications((data ?? []) as NotificationItem[]);
    }

    async function checkNewAlerts() {
      if (!checkedSince || checkingNew || !active) return;
      checkingNew = true;
      const startingAt = checkedSince;
      let newest = startingAt;
      let offset = 0;
      let announced = false;
      try {
        while (active) {
          const { data, error } = await supabase.from("notifications")
            .select("id, title, body, action_url, created_at, read")
            .eq("user_id", profile.id)
            .gte("created_at", startingAt)
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(offset, offset + 99);
          if (!active) return;
          if (error) throw error;
          for (const item of data ?? []) {
            if (item.created_at > newest) newest = item.created_at;
            if (announce(item as NotificationItem)) announced = true;
          }
          if (!data || data.length < 100) break;
          offset += data.length;
        }
        checkedSince = newest;
        if (announced) router.refresh();
        await loadUnread();
      } catch {
        if (active) setAlertError("Alerts could not be refreshed. Retry when connected.");
      } finally {
        checkingNew = false;
      }
    }

    const channel = supabase
      .channel(`notifications:${profile.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` },
        (payload) => {
          const next = payload.new as NotificationItem;
          if (!active || !announce(next)) return;
          requestSequence++;
          router.refresh();
        }
      )
      .subscribe();

    async function initialize() {
      if (initializing || checkedSince || !active) return;
      initializing = true;
      // Baseline all alert states, not only unread ones. A previously read
      // alert must not ring again when the page first opens.
      try {
        const { data, error } = await supabase.from("notifications")
          .select("id, created_at")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(1);
        if (!active) return;
        if (error) throw error;
        if (data?.[0]) {
          checkedSince = data[0].created_at;
          seenAlertIds.current.add(data[0].id);
        } else {
          checkedSince = new Date().toISOString();
        }
        await loadUnread();
        // Reconcile anything inserted while realtime was connecting.
        await checkNewAlerts();
      } catch {
        if (active) setAlertError("Alerts could not be refreshed. Retry when connected.");
      } finally {
        initializing = false;
      }
    }

    void initialize();
    const interval = window.setInterval(() => {
      if (checkedSince) void checkNewAlerts();
      else void initialize();
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [profile.id, router, playAlertTone]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleNotificationClick(notification: NotificationItem) {
    const supabase = createClient();
    if (!notification.read) {
      const { data, error } = await (supabase as unknown as NotificationQueryClient)
        .from("notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("id", notification.id)
        .eq("user_id", profile.id)
        .select("id");
      if (error || !data?.some((row) => row.id === notification.id)) {
        setAlertError("Alert was not marked read. Retry from the alert list.");
        return;
      }
      alertRevision.current++;
      setAlertError(null);
      setNotifications((items) => items.filter((item) => item.id !== notification.id));
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    setNotificationsOpen(false);
    if (notification.action_url) router.push(notification.action_url);
  }

  async function markAllRead() {
    const supabase = createClient();
    const { data, error } = await (supabase as unknown as NotificationQueryClient)
      .from("notifications")
      .update({ read: true, read_at: new Date().toISOString() })
      .eq("user_id", profile.id)
      .eq("read", false)
      .select("id");
    if (error || (unreadCount > 0 && !data?.length)) {
      setAlertError("Alerts were not marked read. Retry when connected.");
      return;
    }
    alertRevision.current++;
    setAlertError(null);
    const readIds = new Set((data ?? []).map((row) => row.id));
    setNotifications((items) => items.filter((item) => !readIds.has(item.id)));
    setUnreadCount((count) => Math.max(0, count - readIds.size));
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Clear any PWA caches on logout
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.filter(n => n.startsWith("redline-pages") || n.includes("redline-app")).map(n => caches.delete(n)));
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

      {/* Scoped work search */}
      <form action="/search" className="flex-1 max-w-xl hidden sm:block">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            name="q"
            maxLength={100}
            aria-label="Search assigned work"
            placeholder="Search work orders…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-redline focus:ring-2 focus:ring-redline/20 outline-none transition-colors"
          />
        </div>
      </form>

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
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen((open) => !open);
              void primeAlertAudio();
            }}
            className="relative p-2 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            aria-haspopup="true"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 rounded-full bg-redline px-1 text-[10px] font-bold leading-4 text-white text-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-full mt-1 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
              <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-100">
                <div>
                  <p className="text-sm font-semibold text-charcoal">Alerts</p>
                  <p className="text-xs text-muted">{unreadCount} active</p>
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-xs font-semibold text-redline hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={async () => {
                  await primeAlertAudio();
                  const requested = await playAlertTone();
                  if (!requested) setAlertError("This browser blocked sound. Check site audio permission, then tap Test sound again.");
                  else setAlertError(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-redline hover:underline"
              >
                Test sound
              </button>

              {alertError && <p role="alert" className="px-4 py-2 text-xs text-red-700">{alertError}</p>}

              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm font-medium text-charcoal">No active alerts</p>
                    <p className="text-xs text-muted mt-1">New job alerts will appear here.</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-1.5 h-2 w-2 rounded-full bg-redline flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-charcoal leading-tight">{notification.title}</p>
                          <p className="text-xs text-muted mt-1 leading-snug">{notification.body}</p>
                          <p className="text-[11px] text-gray-400 mt-1">
                            {new Date(notification.created_at).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

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
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-charcoal leading-none">
                {displayName}
              </p>
            </div>
            <ChevronDown size={14} className="text-gray-400 hidden sm:block" />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-100 mb-1">
                <p className="text-sm font-medium text-charcoal">{displayName}</p>
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
