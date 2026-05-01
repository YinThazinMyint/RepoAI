"use client";

import { Topbar } from "@/components/topbar";
import { Sidebar } from "@/components/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-shell min-h-screen bg-[#eef7ff] text-[#172033]">
      <Sidebar />
      <Topbar />
      <main className="px-4 pb-10 pt-24 transition-all md:px-6 lg:ml-[260px]">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
