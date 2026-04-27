"use client";

import { Bell, Search } from "lucide-react";
import { useAuth } from "@/context/auth-context";

export function Topbar() {
  const { user } = useAuth();
  const initials = (user?.name ?? "JD")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="fixed right-0 top-0 z-40 h-16 border-b border-black/35 bg-[#f3f3f2] px-4 lg:left-[260px]">
      <div className="mx-auto flex h-full max-w-7xl items-center gap-4">
        <div className="relative w-full max-w-2xl flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/60" />
          <input
            type="search"
            className="h-10 w-full rounded-md border border-black/50 bg-[#fafafa] pl-10 pr-3 text-sm text-black outline-none placeholder:text-black/50 focus:border-black"
            placeholder="Search repositories..."
          />
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-black/80 transition-colors hover:border-black/25 hover:bg-black/5"
          >
            <Bell className="h-4 w-4" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-md border border-black/60 bg-[#fdfdfd] text-xs font-semibold text-black">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
