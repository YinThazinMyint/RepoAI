"use client";

import { LogOut, ShieldCheck, UserCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";

export default function SettingsPage() {
  const { isAuthenticated, logout, user } = useAuth();

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-[#d7e7f7] bg-white p-8 text-[#172033] shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0ea5e9]">
          Settings
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-[#10213f]">
          Workspace and account settings
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-[#52627a]">
          Review the current signed-in account and connected provider.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-md bg-[#e0f2fe] text-[#2563eb]">
                <UserCircle2 className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-[#10213f]">
                  {user?.name ?? "RepoAI User"}
                </h2>
                <p className="text-sm text-[#52627a]">{user?.email ?? "No email loaded"}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="teal">{user?.provider ?? "LOCAL"}</Badge>
              <Badge variant={isAuthenticated ? "success" : "warning"}>
                {isAuthenticated ? "Authenticated" : "Signed out"}
              </Badge>
              {user?.githubConnected ? <Badge variant="accent">GitHub Connected</Badge> : null}
            </div>

            <button
              type="button"
              onClick={logout}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </CardContent>
        </Card>

        <div>
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#0d9488]" />
                <h2 className="text-xl font-bold tracking-tight text-[#10213f]">Profile Details</h2>
              </div>
              <div className="grid gap-3 text-sm text-[#172033] md:grid-cols-2">
                <div className="rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8a9ab0]">Name</p>
                  <p className="mt-2">{user?.name ?? "Unknown"}</p>
                </div>
                <div className="rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8a9ab0]">Username</p>
                  <p className="mt-2">{user?.username ?? "Not available"}</p>
                </div>
                <div className="rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8a9ab0]">Provider</p>
                  <p className="mt-2">{user?.provider ?? "LOCAL"}</p>
                </div>
                <div className="rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8a9ab0]">GitHub Connection</p>
                  <p className="mt-2">{user?.githubConnected ? "Connected" : "Not connected"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
