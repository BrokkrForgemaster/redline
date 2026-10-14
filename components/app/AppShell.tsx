"use client";

import { useState } from "react";
import type { Profile } from "@/types/database";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import MobileNav from "./MobileNav";
import { Toaster } from "sonner";

interface Props {
  profile: Profile;
  children: React.ReactNode;
}

export default function AppShell({ profile, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-gray-50 flex overflow-x-hidden">
      {/* Desktop Sidebar */}
      <Sidebar profile={profile} />

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar Panel */}
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar profile={profile} mobile onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        <TopBar
          key={profile.id}
          profile={profile}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 pb-28 md:p-6 md:pb-10 lg:p-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <MobileNav profile={profile} />

      <Toaster richColors position="top-right" />
    </div>
  );
}
