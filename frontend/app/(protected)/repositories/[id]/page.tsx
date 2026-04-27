"use client";

import ReactMarkdown from "react-markdown";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  FileCode2,
  FileText,
  GitBranch,
  Network,
  Puzzle,
  Send,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import { StatusBadge } from "@/components/status-badge";
import { axiosInstance } from "@/lib/api";
import { AxiosError } from "axios";
import type { AIMessage, RepoDocument, RepositoryDetail } from "@/lib/types";
import { downloadTextFile, formatDate } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

const generationCards = [
  {
    description: "High-level documentation",
    icon: FileText,
    title: "Project Overview",
  },
  {
    description: "Endpoints & interfaces",
    icon: FileText,
    title: "API Documentation",
  },
  {
    description: "Module-by-module breakdown",
    icon: Puzzle,
    title: "Module Docs",
  },
  {
    description: "Code logic flow",
    icon: Waypoints,
    title: "Flowchart",
  },
  {
    description: "System architecture diagram",
    icon: Network,
    title: "Architecture",
  },
  {
    description: "Request/response flows",
    icon: GitBranch,
    title: "Sequence Diagram",
  },
] as const;

export default function RepositoryDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<RepositoryDetail | null>(null);
  const [activeTab, setActiveTab] = useState("chat");
  const [activeDocId, setActiveDocId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const repoId = params.id ?? "1";

  useEffect(() => {
    setIsLoading(true);
    setErrorMessage(null);
    void axiosInstance
      .get<RepositoryDetail>(`/repositories/${repoId}`)
      .then((response) => setDetail(response.data))
      .catch(() => {
        setDetail(null);
        setErrorMessage(`Repository ${repoId} could not be loaded. Please restart the backend and try again.`);
      })
      .finally(() => setIsLoading(false));
  }, [repoId]);

  const selectedDoc =
    detail?.docs.find((doc) => doc.id === activeDocId) ?? detail?.docs[0] ?? null;

  const techTags = useMemo(() => {
    if (!detail) {
      return [];
    }

    const rawTechStack = detail.repository.techStack as string | string[] | undefined;

    if (Array.isArray(rawTechStack)) {
      return rawTechStack;
    }

    if (typeof rawTechStack === "string" && rawTechStack.trim()) {
      return rawTechStack
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return detail.repository.language ? [detail.repository.language] : [];
  }, [detail]);

  const submitQuestion = async () => {
    if (!detail || !message.trim()) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await axiosInstance.post<AIMessage>(
        `/repositories/${repoId}/questions`,
        { questionText: message },
      );
      setDetail((current) => current ? ({
        ...current,
        questions: [response.data, ...current.questions],
      }) : current);
      setMessage("");
    } catch (error) {
      const apiMessage =
        error instanceof AxiosError && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : null;
      setErrorMessage(apiMessage ?? "The question could not be sent. Please check the backend, OpenAI key, and pgvector setup.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateDocumentation = async (title: string) => {
    if (!detail) {
      return;
    }

    if (!["Project Overview", "API Documentation", "Module Docs"].includes(title)) {
      setActiveTab("diagrams");
      return;
    }

    setIsGeneratingDoc(true);
    setErrorMessage(null);
    try {
      const response = await axiosInstance.post<RepoDocument>(
        `/repositories/${repoId}/documentation`,
        { documentationType: title },
      );
      setDetail((current) =>
        current
          ? {
              ...current,
              docs: [response.data, ...current.docs],
            }
          : current,
      );
      setActiveDocId(response.data.id);
      setActiveTab("docs");
    } catch (error) {
      const apiMessage =
        error instanceof AxiosError && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : null;
      setErrorMessage(apiMessage ?? `${title} could not be generated.`);
    } finally {
      setIsGeneratingDoc(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-[2rem] border border-[#1e2230] bg-[#13161e] p-7 text-sm text-[#94a3b8]">
        Loading repository {repoId}...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-5">
        <Link
          href="/repositories"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#64748b] transition hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Repositories
        </Link>
        <div className="rounded-[2rem] border border-red-500/40 bg-[#13161e] p-7 text-sm text-red-200">
          {errorMessage ?? `Repository ${repoId} could not be loaded.`}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/repositories"
        className="inline-flex items-center gap-2 text-sm font-medium text-[#64748b] transition hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Repositories
      </Link>

      <section className="rounded-[2rem] border border-[#1e2230] bg-[#13161e] p-7 shadow-[0_12px_40px_rgba(0,0,0,0.24)]">
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-[1.6rem] bg-[#0d9488]/12 text-[#5eead4]">
            <FileCode2 className="h-8 w-8" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="text-3xl font-semibold tracking-[-0.05em] text-slate-50 md:text-4xl">
                {detail.repository.name}
              </h1>
              <StatusBadge status={detail.repository.status} />
            </div>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#94a3b8]">
              <span>{detail.repository.language || "Unknown language"}</span>
              <span>
                {detail.repository.fileCount ? `${detail.repository.fileCount} files` : "Files not scanned yet"}
              </span>
              <span>
                {detail.repository.linesOfCode
                  ? `${detail.repository.linesOfCode.toLocaleString()} lines`
                  : "Line count pending"}
              </span>
              <span>Added {formatDate(detail.repository.createdAt)}</span>
            </div>

            {techTags.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {techTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[#2a3144] bg-[#0f1117] px-3 py-1 text-sm text-slate-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 rounded-[1.2rem] border border-[#1e2230] bg-[#13161e] p-2">
        {[
          { id: "chat", icon: Bot, label: `AI Chat` },
          { id: "docs", icon: FileText, label: `Docs (${detail.docs.length})` },
          { id: "diagrams", icon: GitBranch, label: `Diagrams (${detail.diagrams.length})` },
        ].map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-[#0f1117] text-slate-50 shadow-[inset_0_0_0_1px_#2a3144]"
                  : "text-[#94a3b8] hover:bg-[#171b24] hover:text-slate-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_0.75fr]">
        <section className="rounded-[2rem] border border-[#1e2230] bg-[#13161e] p-7 shadow-[0_12px_40px_rgba(0,0,0,0.24)]">
          {activeTab === "chat" ? (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-[#5eead4]" />
                  <h2 className="text-3xl font-semibold tracking-[-0.04em] text-slate-50">
                    Ask AI
                  </h2>
                </div>

                <div className="mt-5 flex gap-3">
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={3}
                    placeholder="Ask anything about this codebase..."
                    className="min-h-[74px] flex-1 rounded-[1.2rem] border border-[#2a3144] bg-[#0f1117] px-4 py-4 text-sm text-slate-100 outline-none placeholder:text-[#64748b] focus:border-[#0d9488]"
                  />
                  <button
                    type="button"
                    onClick={submitQuestion}
                    disabled={isSubmitting}
                    className="mt-auto inline-flex h-12 w-12 items-center justify-center rounded-[1rem] bg-[#7dd3cf] text-[#0f172a] transition hover:bg-[#99f6e4] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
                {errorMessage ? (
                  <p className="mt-3 rounded-[1rem] border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {errorMessage}
                  </p>
                ) : null}
              </div>

              <div className="border-t border-[#1e2230] pt-5">
                <p className="text-sm font-medium uppercase tracking-[0.22em] text-[#94a3b8]">
                  Previous Questions
                </p>

                <div className="mt-4 space-y-4">
                  {detail.questions.length === 0 ? (
                    <div className="rounded-[1.2rem] border border-dashed border-[#2a3144] bg-[#0f1117] px-5 py-8 text-sm text-[#94a3b8]">
                      No AI questions yet for this repository.
                    </div>
                  ) : (
                    detail.questions.map((question) => (
                      <article
                        key={question.id}
                        className="rounded-[1.2rem] border border-[#2a3144] bg-[#0f1117] px-5 py-5"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1 rounded-lg bg-[#7c3aed]/12 p-2 text-[#c4b5fd]">
                            <Bot className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-lg font-medium text-slate-50">
                              {question.questionText}
                            </p>
                            <div className="mt-3 text-sm leading-8 text-[#cbd5e1]">
                              <ReactMarkdown>
                                {question.answerText ?? "Awaiting response..."}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "docs" ? (
            <div className="grid gap-5 lg:grid-cols-[0.72fr_1.28fr]">
              <div className="space-y-3">
                {detail.docs.length === 0 ? (
                  <div className="rounded-[1.2rem] border border-dashed border-[#2a3144] bg-[#0f1117] px-5 py-8 text-sm text-[#94a3b8]">
                    No documentation generated yet.
                  </div>
                ) : (
                  detail.docs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setActiveDocId(doc.id)}
                      className={`w-full rounded-[1.2rem] border px-4 py-4 text-left transition ${
                        selectedDoc?.id === doc.id
                          ? "border-[#0d9488] bg-[#0f1117] shadow-[inset_0_0_0_1px_#0d9488]"
                          : "border-[#2a3144] bg-[#0f1117] hover:border-[#3a445c]"
                      }`}
                    >
                      <p className="font-semibold text-slate-50">{doc.title}</p>
                      <p className="mt-2 text-sm text-[#94a3b8]">
                        Updated {formatDate(doc.updatedAt)}
                      </p>
                    </button>
                  ))
                )}
              </div>

              <div className="rounded-[1.2rem] border border-[#2a3144] bg-[#0f1117] p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-xl font-semibold text-slate-50">
                    {selectedDoc?.title ?? "Documentation"}
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile(
                        selectedDoc?.content ?? "",
                        `${selectedDoc?.title ?? "documentation"}.doc`,
                      )
                    }
                    className="rounded-xl bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Download .doc
                  </button>
                </div>
                <div className="markdown-body max-w-none text-[#cbd5e1]">
                  <ReactMarkdown>{selectedDoc?.content ?? ""}</ReactMarkdown>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "diagrams" ? (
            <div className="space-y-5">
              {detail.diagrams.length === 0 ? (
                <div className="rounded-[1.2rem] border border-dashed border-[#2a3144] bg-[#0f1117] px-5 py-8 text-sm text-[#94a3b8]">
                  No diagrams generated yet.
                </div>
              ) : (
                detail.diagrams.map((diagram) => (
                  <div
                    key={diagram.id}
                    className="rounded-[1.2rem] border border-[#2a3144] bg-[#0f1117] p-6"
                  >
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-semibold text-slate-50">{diagram.title}</h3>
                        <p className="mt-1 text-sm text-[#94a3b8]">
                          Updated {formatDate(diagram.updatedAt)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => downloadTextFile(diagram.mermaidCode, `${diagram.title}.mmd`)}
                        className="rounded-xl bg-[#0d9488] px-4 py-2 text-sm font-semibold text-white"
                      >
                        Download
                      </button>
                    </div>
                    <div className="overflow-hidden rounded-[1.2rem] bg-white p-5 text-slate-900">
                      <MermaidDiagram chart={diagram.mermaidCode} />
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </section>

        <aside className="rounded-[2rem] border border-[#1e2230] bg-[#13161e] p-7 shadow-[0_12px_40px_rgba(0,0,0,0.24)]">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#c4b5fd]" />
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-slate-50">
              Generate
            </h2>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-2">
            {generationCards.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => generateDocumentation(item.title)}
                  disabled={isGeneratingDoc}
                  className="rounded-[1.2rem] border border-[#2a3144] bg-[#0f1117] p-5 text-left transition hover:border-[#3a445c] hover:bg-[#151923]"
                >
                  <Icon className="h-5 w-5 text-[#5eead4]" />
                  <p className="mt-4 text-lg font-semibold text-slate-50">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[#94a3b8]">{item.description}</p>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
