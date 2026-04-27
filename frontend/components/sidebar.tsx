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
      className="fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col border-r border-black/35 bg-[#f3f3f2]"
    >
      <div className="flex items-center gap-3 px-5 pb-4 pt-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-black text-base font-semibold text-black">
          RA
        </div>
        <p className="text-lg font-semibold leading-none tracking-tight text-black">RepoAI</p>
      </div>
      <div className="border-t border-black/25" />

      <nav className="flex-1 space-y-1.5 px-4 py-5">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link key={`${item.href}-${item.label}`} href={item.href}>
              <div
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-black transition-colors",
                  active
                    ? "border border-black bg-black text-white shadow-[0_1px_0_rgba(0,0,0,0.5)]"
                    : "border border-transparent hover:border-black/20 hover:bg-black/5",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-black/25" />

      <div className="px-4 py-4">
        <Link
          href="/settings"
          className={cn(
            "flex w-full items-center justify-center gap-2.5 rounded-lg border border-black/30 bg-[#f6f6f5] px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-black/5",
            pathname.startsWith("/settings") && "border-black bg-black text-white hover:bg-black",
          )}
        >
          <Settings className="h-[18px] w-[18px]" />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
