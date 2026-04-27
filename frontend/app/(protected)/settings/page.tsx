"use client";

import { CheckCircle2, ShieldCheck, UserCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";

export default function SettingsPage() {
  const { isAuthenticated, token, user } = useAuth();

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-[2rem] p-8">
        <p className="text-sm uppercase tracking-[0.4em] text-[color:var(--muted)]">
          Settings
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em]">
          Workspace and account settings
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-[color:var(--muted)]">
          Review the current signed-in account, provider, and local frontend session status.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0f1117] text-[#0d9488]">
                <UserCircle2 className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.04em]">
                  {user?.name ?? "RepoAI User"}
                </h2>
                <p className="text-sm text-[#64748b]">{user?.email ?? "No email loaded"}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="teal">{user?.provider ?? "LOCAL"}</Badge>
              <Badge variant={isAuthenticated ? "success" : "warning"}>
                {isAuthenticated ? "Authenticated" : "Signed out"}
              </Badge>
              {user?.githubConnected ? <Badge variant="accent">GitHub Connected</Badge> : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#0d9488]" />
                <h2 className="text-xl font-semibold tracking-[-0.04em]">Profile Details</h2>
              </div>
              <div className="grid gap-3 text-sm text-[#cbd5e1] md:grid-cols-2">
                <div className="rounded-2xl border border-[#1e2230] bg-[#0f1117] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#64748b]">Name</p>
                  <p className="mt-2">{user?.name ?? "Unknown"}</p>
                </div>
                <div className="rounded-2xl border border-[#1e2230] bg-[#0f1117] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#64748b]">Username</p>
                  <p className="mt-2">{user?.username ?? "Not available"}</p>
                </div>
                <div className="rounded-2xl border border-[#1e2230] bg-[#0f1117] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#64748b]">Provider</p>
                  <p className="mt-2">{user?.provider ?? "LOCAL"}</p>
                </div>
                <div className="rounded-2xl border border-[#1e2230] bg-[#0f1117] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-[#64748b]">User ID</p>
                  <p className="mt-2">{String(user?.id ?? "Unknown")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-[#0d9488]" />
                <h2 className="text-xl font-semibold tracking-[-0.04em]">Session Health</h2>
              </div>
              <div className="space-y-3 text-sm text-[#cbd5e1]">
                <div className="rounded-2xl border border-[#1e2230] bg-[#0f1117] px-4 py-3">
                  Frontend auth state: {isAuthenticated ? "active" : "inactive"}
                </div>
                <div className="rounded-2xl border border-[#1e2230] bg-[#0f1117] px-4 py-3">
                  Stored token: {token ? "present" : "missing"}
                </div>
                <div className="rounded-2xl border border-[#1e2230] bg-[#0f1117] px-4 py-3">
                  GitHub connection: {user?.githubConnected ? "connected" : "not connected"}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
