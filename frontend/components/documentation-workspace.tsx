"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { FileText, Sparkles, X } from "lucide-react";
import { useEffect } from "react";
import { axiosInstance } from "@/lib/api";
import { AxiosError } from "axios";
import { GenerationOverlay } from "@/components/generation-overlay";
import { useNotifications } from "@/context/notification-context";
import type { RepoDocument, RepositoryDetail, RepositorySummary } from "@/lib/types";
import { downloadTextAsPdf, downloadTextFile, formatDate, safeArtifactFilename } from "@/lib/utils";

type DocumentationWorkspaceProps = {
  documents: RepoDocument[];
};

const generationOptions = [
  {
    description: "High-level documentation",
    title: "Project Overview",
  },
  {
    description: "Endpoints & interfaces",
    title: "API Documentation",
  },
  {
    description: "Module-by-module breakdown",
    title: "Module Docs",
  },
] as const;

export function DocumentationWorkspace({ documents }: DocumentationWorkspaceProps) {
  const { addNotification } = useNotifications();
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState("");
  const [repositoryDocs, setRepositoryDocs] = useState<RepoDocument[]>(documents);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(documents[0]?.id ?? null);
  const [isLoadingRepositories, setIsLoadingRepositories] = useState(true);
  const [exportFormat, setExportFormat] = useState<"pdf" | "word">("word");
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingTitle, setGeneratingTitle] = useState<string | null>(null);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedDoc = useMemo(
    () => repositoryDocs.find((document) => document.id === selectedDocId) ?? repositoryDocs[0] ?? null,
    [repositoryDocs, selectedDocId],
  );
  const selectedRepositoryName = useMemo(
    () => repositories.find((repository) => String(repository.id) === selectedRepositoryId)?.name,
    [repositories, selectedRepositoryId],
  );

  useEffect(() => {
    void axiosInstance
      .get<RepositorySummary[]>("/repositories")
      .then((response) => {
        setRepositories(response.data);
        if (response.data.length > 0) {
          setSelectedRepositoryId(String(response.data[0].id));
        }
      })
      .catch(() => {
        setRepositories([]);
        setErrorMessage("Repositories could not be loaded.");
      })
      .finally(() => setIsLoadingRepositories(false));
  }, []);

  useEffect(() => {
    if (!selectedRepositoryId) {
      return;
    }

    void axiosInstance
      .get<RepositoryDetail>(`/repositories/${selectedRepositoryId}`)
      .then((response) => {
        const loadedDocs = response.data.docs ?? [];
        setRepositoryDocs(loadedDocs);
        setSelectedDocId(loadedDocs[0]?.id ?? null);
        setErrorMessage(null);
      })
      .catch(() => {
        setRepositoryDocs([]);
        setSelectedDocId(null);
        setErrorMessage("Documents could not be loaded for this repository.");
      });
  }, [documents, selectedRepositoryId]);

  const notifyDownload = (filename: string) => {
    addNotification({
      href: selectedRepositoryId ? `/repositories/${selectedRepositoryId}?tab=docs` : "/documentation",
      message: filename,
      title: "File downloaded",
      type: "documentation",
    });
  };

  const handleExport = () => {
    if (!selectedDoc) {
      return;
    }

    const filenameBase = safeArtifactFilename(
      selectedRepositoryName ?? selectedDoc.repositoryName,
      selectedDoc.title,
      "documentation",
    );

    if (exportFormat === "word") {
      const filename = `${filenameBase}.doc`;
      downloadTextFile(
        selectedDoc.content,
        filename,
        "application/msword;charset=utf-8",
      );
      notifyDownload(filename);
      return;
    }

    const filename = `${filenameBase}.pdf`;
    void downloadTextAsPdf(selectedDoc.content, filename, filenameBase)
      .then(() => notifyDownload(filename))
      .catch(() => setErrorMessage("PDF export failed. Please try again."));
  };

  const handleGenerate = async (title: string) => {
    if (!selectedRepositoryId) {
      setErrorMessage("Select a repository before generating documentation.");
      return;
    }

    setIsGenerating(true);
    setGeneratingTitle(title);
    setErrorMessage(null);
    try {
      const response = await axiosInstance.post<RepoDocument>(
        `/repositories/${selectedRepositoryId}/documentation`,
        { documentationType: title },
      );
      setRepositoryDocs((current) => [response.data, ...current]);
      setSelectedDocId(response.data.id);
      addNotification({
        href: `/repositories/${selectedRepositoryId}?tab=docs&doc=${response.data.id}`,
        message: `${response.data.title} is ready to view.`,
        title: "Documentation generated",
        type: "documentation",
      });
      setGenerationMessage(`${title} generated.`);
      setIsGenerateOpen(false);
    } catch (error) {
      const apiMessage =
        error instanceof AxiosError && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : null;
      setErrorMessage(apiMessage ?? `${title} could not be generated.`);
    } finally {
      setIsGenerating(false);
      setGeneratingTitle(null);
    }
  };

  return (
    <div className="space-y-4 text-[#172033]">
      <GenerationOverlay
        open={isGenerating}
        title={`Generating ${generatingTitle ?? "documentation"}`}
        description="RepoAI is reading the indexed repository context and writing the documentation."
      />
      <section className="rounded-md border border-[#d7e7f7] bg-white shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d7e7f7] px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0ea5e9]">Generated docs</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#10213f]">Documentation</h1>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-[#10213f]">Repository</label>
            <select
              value={selectedRepositoryId}
              onChange={(event) => setSelectedRepositoryId(event.target.value)}
              disabled={isLoadingRepositories || repositories.length === 0}
              className="min-w-[220px] rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-2 py-1.5 text-sm outline-none focus:border-[#38bdf8]"
            >
              {isLoadingRepositories ? (
                <option value="">Loading repositories...</option>
              ) : repositories.length === 0 ? (
                <option value="">No repositories available</option>
              ) : (
                repositories.map((repository) => (
                  <option key={repository.id} value={repository.id}>
                    {repository.name}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={() => setIsGenerateOpen(true)}
              className="rounded-md bg-[#2563eb] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
            >
              Generate New
            </button>
          </div>
        </div>

        <div className="space-y-3 p-4">
          {errorMessage ? (
            <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}
          {repositoryDocs.length === 0 ? (
            <div className="rounded-md border border-dashed border-[#bfdbfe] bg-[#f8fbff] px-4 py-8 text-center text-sm text-[#52627a]">
              No documentation generated yet.
            </div>
          ) : (
            repositoryDocs.map((document) => (
              <button
                key={document.id}
                type="button"
                onClick={() => setSelectedDocId(document.id)}
                className="flex w-full items-center justify-between gap-4 rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-4 py-3 text-left transition hover:border-[#38bdf8] hover:bg-white"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#2563eb]" />
                    <h2 className="truncate text-lg font-bold text-[#10213f]">{document.title}</h2>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#8a9ab0]">
                    <span className="rounded-md border border-[#bfdbfe] bg-[#eff6ff] px-1.5 py-0.5 font-semibold text-[#2563eb]">
                      {document.type ?? "Overview"}
                    </span>
                    <span>{formatDate(document.updatedAt)}</span>
                  </div>
                </div>
                <span className="rounded-md border border-[#d7e7f7] bg-white px-3 py-1.5 text-sm font-semibold text-[#2563eb]">
                  View
                </span>
              </button>
            ))
          )}
        </div>
      </section>

      {selectedDoc ? (
        <section className="rounded-md border border-[#d7e7f7] bg-white shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d7e7f7] px-4 py-3">
            <div>
              <h2 className="text-xl font-bold text-[#10213f]">{selectedDoc.title}</h2>
              <p className="text-sm text-[#52627a]">
                {selectedDoc.repositoryName ?? "Unknown repository"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value as "pdf" | "word")}
                className="rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-2 py-1.5 text-sm outline-none focus:border-[#38bdf8]"
              >
                <option value="word">Word (.doc)</option>
                <option value="pdf">PDF (.pdf)</option>
              </select>
              <button
                type="button"
                onClick={handleExport}
                className="rounded-md bg-[#2563eb] px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1d4ed8]"
              >
                Download
              </button>
            </div>
          </div>

          <div className="p-4">
            <div className="markdown-body max-h-[30rem] overflow-y-auto rounded-md border border-[#d7e7f7] bg-[#f8fbff] p-4 text-[#172033]">
              <ReactMarkdown>{selectedDoc.content}</ReactMarkdown>
            </div>
          </div>
        </section>
      ) : null}

      {generationMessage ? (
        <p className="rounded-md border border-[#bfdbfe] bg-[#eff6ff] px-3 py-2 text-sm text-[#2563eb]">
          {generationMessage}
        </p>
      ) : null}

      {isGenerateOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#10213f]/35 p-4">
          <div className="w-full max-w-[520px] rounded-md border border-[#d7e7f7] bg-white p-5 shadow-[0_24px_70px_rgba(37,99,235,0.18)]">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#2563eb]" />
                <h3 className="text-3xl font-bold tracking-tight text-[#10213f]">Generate</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGenerateOpen(false)}
                disabled={isGenerating}
                className="rounded p-1 text-[#52627a] hover:bg-[#edf6ff] hover:text-[#2563eb]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
              {generationOptions.map((option) => (
                <button
                  key={option.title}
                  type="button"
                  onClick={() => handleGenerate(option.title)}
                  disabled={isGenerating}
                  className="min-w-0 rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-4 py-4 text-left transition hover:border-[#38bdf8] hover:bg-white"
                >
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 text-[#2563eb]" />
                    <div>
                      <p className="break-words text-lg font-bold text-[#10213f]">{option.title}</p>
                      <p className="mt-1 break-words text-sm leading-6 text-[#52627a]">{option.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
