"use client";

import { cn } from "@/lib/utils";

type Tab = {
  content: React.ReactNode;
  id: string;
  label: string;
};

export function TabView({
  activeTab,
  onChange,
  tabs,
}: {
  activeTab: string;
  onChange: (id: string) => void;
  tabs: Tab[];
}) {
  const currentTab = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className="space-y-5">
      <div className="glass-panel flex flex-wrap gap-2 rounded-3xl p-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "rounded-2xl px-4 py-3 text-sm font-semibold transition",
              tab.id === currentTab.id
                ? "bg-[color:var(--primary)] text-white"
                : "text-[color:var(--muted)] hover:bg-[color:var(--ring)]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div>{currentTab.content}</div>
    </div>
  );
}
