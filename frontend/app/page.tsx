import {
  ArrowRight,
  Bot,
  Braces,
  FileText,
  GitBranch,
  Github,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

const workflowItems = [
  {
    icon: GitBranch,
    label: "Connect",
    text: "Bring in a repository and let RepoAI read the project structure.",
  },
  {
    icon: Bot,
    label: "Ask",
    text: "Chat with your codebase to understand modules, flows, and decisions.",
  },
  {
    icon: FileText,
    label: "Create",
    text: "Generate documentation and diagrams your team can actually use.",
  },
];

const codeLines = [
  "repoai.scan(repository)",
  "  .mapArchitecture()",
  "  .answerQuestions()",
  "  .exportDocs();",
];

export default function WelcomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f6fbff] text-[#10213f]">
      <section className="relative min-h-screen px-5 py-5 sm:px-8 lg:px-10">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(37,99,235,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.08)_1px,transparent_1px)] bg-[size:34px_34px]" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-white to-transparent" />

        <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-7xl flex-col">
          <header className="flex items-center justify-between gap-4 rounded-md border border-[#d7e7f7] bg-white/85 px-4 py-3 shadow-sm backdrop-blur">
            <Link href="/" className="inline-flex items-center gap-2 text-base font-black text-[#10213f]">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#2563eb] text-white">
                <Braces className="h-5 w-5" />
              </span>
              RepoAI
            </Link>
            <nav className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-bold text-[#52627a] transition hover:bg-[#edf6ff] hover:text-[#2563eb]"
              >
                Sign in
              </Link>
              <Link
                href="/login?mode=signup"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#2563eb] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#1d4ed8]"
              >
                Sign up
                <ArrowRight className="h-4 w-4" />
              </Link>
            </nav>
          </header>

          <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.02fr_0.98fr] lg:py-14">
            <section className="max-w-3xl space-y-7">
              <div className="inline-flex items-center gap-2 rounded-md border border-[#bde7d3] bg-[#ecfdf5] px-3 py-2 text-sm font-bold text-[#047857] shadow-sm">
                <Sparkles className="h-4 w-4" />
                AI workspace for real repositories
              </div>

              <div className="space-y-5">
                <h1 className="text-5xl font-black leading-[1.02] text-[#0b1b34] sm:text-6xl lg:text-7xl">
                  Understand your codebase before you touch it.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-[#52627a] sm:text-xl">
                  RepoAI helps you inspect repositories, ask project-specific questions,
                  generate documentation, and turn complex source code into clear diagrams.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login?mode=signup"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#2563eb] px-6 text-sm font-black text-white shadow-[0_18px_35px_rgba(37,99,235,0.22)] transition hover:bg-[#1d4ed8]"
                >
                  Start with RepoAI
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-[#d7e7f7] bg-white px-6 text-sm font-black text-[#172033] shadow-sm transition hover:border-[#38bdf8] hover:bg-[#f8fbff]"
                >
                  <Github className="h-5 w-5" />
                  Continue to login
                </Link>
              </div>
            </section>

            <section className="grid gap-4">
              <div className="rounded-md border border-[#d7e7f7] bg-white p-5 shadow-[0_28px_80px_rgba(37,99,235,0.16)]">
                <div className="flex items-center justify-between border-b border-[#e5eef8] pb-4">
                  <div>
                    <p className="text-sm font-bold text-[#0ea5e9]">Repository Insight</p>
                    <h2 className="mt-1 text-2xl font-black text-[#10213f]">repoai/backend</h2>
                  </div>
                  <span className="rounded-md bg-[#dcfce7] px-3 py-2 text-xs font-black text-[#15803d]">
                    Ready
                  </span>
                </div>

                <div className="mt-5 rounded-md bg-[#0f172a] p-5 font-mono text-sm text-[#c4d7ee]">
                  {codeLines.map((line) => (
                    <p key={line} className="leading-7">
                      <span className="mr-3 text-[#38bdf8]">&gt;</span>
                      {line}
                    </p>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {workflowItems.map((item) => {
                    const Icon = item.icon;

                    return (
                      <article
                        key={item.label}
                        className="rounded-md border border-[#e5eef8] bg-[#f8fbff] p-4"
                      >
                        <Icon className="h-5 w-5 text-[#2563eb]" />
                        <h3 className="mt-3 text-sm font-black text-[#10213f]">{item.label}</h3>
                        <p className="mt-2 text-sm leading-6 text-[#52627a]">{item.text}</p>
                      </article>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-[#d7e7f7] bg-white p-4 shadow-sm">
                  <p className="text-3xl font-black text-[#10213f]">4</p>
                  <p className="mt-1 text-sm font-semibold text-[#52627a]">core workspaces</p>
                </div>
                <div className="rounded-md border border-[#fde68a] bg-[#fffbeb] p-4 shadow-sm">
                  <p className="text-3xl font-black text-[#92400e]">AI</p>
                  <p className="mt-1 text-sm font-semibold text-[#785b16]">answers grounded in source code</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
