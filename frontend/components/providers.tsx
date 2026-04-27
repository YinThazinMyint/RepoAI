"use client";

import { AuthProvider } from "@/context/auth-context";
import { useEffect, useState } from "react";
import { AppShellProvider } from "@/hooks/use-app-shell";

export function Providers({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") {
      return "dark";
    }

    const savedTheme = window.localStorage.getItem("repoai.theme");
    return savedTheme === "dark" || savedTheme === "light" ? savedTheme : "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("repoai.theme", theme);
  }, [theme]);

  return (
    <AuthProvider>
      <AppShellProvider theme={theme} setTheme={setTheme}>
        <div data-theme={theme} className="min-h-screen" suppressHydrationWarning>
          {children}
        </div>
      </AppShellProvider>
    </AuthProvider>
  );
}
