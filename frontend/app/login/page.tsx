"use client";

import { useAuth } from "@/context/auth-context";
import { Github, Lock, Mail, User, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithProvider, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup({ email, name, password, username });
      }
      router.push("/dashboard");
    } catch (submissionError) {
      console.error(submissionError);
      setError(mode === "login" ? "Login failed." : "Sign up failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#eef7ff] px-5 py-8 text-[#172033]">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-[#2563eb] shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
            RepoAI
          </div>
          <div className="space-y-4">
            <h1 className="max-w-xl text-5xl font-bold leading-tight text-[#10213f] md:text-6xl">
              Welcome to your codebase workspace.
            </h1>
            <p className="max-w-lg text-lg leading-8 text-[#52627a]">
              Upload repositories, ask AI questions, create documentation, and generate clean diagrams from real source code.
            </p>
          </div>
          <div className="grid max-w-xl gap-3 sm:grid-cols-3">
            {["Chat", "Docs", "Diagrams"].map((item) => (
              <div key={item} className="rounded-md bg-white px-4 py-3 text-sm font-semibold text-[#172033] shadow-sm">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-[#d7e7f7] bg-white p-6 shadow-[0_24px_70px_rgba(37,99,235,0.16)] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0ea5e9]">
                Secure Access
              </p>
              <h2 className="mt-2 text-3xl font-bold text-[#10213f]">
                {mode === "login" ? "Sign in" : "Sign up"}
              </h2>
            </div>
            <div className="rounded-md bg-[#e0f2fe] px-3 py-2 text-sm font-semibold text-[#0369a1]">
              {mode === "login" ? "Welcome back" : "New account"}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 rounded-md bg-[#edf6ff] p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`rounded-md px-4 py-3 text-sm font-semibold transition ${
                mode === "login" ? "bg-[#2563eb] text-white shadow-sm" : "text-[#52627a] hover:bg-white"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`rounded-md px-4 py-3 text-sm font-semibold transition ${
                mode === "signup" ? "bg-[#2563eb] text-white shadow-sm" : "text-[#52627a] hover:bg-white"
              }`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" ? (
              <>
                <label className="relative block">
                  <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8]" />
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Full name"
                    className="h-12 w-full rounded-md border border-[#d7e7f7] bg-[#f8fbff] pl-12 pr-4 text-[#172033] outline-none transition placeholder:text-[#8a9ab0] focus:border-[#38bdf8] focus:bg-white"
                  />
                </label>
                <label className="relative block">
                  <UserPlus className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8]" />
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Username"
                    className="h-12 w-full rounded-md border border-[#d7e7f7] bg-[#f8fbff] pl-12 pr-4 text-[#172033] outline-none transition placeholder:text-[#8a9ab0] focus:border-[#38bdf8] focus:bg-white"
                  />
                </label>
              </>
            ) : null}

            <label className="relative block">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                className="h-12 w-full rounded-md border border-[#d7e7f7] bg-[#f8fbff] pl-12 pr-4 text-[#172033] outline-none transition placeholder:text-[#8a9ab0] focus:border-[#38bdf8] focus:bg-white"
              />
            </label>
            <label className="relative block">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                className="h-12 w-full rounded-md border border-[#d7e7f7] bg-[#f8fbff] pl-12 pr-4 text-[#172033] outline-none transition placeholder:text-[#8a9ab0] focus:border-[#38bdf8] focus:bg-white"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-12 w-full items-center justify-center rounded-md bg-[#2563eb] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#1d4ed8] disabled:opacity-60"
            >
              {isSubmitting
                ? "Please wait..."
                : mode === "login"
                  ? "Sign in with email"
                  : "Create account"}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#8a9ab0]">
            <span className="h-px flex-1 bg-[#d7e7f7]" />
            or
            <span className="h-px flex-1 bg-[#d7e7f7]" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => loginWithProvider("github")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-[#d7e7f7] bg-white px-4 text-sm font-bold text-[#172033] transition hover:border-[#2563eb] hover:bg-[#f0f7ff]"
            >
              <Github className="h-5 w-5" />
              GitHub
            </button>
            <button
              type="button"
              onClick={() => loginWithProvider("google")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-[#d7e7f7] bg-white px-4 text-sm font-bold text-[#172033] transition hover:border-[#f59e0b] hover:bg-[#fff8e6]"
            >
              <span className="text-lg font-black text-[#ea4335]">G</span>
              Google
            </button>
          </div>

          {error ? (
            <p className="mt-4 rounded-md bg-[#fee2e2] px-4 py-3 text-sm font-medium text-[#b91c1c]">
              {error}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
