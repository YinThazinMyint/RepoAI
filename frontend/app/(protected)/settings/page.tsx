"use client";

import { AxiosError } from "axios";
import { Eye, EyeOff, KeyRound, LogOut, ShieldCheck, UserCircle2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/auth-context";
import { axiosInstance } from "@/lib/api";

export default function SettingsPage() {
  const { isAuthenticated, logout, user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handlePasswordUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordMessage(null);

    if (!newPassword || !confirmPassword) {
      setPasswordError("New password and confirmation are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 72) {
      setPasswordError("Password must be between 8 and 72 characters.");
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPasswordError("Password must include at least one letter and one number, for example repoai2026.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await axiosInstance.post("/user/password", {
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password updated successfully.");
    } catch (error) {
      const apiMessage =
        error instanceof AxiosError && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : null;
      setPasswordError(apiMessage ?? "Password could not be updated.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

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
                  <p className="text-xs uppercase tracking-[0.18em] text-[#8a9ab0]">Email</p>
                  <p className="mt-2 break-words">{user?.email ?? "No email loaded"}</p>
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

          <Card className="mt-4">
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[#2563eb]" />
                <h2 className="text-xl font-bold tracking-tight text-[#10213f]">Update Password</h2>
              </div>

              <form onSubmit={handlePasswordUpdate} className="space-y-3">
                <label className="block">
                  <span className="text-sm font-semibold text-[#10213f]">Current password</span>
                  <div className="relative mt-2">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      placeholder="Required for local password accounts"
                      className="h-11 w-full rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-3 pr-11 text-sm text-[#172033] outline-none placeholder:text-[#8a9ab0] focus:border-[#38bdf8] focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] transition hover:text-[#2563eb]"
                      aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                      title={showCurrentPassword ? "Hide current password" : "Show current password"}
                    >
                      {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#10213f]">New password</span>
                  <div className="relative mt-2">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="8-72 characters, include a letter and number"
                      className="h-11 w-full rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-3 pr-11 text-sm text-[#172033] outline-none placeholder:text-[#8a9ab0] focus:border-[#38bdf8] focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] transition hover:text-[#2563eb]"
                      aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                      title={showNewPassword ? "Hide new password" : "Show new password"}
                    >
                      {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#10213f]">Confirm new password</span>
                  <div className="relative mt-2">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Re-enter new password"
                      className="h-11 w-full rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-3 pr-11 text-sm text-[#172033] outline-none placeholder:text-[#8a9ab0] focus:border-[#38bdf8] focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b] transition hover:text-[#2563eb]"
                      aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}
                      title={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </label>

                {passwordError ? (
                  <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {passwordError}
                  </p>
                ) : null}
                {passwordMessage ? (
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    {passwordMessage}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="inline-flex w-full items-center justify-center rounded-md bg-[#2563eb] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUpdatingPassword ? "Updating..." : "Update Password"}
                </button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
