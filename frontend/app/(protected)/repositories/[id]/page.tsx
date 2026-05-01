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
import { GenerationOverlay } from "@/components/generation-overlay";
import { StatusBadge } from "@/components/status-badge";
import { useNotifications } from "@/context/notification-context";
import { axiosInstance } from "@/lib/api";
import { AxiosError } from "axios";
import type { AIMessage, RepoDiagram, RepoDocument, RepositoryDetail } from "@/lib/types";
import {
  downloadSvgMarkupAsPng,
  downloadSvgMarkupAsPdf,
  downloadTextAsPdf,
  downloadTextFile,
  formatDate,
  safeArtifactFilename,
} from "@/lib/utils";
import { renderMermaidForExport } from "@/lib/mermaid-export";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

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
  {
    description: "Classes and relationships",
    icon: FileCode2,
    title: "Class Diagram",
  },
  {
    description: "Database entities",
    icon: Network,
    title: "ER Diagram",
  },
] as const;

export default function RepositoryDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { addNotification } = useNotifications();
  const [detail, setDetail] = useState<RepositoryDetail | null>(null);
  const [activeTab, setActiveTab] = useState("chat");
  const [activeDocId, setActiveDocId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [generatingTitle, setGeneratingTitle] = useState<string | null>(null);
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

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "chat" || tab === "docs" || tab === "diagrams") {
      setActiveTab(tab);
    }

    const docId = Number(searchParams.get("doc"));
    if (Number.isFinite(docId) && docId > 0) {
      setActiveDocId(docId);
    }
  }, [searchParams]);

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
      await generateDiagram(title);
      return;
    }

    setIsGeneratingDoc(true);
    setGeneratingTitle(title);
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
      addNotification({
        href: `/repositories/${repoId}?tab=docs&doc=${response.data.id}`,
        message: `${response.data.title} is ready to view for ${detail.repository.name}.`,
        title: "Documentation generated",
        type: "documentation",
      });
    } catch (error) {
      const apiMessage =
        error instanceof AxiosError && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : null;
      setErrorMessage(apiMessage ?? `${title} could not be generated.`);
    } finally {
      setIsGeneratingDoc(false);
      setGeneratingTitle(null);
    }
  };

  const generateDiagram = async (title: string) => {
    if (!detail) {
      return;
    }

    setIsGeneratingDoc(true);
    setGeneratingTitle(title);
    setErrorMessage(null);
    try {
      const response = await axiosInstance.post<RepoDiagram>(
        `/repositories/${repoId}/diagrams`,
        { diagramType: title },
      );
      setDetail((current) =>
        current
          ? {
              ...current,
              diagrams: [response.data, ...current.diagrams],
            }
          : current,
      );
      setActiveTab("diagrams");
      addNotification({
        href: `/repositories/${repoId}?tab=diagrams&diagram=${response.data.id}`,
        message: `${response.data.title} is ready to view for ${detail.repository.name}.`,
        title: "Diagram generated",
        type: "diagram",
      });
    } catch (error) {
      const apiMessage =
        error instanceof AxiosError && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : null;
      setErrorMessage(apiMessage ?? `${title} could not be generated.`);
    } finally {
      setIsGeneratingDoc(false);
      setGeneratingTitle(null);
    }
  };

  const notifyDownload = (filename: string, type: "diagram" | "documentation") => {
    addNotification({
      href: `/repositories/${repoId}?tab=${type === "documentation" ? "docs" : "diagrams"}`,
      message: filename,
      title: "File downloaded",
      type,
    });
  };

  const downloadDocumentationAsWord = (doc: RepoDocument) => {
    const filenameBase = safeArtifactFilename(detail?.repository.name, doc.title, "documentation");
    const filename = `${filenameBase}.doc`;

    downloadTextFile(
      doc.content,
      filename,
      "application/msword;charset=utf-8",
    );
    notifyDownload(filename, "documentation");
  };

  const downloadDocumentationAsPdf = (doc: RepoDocument) => {
    const filenameBase = safeArtifactFilename(detail?.repository.name, doc.title, "documentation");
    const filename = `${filenameBase}.pdf`;

    void downloadTextAsPdf(doc.content, filename, filenameBase)
      .then(() => notifyDownload(filename, "documentation"))
      .catch(() => setErrorMessage("PDF export failed. Please try again."));
  };

  const downloadDiagramAsPng = (diagram: RepoDiagram) => {
    const filenameBase = safeArtifactFilename(detail?.repository.name, diagram.title, "diagram");
    const filename = `${filenameBase}.png`;

    void renderMermaidForExport(diagram.mermaidCode)
      .then((svgMarkup) => downloadSvgMarkupAsPng(svgMarkup, filename))
      .then(() => notifyDownload(filename, "diagram"))
      .catch(() => setErrorMessage("PNG export failed. Try downloading Mermaid or PDF instead."));
  };

  const downloadDiagramAsPdf = (diagram: RepoDiagram) => {
    const filenameBase = safeArtifactFilename(detail?.repository.name, diagram.title, "diagram");
    const filename = `${filenameBase}.pdf`;

    void renderMermaidForExport(diagram.mermaidCode)
      .then((svgMarkup) => downloadSvgMarkupAsPdf(svgMarkup, filename, filenameBase))
      .then(() => notifyDownload(filename, "diagram"))
      .catch(() => setErrorMessage("PDF export failed. Try downloading Mermaid instead."));
  };

  const downloadDiagramAsMmd = (diagram: RepoDiagram) => {
    const filename = `${safeArtifactFilename(detail?.repository.name, diagram.title, "diagram")}.mmd`;
    downloadTextFile(diagram.mermaidCode, filename, "text/plain;charset=utf-8");
    notifyDownload(filename, "diagram");
  };

  if (isLoading) {
    return (
      <div className="rounded-md border border-[#d7e7f7] bg-white p-7 text-sm text-[#52627a] shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
        Loading repository {repoId}...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="space-y-5">
        <Link
          href="/repositories"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#52627a] transition hover:text-[#2563eb]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Repositories
        </Link>
        <div className="rounded-md border border-red-300 bg-red-50 p-7 text-sm text-red-700">
          {errorMessage ?? `Repository ${repoId} could not be loaded.`}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <GenerationOverlay
        open={isGeneratingDoc}
        title={`Generating ${generatingTitle ?? "artifact"}`}
        description="RepoAI is using repository context to create the requested documentation or diagram."
      />
      <Link
        href="/repositories"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#52627a] transition hover:text-[#2563eb]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Repositories
      </Link>

      <section className="rounded-md border border-[#d7e7f7] bg-white p-7 shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-md bg-[#e0f2fe] text-[#2563eb]">
            <FileCode2 className="h-8 w-8" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="text-3xl font-bold tracking-tight text-[#10213f] md:text-4xl">
                {detail.repository.name}
              </h1>
              <StatusBadge status={detail.repository.status} />
            </div>

            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#52627a]">
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
                    className="rounded-md border border-[#bfdbfe] bg-[#eff6ff] px-3 py-1 text-sm font-semibold text-[#2563eb]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 rounded-md border border-[#d7e7f7] bg-white p-2 shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
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
                  ? "bg-[#2563eb] text-white shadow-sm"
                  : "text-[#52627a] hover:bg-[#edf6ff] hover:text-[#2563eb]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.75fr)]">
        <section className="rounded-md border border-[#d7e7f7] bg-white p-7 shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
          {activeTab === "chat" ? (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-[#2563eb]" />
                  <h2 className="text-3xl font-bold tracking-tight text-[#10213f]">
                    Ask AI
                  </h2>
                </div>

                <div className="mt-5 flex gap-3">
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={3}
                    placeholder="Ask anything about this codebase..."
                    className="min-h-[74px] flex-1 rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-4 py-4 text-sm text-[#172033] outline-none placeholder:text-[#8a9ab0] focus:border-[#38bdf8] focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={submitQuestion}
                    disabled={isSubmitting}
                    className="mt-auto inline-flex h-12 w-12 items-center justify-center rounded-md bg-[#2563eb] text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
                {errorMessage ? (
                  <p className="mt-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </p>
                ) : null}
              </div>

              <div className="border-t border-[#d7e7f7] pt-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0ea5e9]">
                  Previous Questions
                </p>

                <div className="mt-4 space-y-4">
                  {detail.questions.length === 0 ? (
                    <div className="rounded-md border border-dashed border-[#bfdbfe] bg-[#f8fbff] px-5 py-8 text-sm text-[#52627a]">
                      No AI questions yet for this repository.
                    </div>
                  ) : (
                    detail.questions.map((question) => (
                      <article
                        key={question.id}
                        className="rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-5 py-5"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1 rounded-md bg-[#e0f2fe] p-2 text-[#2563eb]">
                            <Bot className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-lg font-bold text-[#10213f]">
                              {question.questionText}
                            </p>
                            <div className="mt-3 text-sm leading-8 text-[#334155]">
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
            <div className="grid gap-5 xl:grid-cols-[minmax(180px,0.72fr)_minmax(0,1.28fr)]">
              <div className="grid gap-3 sm:grid-cols-2 xl:block xl:space-y-3">
                {detail.docs.length === 0 ? (
                  <div className="rounded-md border border-dashed border-[#bfdbfe] bg-[#f8fbff] px-5 py-8 text-sm text-[#52627a]">
                    No documentation generated yet.
                  </div>
                ) : (
                  detail.docs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => setActiveDocId(doc.id)}
                      className={`w-full rounded-md border px-4 py-4 text-left transition ${
                        selectedDoc?.id === doc.id
                          ? "border-[#2563eb] bg-[#eff6ff]"
                          : "border-[#d7e7f7] bg-[#f8fbff] hover:border-[#38bdf8] hover:bg-white"
                      }`}
                    >
                      <p className="break-words font-bold text-[#10213f]">{doc.title}</p>
                      <p className="mt-2 text-sm text-[#52627a]">
                        Updated {formatDate(doc.updatedAt)}
                      </p>
                    </button>
                  ))
                )}
              </div>

              <div className="min-w-0 rounded-md border border-[#d7e7f7] bg-[#f8fbff] p-4 sm:p-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-xl font-bold text-[#10213f]">
                    {selectedDoc?.title ?? "Documentation"}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedDoc ? (
                      <>
                        <button
                          type="button"
                          onClick={() => downloadDocumentationAsWord(selectedDoc)}
                          className="rounded-md bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
                        >
                          Word .doc
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadDocumentationAsPdf(selectedDoc)}
                          className="rounded-md border border-[#d7e7f7] bg-white px-4 py-2 text-sm font-semibold text-[#2563eb] hover:border-[#38bdf8]"
                        >
                          PDF
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="markdown-body max-w-none overflow-x-auto text-[#334155]">
                  <ReactMarkdown>{selectedDoc?.content ?? ""}</ReactMarkdown>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "diagrams" ? (
            <div className="space-y-5">
              {detail.diagrams.length === 0 ? (
                <div className="rounded-md border border-dashed border-[#bfdbfe] bg-[#f8fbff] px-5 py-8 text-sm text-[#52627a]">
                  No diagrams generated yet.
                </div>
              ) : (
                detail.diagrams.map((diagram) => (
                  <div
                    key={diagram.id}
                    className="rounded-md border border-[#d7e7f7] bg-[#f8fbff] p-6"
                  >
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-bold text-[#10213f]">{diagram.title}</h3>
                        <p className="mt-1 text-sm text-[#52627a]">
                          Updated {formatDate(diagram.updatedAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => downloadDiagramAsMmd(diagram)}
                          className="rounded-md bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d4ed8]"
                        >
                          MMD
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadDiagramAsPng(diagram)}
                          className="rounded-md border border-[#d7e7f7] bg-white px-4 py-2 text-sm font-semibold text-[#2563eb] hover:border-[#38bdf8]"
                        >
                          PNG
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadDiagramAsPdf(diagram)}
                          className="rounded-md border border-[#d7e7f7] bg-white px-4 py-2 text-sm font-semibold text-[#2563eb] hover:border-[#38bdf8]"
                        >
                          PDF
                        </button>
                      </div>
                    </div>
                    <div
                      id={`diagram-preview-${diagram.id}`}
                      className="overflow-hidden rounded-md border border-[#d7e7f7] bg-white p-5 text-[#172033]"
                    >
                      <MermaidDiagram chart={diagram.mermaidCode} />
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </section>

        <aside className="rounded-md border border-[#d7e7f7] bg-white p-5 shadow-[0_18px_45px_rgba(37,99,235,0.08)] sm:p-7">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#2563eb]" />
            <h2 className="text-3xl font-bold tracking-tight text-[#10213f]">
              Generate
            </h2>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 2xl:grid-cols-1 min-[1760px]:grid-cols-2">
            {generationCards.map((item) => {
              const Icon = item.icon;

              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => generateDocumentation(item.title)}
                  disabled={isGeneratingDoc}
                  className="min-w-0 rounded-md border border-[#d7e7f7] bg-[#f8fbff] p-4 text-left transition hover:border-[#38bdf8] hover:bg-white"
                >
                  <Icon className="h-5 w-5 text-[#2563eb]" />
                  <p className="mt-4 break-words text-base font-bold text-[#10213f]">{item.title}</p>
                  <p className="mt-2 break-words text-sm leading-6 text-[#52627a]">{item.description}</p>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
