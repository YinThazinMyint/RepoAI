"use client";

import Link from "next/link";
import {
  BookOpen,
  GitBranch,
  LayoutGrid,
  MessageSquare,
  Settings,
  Sparkles,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navigationItems = [
  { href: "/dashboard", icon: LayoutGrid, label: "Dashboard" },
  { href: "/repositories", icon: GitBranch, label: "Repositories" },
  { href: "/ai-tools", icon: MessageSquare, label: "AI Chat" },
  { href: "/documentation", icon: BookOpen, label: "Documentation" },
  { href: "/diagrams", icon: Sparkles, label: "Diagrams" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col border-r border-[#d7e7f7] bg-white shadow-[12px_0_40px_rgba(37,99,235,0.08)]"
    >
      <div className="flex items-center gap-3 px-5 pb-4 pt-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#2563eb] text-base font-bold text-white shadow-sm">
          RA
        </div>
        <div>
          <p className="text-lg font-bold leading-none tracking-tight text-[#10213f]">RepoAI</p>
          <p className="mt-1 text-xs font-semibold text-[#0ea5e9]">Code intelligence</p>
        </div>
      </div>
      <div className="border-t border-[#d7e7f7]" />

      <nav className="flex-1 space-y-1.5 px-4 py-5">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link key={`${item.href}-${item.label}`} href={item.href}>
              <div
                className={cn(
                  "relative flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-[#52627a] transition-colors",
                  active
                    ? "bg-[#2563eb] text-white shadow-sm"
                    : "hover:bg-[#edf6ff] hover:text-[#2563eb]",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[#d7e7f7]" />

      <div className="px-4 py-4">
        <Link
          href="/settings"
          className={cn(
            "flex w-full items-center justify-center gap-2.5 rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-4 py-2.5 text-sm font-semibold text-[#52627a] transition-colors hover:border-[#38bdf8] hover:text-[#2563eb]",
            pathname.startsWith("/settings") && "border-[#2563eb] bg-[#2563eb] text-white hover:bg-[#1d4ed8] hover:text-white",
          )}
        >
          <Settings className="h-[18px] w-[18px]" />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
