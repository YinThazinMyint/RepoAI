"use client";

import { useAuth } from "@/context/auth-context";
import Link from "next/link";
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
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <div className="glass-panel grid max-w-5xl overflow-hidden rounded-[2rem] lg:grid-cols-[1.1fr_0.9fr]">
        <section className="bg-[linear-gradient(160deg,rgba(13,148,136,0.9),rgba(124,58,237,0.82))] p-10 text-white">
          <p className="text-xs uppercase tracking-[0.4em] text-white/70">RepoAI</p>
          <h1 className="mt-6 text-5xl font-semibold tracking-[-0.05em]">
            Codebase intelligence for your whole team.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-white/82">
            Sign in with GitHub to upload repositories, generate diagrams, review docs,
            and ask the AI about any codebase you own.
          </p>
        </section>

        <section className="p-10">
          <p className="text-sm uppercase tracking-[0.35em] text-[color:var(--muted)]">
            Secure access
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em]">
            {mode === "login" ? "Login to RepoAI" : "Create your account"}
          </h2>
          <p className="mt-4 text-sm leading-7 text-[color:var(--muted)]">
            Use email and password for manual access, or continue with Google or GitHub.
          </p>

          <div className="mt-8 flex rounded-2xl bg-[color:var(--ring)] p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold ${
                mode === "login" ? "bg-[color:var(--foreground)] text-white" : ""
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold ${
                mode === "signup" ? "bg-[color:var(--foreground)] text-white" : ""
              }`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "signup" ? (
              <>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
                />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Username"
                  className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
                />
              </>
            ) : null}

            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--panel-strong)] px-4 py-3 outline-none"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-[color:var(--foreground)] px-5 py-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {isSubmitting
                ? "Please wait..."
                : mode === "login"
                  ? "Login with Email"
                  : "Create Account"}
            </button>
          </form>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => loginWithProvider("github")}
              className="rounded-2xl border border-[color:var(--border)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--ring)]"
            >
              Continue with GitHub
            </button>
            <button
              type="button"
              onClick={() => loginWithProvider("google")}
              className="rounded-2xl border border-[color:var(--border)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--ring)]"
            >
              Continue with Google
            </button>
          </div>

          {error ? (
            <p className="mt-4 rounded-2xl bg-rose-500/15 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </p>
          ) : null}

          <p className="mt-6 text-sm text-[color:var(--muted)]">
            Social login uses the backend OAuth routes, while manual login uses the JWT auth API.
          </p>

          <p className="mt-4 text-sm text-[color:var(--muted)]">
            Need backend setup first? Point{" "}
            <code className="rounded bg-[color:var(--ring)] px-2 py-1">
              NEXT_PUBLIC_API_URL
            </code>{" "}
            to your Spring Boot API.
          </p>

          <Link href="/upload" className="mt-8 inline-block text-sm font-semibold text-[color:var(--accent)]">
            Continue to upload flow
          </Link>
        </section>
      </div>
    </main>
  );
}
