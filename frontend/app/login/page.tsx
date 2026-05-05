"use client";

import { useAuth } from "@/context/auth-context";
import { AxiosError } from "axios";
import { Eye, EyeOff, Github, Lock, Mail, User, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const emailPattern = /^[^\s@]+@(gmail\.com|email\.com)$/i;
const usernamePattern = /^[a-zA-Z0-9_]{3,30}$/;

type FieldErrors = {
  email?: string[];
  form?: string[];
  name?: string[];
  password?: string[];
  username?: string[];
};

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithProvider, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("mode") === "signup") {
      setMode("signup");
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    const validationMessages = validateAuthForm();
    if (hasFieldErrors(validationMessages)) {
      setErrors(validationMessages);
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup({ email, name, password, username });
      }
      const searchParams = new URLSearchParams(window.location.search);
      const nextPath = searchParams.get("next");
      router.push(nextPath?.startsWith("/") ? nextPath : "/dashboard");
    } catch (submissionError) {
      console.error(submissionError);
      const apiMessage =
        submissionError instanceof AxiosError && typeof submissionError.response?.data?.message === "string"
          ? submissionError.response.data.message
          : null;
      setErrors({ form: [apiMessage ?? (mode === "login" ? "Login failed." : "Sign up failed.")] });
    } finally {
      setIsSubmitting(false);
    }
  };

  const validateAuthForm = () => {
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    const trimmedUsername = username.trim();
    const validationMessages: FieldErrors = {};

    if (mode === "signup" && !trimmedName) {
      addFieldError(validationMessages, "name", "Full name is required and must be 2-80 characters.");
    }
    if (mode === "signup" && !trimmedUsername) {
      addFieldError(validationMessages, "username", "Username is required. Use 3-30 letters, numbers, or underscores, for example dev_user1.");
    }
    if (!trimmedEmail) {
      addFieldError(validationMessages, "email", "Email is required. Use a Gmail or Email.com address, for example name@gmail.com.");
    } else if (!emailPattern.test(trimmedEmail)) {
      addFieldError(validationMessages, "email", "Email must use gmail.com or email.com, for example name@gmail.com or name@email.com.");
    }
    if (!password) {
      addFieldError(
        validationMessages,
        "password",
        mode === "signup"
          ? "Password is required. Use 8-72 characters with at least one letter and one number."
          : "Password is required.",
      );
    }

    if (mode === "signup") {
      if (trimmedName && (trimmedName.length < 2 || trimmedName.length > 80)) {
        addFieldError(validationMessages, "name", "Full name must be between 2 and 80 characters.");
      }

      if (trimmedUsername && !usernamePattern.test(trimmedUsername)) {
        addFieldError(validationMessages, "username", "Username format is invalid. Use only letters, numbers, and underscores, for example dev_user1.");
      }

      if (password && (password.length < 8 || password.length > 72)) {
        addFieldError(validationMessages, "password", "Password must be between 8 and 72 characters.");
      }

      if (password && (!/[A-Za-z]/.test(password) || !/\d/.test(password))) {
        addFieldError(validationMessages, "password", "Password must include at least one letter and one number, for example repoai2026.");
      }
    }

    return validationMessages;
  };

  const addFieldError = (fieldErrors: FieldErrors, field: keyof FieldErrors, message: string) => {
    fieldErrors[field] = [...new Set([...(fieldErrors[field] ?? []), message])];
  };

  const hasFieldErrors = (fieldErrors: FieldErrors) =>
    Object.values(fieldErrors).some((messages) => messages && messages.length > 0);

  const renderFieldErrors = (field: keyof FieldErrors) =>
    errors[field]?.length ? (
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs font-medium text-[#b91c1c]">
        {errors[field].map((validationError) => (
          <li key={validationError}>{validationError}</li>
        ))}
      </ul>
    ) : null;

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
              onClick={() => {
                setMode("login");
                setErrors({});
              }}
              className={`rounded-md px-4 py-3 text-sm font-semibold transition ${
                mode === "login" ? "bg-[#2563eb] text-white shadow-sm" : "text-[#52627a] hover:bg-white"
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setErrors({});
              }}
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
                    minLength={2}
                    maxLength={80}
                    className={`h-12 w-full rounded-md border bg-[#f8fbff] pl-12 pr-4 text-[#172033] outline-none transition placeholder:text-[#8a9ab0] focus:border-[#38bdf8] focus:bg-white ${
                      errors.name?.length ? "border-[#ef4444]" : "border-[#d7e7f7]"
                    }`}
                  />
                  {renderFieldErrors("name")}
                </label>
                <label className="relative block">
                  <UserPlus className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8]" />
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Username"
                    minLength={3}
                    maxLength={30}
                    pattern="[a-zA-Z0-9_]+"
                    className={`h-12 w-full rounded-md border bg-[#f8fbff] pl-12 pr-4 text-[#172033] outline-none transition placeholder:text-[#8a9ab0] focus:border-[#38bdf8] focus:bg-white ${
                      errors.username?.length ? "border-[#ef4444]" : "border-[#d7e7f7]"
                    }`}
                  />
                  {renderFieldErrors("username")}
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
                maxLength={254}
                className={`h-12 w-full rounded-md border bg-[#f8fbff] pl-12 pr-4 text-[#172033] outline-none transition placeholder:text-[#8a9ab0] focus:border-[#38bdf8] focus:bg-white ${
                  errors.email?.length ? "border-[#ef4444]" : "border-[#d7e7f7]"
                }`}
              />
              {renderFieldErrors("email")}
            </label>
            <label className="relative block">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#94a3b8]" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                minLength={mode === "signup" ? 8 : undefined}
                maxLength={72}
                className={`h-12 w-full rounded-md border bg-[#f8fbff] pl-12 pr-12 text-[#172033] outline-none transition placeholder:text-[#8a9ab0] focus:border-[#38bdf8] focus:bg-white ${
                  errors.password?.length ? "border-[#ef4444]" : "border-[#d7e7f7]"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-4 top-6 -translate-y-1/2 text-[#64748b] transition hover:text-[#2563eb]"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
              {renderFieldErrors("password")}
            </label>

            {mode === "signup" ? (
              <div className="rounded-md bg-[#f0f7ff] px-4 py-3 text-xs leading-5 text-[#52627a]">
                Passwords must be 8-72 characters and include at least one letter and one number.
                Usernames can use letters, numbers, and underscores.
              </div>
            ) : null}

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

          {errors.form?.length ? (
            <div className="mt-4 rounded-md bg-[#fee2e2] px-4 py-3 text-sm font-medium text-[#b91c1c]">
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {errors.form.map((validationError) => (
                  <li key={validationError}>{validationError}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
