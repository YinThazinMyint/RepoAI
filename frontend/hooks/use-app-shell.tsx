"use client";

import { createContext, useContext, useMemo, useState } from "react";

type AppShellContextValue = {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (value: boolean) => void;
  theme: "dark" | "light";
  toggleSidebar: () => void;
  toggleTheme: () => void;
};

const AppShellContext = createContext<AppShellContextValue | undefined>(undefined);

export function AppShellProvider({
  children,
  setTheme,
  theme,
}: {
  children: React.ReactNode;
  setTheme: (value: "dark" | "light" | ((current: "dark" | "light") => "dark" | "light")) => void;
  theme: "dark" | "light";
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const value = useMemo<AppShellContextValue>(
    () => ({
      isSidebarCollapsed,
      setIsSidebarCollapsed,
      theme,
      toggleSidebar: () => setIsSidebarCollapsed((current) => !current),
      toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark")),
    }),
    [isSidebarCollapsed, setTheme, theme],
  );

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell() {
  const context = useContext(AppShellContext);
  if (!context) {
    throw new Error("useAppShell must be used within AppShellProvider.");
  }

  return context;
}
