"use client";

import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { FileText, Sparkles, X } from "lucide-react";
import { useEffect } from "react";
import { axiosInstance } from "@/lib/api";
import { AxiosError } from "axios";
import type { RepoDocument, RepositoryDetail, RepositorySummary } from "@/lib/types";
import { downloadTextFile, formatDate, safeFilename } from "@/lib/utils";

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
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState("");
  const [repositoryDocs, setRepositoryDocs] = useState<RepoDocument[]>(documents);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(documents[0]?.id ?? null);
  const [isLoadingRepositories, setIsLoadingRepositories] = useState(true);
  const [exportFormat, setExportFormat] = useState<"pdf" | "word">("word");
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedDoc = useMemo(
    () => repositoryDocs.find((document) => document.id === selectedDocId) ?? repositoryDocs[0] ?? null,
    [repositoryDocs, selectedDocId],
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

  const exportAsPdf = (title: string, content: string) => {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      return;
    }

    const escapedTitle = title
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
    const escapedContent = content
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

    printWindow.document.write(`
      <html>
        <head>
          <title>${escapedTitle}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #111; }
            h1 { margin-bottom: 16px; }
            pre { white-space: pre-wrap; line-height: 1.5; font-size: 14px; }
          </style>
        </head>
        <body>
          <h1>${escapedTitle}</h1>
          <pre>${escapedContent}</pre>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleExport = () => {
    if (!selectedDoc) {
      return;
    }

    if (exportFormat === "word") {
      downloadTextFile(
        selectedDoc.content,
        `${safeFilename(selectedDoc.title, "documentation")}.doc`,
        "application/msword;charset=utf-8",
      );
      return;
    }

    exportAsPdf(selectedDoc.title, selectedDoc.content);
  };

  const handleGenerate = async (title: string) => {
    if (!selectedRepositoryId) {
      setErrorMessage("Select a repository before generating documentation.");
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    try {
      const response = await axiosInstance.post<RepoDocument>(
        `/repositories/${selectedRepositoryId}/documentation`,
        { documentationType: title },
      );
      setRepositoryDocs((current) => [response.data, ...current]);
      setSelectedDocId(response.data.id);
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
    }
  };

  return (
    <div className="space-y-4 text-black">
      <section className="rounded-md border border-black/60 bg-[#f6f6f6]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/50 px-6 py-3">
          <h1 className="text-3xl font-semibold tracking-tight">Documentation</h1>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Repository</label>
            <select
              value={selectedRepositoryId}
              onChange={(event) => setSelectedRepositoryId(event.target.value)}
              disabled={isLoadingRepositories || repositories.length === 0}
              className="min-w-[220px] rounded-sm border border-black/60 bg-[#fefefe] px-2 py-1.5 text-sm outline-none"
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
              className="rounded-sm border border-black/70 bg-black px-3 py-2 text-sm font-semibold text-white transition hover:bg-black/85"
            >
              Generate New
            </button>
          </div>
        </div>

        <div className="space-y-3 p-4">
          {errorMessage ? (
            <p className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}
          {repositoryDocs.length === 0 ? (
            <div className="rounded-sm border border-dashed border-black/40 px-4 py-8 text-center text-sm text-black/60">
              No documentation generated yet.
            </div>
          ) : (
            repositoryDocs.map((document) => (
              <button
                key={document.id}
                type="button"
                onClick={() => setSelectedDocId(document.id)}
                className="flex w-full items-center justify-between gap-4 rounded-sm border border-black/55 bg-[#f9f9f9] px-4 py-3 text-left hover:bg-black/5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-black/80" />
                    <h2 className="truncate text-lg font-semibold">{document.title}</h2>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/60">
                    <span className="rounded-sm border border-black/55 px-1.5 py-0.5 font-semibold text-black">
                      {document.type ?? "Overview"}
                    </span>
                    <span>{formatDate(document.updatedAt)}</span>
                  </div>
                </div>
                <span className="rounded-sm border border-black/60 bg-[#fdfdfd] px-3 py-1.5 text-sm font-semibold">
                  View
                </span>
              </button>
            ))
          )}
        </div>
      </section>

      {selectedDoc ? (
        <section className="rounded-md border border-black/60 bg-[#f7f7f7]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/50 px-4 py-3">
            <div>
              <h2 className="text-xl font-semibold">{selectedDoc.title}</h2>
              <p className="text-sm text-black/65">
                {selectedDoc.repositoryName ?? "Unknown repository"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value as "pdf" | "word")}
                className="rounded-sm border border-black/60 bg-[#fefefe] px-2 py-1.5 text-sm outline-none"
              >
                <option value="word">Word (.doc)</option>
                <option value="pdf">PDF (.pdf)</option>
              </select>
              <button
                type="button"
                onClick={handleExport}
                className="rounded-sm border border-black bg-black px-3 py-1.5 text-sm font-semibold text-white hover:bg-black/85"
              >
                Download
              </button>
            </div>
          </div>

          <div className="p-4">
            <div className="markdown-body max-h-[30rem] overflow-y-auto rounded-sm border border-black/30 bg-white p-4 text-black">
              <ReactMarkdown>{selectedDoc.content}</ReactMarkdown>
            </div>
          </div>
        </section>
      ) : null}

      {generationMessage ? (
        <p className="rounded-sm border border-black/30 bg-[#f7f7f7] px-3 py-2 text-sm text-black/75">
          {generationMessage}
        </p>
      ) : null}

      {isGenerateOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-[520px] rounded-xl border border-black/20 bg-[#f3f4f6] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                <h3 className="text-3xl font-semibold tracking-tight">Generate</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsGenerateOpen(false)}
                className="rounded p-1 text-black/70 hover:bg-black/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {generationOptions.map((option) => (
                <button
                  key={option.title}
                  type="button"
                  onClick={() => handleGenerate(option.title)}
                  disabled={isGenerating}
                  className="rounded-xl border border-black/20 bg-[#eceff3] px-4 py-4 text-left transition hover:border-black/40 hover:bg-[#e6e9ee]"
                >
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 text-[#14b8a6]" />
                    <div>
                      <p className="text-xl font-semibold text-black">{option.title}</p>
                      <p className="mt-1 text-sm text-black/65">{option.description}</p>
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
