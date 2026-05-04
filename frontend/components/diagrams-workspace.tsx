"use client";

import { useMemo, useRef, useState } from "react";
import { useEffect } from "react";
import { axiosInstance } from "@/lib/api";
import { AxiosError } from "axios";
import { GenerationOverlay } from "@/components/generation-overlay";
import { useNotifications } from "@/context/notification-context";
import type { RepoDiagram, RepositoryDetail, RepositorySummary } from "@/lib/types";
import {
  downloadSvgMarkupAsPng,
  downloadTextFile,
  formatDate,
  openSvgMarkupAsPrintablePdf,
  safeArtifactFilename,
} from "@/lib/utils";
import { renderMermaidForExport } from "@/lib/mermaid-export";
import { Image as ImageIcon, Sparkles, Trash2, Workflow, X } from "lucide-react";
import { MermaidDiagram } from "@/components/mermaid-diagram";

const generateOptions = [
  { description: "Code logic flow", title: "Flowchart" },
  { description: "Request/response flows", title: "Sequence Diagram" },
  { description: "System architecture diagram", title: "Architecture" },
  { description: "Classes and relationships", title: "Class Diagram" },
  { description: "Database entities", title: "ER Diagram" },
] as const;

export function DiagramsWorkspace() {
  const { addNotification } = useNotifications();
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState("");
  const [diagrams, setDiagrams] = useState<RepoDiagram[]>([]);
  const [selectedDiagramId, setSelectedDiagramId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingTitle, setGeneratingTitle] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<"mmd" | "pdf" | "png" | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void axiosInstance
      .get<RepositorySummary[]>("/repositories")
      .then((response) => {
        setRepositories(response.data);
        if (response.data.length > 0) {
          setSelectedRepositoryId(String(response.data[0].id));
        } else {
          setDiagrams([]);
          setSelectedDiagramId(null);
        }
      })
      .catch(() => {
        setRepositories([]);
        setDiagrams([]);
        setSelectedDiagramId(null);
        setErrorMessage("Repositories could not be loaded.");
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedRepositoryId) {
      return;
    }

    void axiosInstance
      .get<RepositoryDetail>(`/repositories/${selectedRepositoryId}`)
      .then((response) => {
        const loadedDiagrams = response.data.diagrams ?? [];
        setDiagrams(loadedDiagrams);
        setSelectedDiagramId(loadedDiagrams[0]?.id ?? null);
        setErrorMessage(null);
      })
      .catch(() => {
        setDiagrams([]);
        setSelectedDiagramId(null);
        setErrorMessage("Diagrams could not be loaded for this repository.");
      });
  }, [selectedRepositoryId]);

  const selectedDiagram = useMemo(
    () => diagrams.find((diagram) => diagram.id === selectedDiagramId) ?? diagrams[0] ?? null,
    [diagrams, selectedDiagramId],
  );
  const selectedRepositoryName = useMemo(
    () => repositories.find((repository) => String(repository.id) === selectedRepositoryId)?.name,
    [repositories, selectedRepositoryId],
  );
  const notificationRepositoryName = selectedRepositoryName ?? "selected repository";
  const selectedDiagramFilename = selectedDiagram
    ? safeArtifactFilename(selectedRepositoryName, selectedDiagram.title, "diagram")
    : "diagram";
  const notifyDownload = (filename: string) => {
    addNotification({
      href: selectedRepositoryId ? `/repositories/${selectedRepositoryId}?tab=diagrams` : "/diagrams",
      message: `${filename} was downloaded from ${notificationRepositoryName}.`,
      title: "File downloaded",
      type: "diagram",
    });
  };

  const exportAsPng = async () => {
    if (!selectedDiagram) {
      return;
    }

    setExportingFormat("png");
    setErrorMessage(null);
    try {
      const svgMarkup = await renderMermaidForExport(selectedDiagram.mermaidCode);
      const filename = `${selectedDiagramFilename}.png`;
      await downloadSvgMarkupAsPng(svgMarkup, filename);
      notifyDownload(filename);
    } catch {
      setErrorMessage("PNG export failed. Try downloading Mermaid or PDF instead.");
    } finally {
      setExportingFormat(null);
    }
  };

  const exportAsPdf = async () => {
    if (!selectedDiagram) {
      return;
    }

    setExportingFormat("pdf");
    setErrorMessage(null);
    try {
      const svgMarkup = await renderMermaidForExport(selectedDiagram.mermaidCode);
      const filename = `${selectedDiagramFilename}.pdf`;
      openSvgMarkupAsPrintablePdf(svgMarkup, selectedDiagramFilename);
      notifyDownload(filename);
    } catch {
      setErrorMessage("PDF export failed. Allow popups for this site or download Mermaid instead.");
    } finally {
      setExportingFormat(null);
    }
  };

  const exportAsMmd = () => {
    if (!selectedDiagram) {
      return;
    }

    setExportingFormat("mmd");
    setErrorMessage(null);
    const filename = `${selectedDiagramFilename}.mmd`;
    downloadTextFile(
      selectedDiagram.mermaidCode,
      filename,
      "text/plain;charset=utf-8",
    );
    notifyDownload(filename);
    setExportingFormat(null);
  };

  const generateDiagram = async (title: string) => {
    if (!selectedRepositoryId) {
      setErrorMessage("Select a repository before generating a diagram.");
      return;
    }

    setIsGenerating(true);
    setGeneratingTitle(title);
    setErrorMessage(null);
    setGenerationMessage(`${title} generation started for selected repository.`);

    try {
      const response = await axiosInstance.post<RepoDiagram>(
        `/repositories/${selectedRepositoryId}/diagrams`,
        { diagramType: title },
      );
      setDiagrams((current) => [response.data, ...current]);
      setSelectedDiagramId(response.data.id);
      addNotification({
        href: `/repositories/${selectedRepositoryId}?tab=diagrams&diagram=${response.data.id}`,
        message: `${response.data.title} is ready to view for ${notificationRepositoryName}.`,
        title: "Diagram generated",
        type: "diagram",
      });
      setGenerationMessage(`${title} generated.`);
      setIsGenerateOpen(false);
    } catch (error) {
      const apiMessage =
        error instanceof AxiosError && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : null;
      setErrorMessage(apiMessage ?? `${title} could not be generated. Check the backend and OpenAI configuration.`);
      setGenerationMessage(null);
    } finally {
      setIsGenerating(false);
      setGeneratingTitle(null);
    }
  };

  const deleteDiagram = async (diagram: RepoDiagram) => {
    if (!selectedRepositoryId) {
      return;
    }

    const confirmed = window.confirm(`Delete "${diagram.title}"?`);
    if (!confirmed) {
      return;
    }

    setErrorMessage(null);
    try {
      await axiosInstance.delete(`/repositories/${selectedRepositoryId}/diagrams`, {
        data: { diagramId: diagram.id },
      });
      setDiagrams((current) => {
        const nextDiagrams = current.filter((item) => item.id !== diagram.id);
        if (selectedDiagramId === diagram.id) {
          setSelectedDiagramId(nextDiagrams[0]?.id ?? null);
        }
        return nextDiagrams;
      });
      addNotification({
        href: selectedRepositoryId ? `/repositories/${selectedRepositoryId}?tab=diagrams` : "/diagrams",
        message: `${diagram.title} was deleted from ${notificationRepositoryName}.`,
        title: "Diagram deleted",
        type: "diagram",
      });
    } catch (error) {
      const apiMessage =
        error instanceof AxiosError && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : null;
      setErrorMessage(apiMessage ?? `${diagram.title} could not be deleted.`);
    }
  };

  return (
    <div className="space-y-4 text-[#172033]">
      <GenerationOverlay
        open={isGenerating}
        title={`Generating ${generatingTitle ?? "diagram"}`}
        description="RepoAI is retrieving source context and asking AI to produce valid Mermaid code."
      />
      <section className="rounded-md border border-[#d7e7f7] bg-white shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d7e7f7] px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0ea5e9]">Mermaid output</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#10213f]">Diagrams</h1>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-[#10213f]">Repository</label>
            <select
              value={selectedRepositoryId}
              onChange={(event) => setSelectedRepositoryId(event.target.value)}
              disabled={isLoading || repositories.length === 0}
              className="min-w-[220px] rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-2 py-1.5 text-sm outline-none focus:border-[#38bdf8]"
            >
              {isLoading ? (
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

          {diagrams.length === 0 ? (
            <div className="rounded-md border border-dashed border-[#bfdbfe] bg-[#f8fbff] px-4 py-8 text-center text-sm text-[#52627a]">
              No diagrams found for this repository.
            </div>
          ) : (
            diagrams.map((diagram) => (
              <article
                key={diagram.id}
                className="flex items-center justify-between gap-4 rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-4 py-3 transition hover:border-[#38bdf8] hover:bg-white"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-[#2563eb]" />
                    <h2 className="truncate text-lg font-bold text-[#10213f]">{diagram.title}</h2>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#8a9ab0]">
                    <span className="rounded-md border border-[#bfdbfe] bg-[#eff6ff] px-1.5 py-0.5 font-semibold text-[#2563eb]">
                      {diagram.type}
                    </span>
                    <span>{formatDate(diagram.updatedAt)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDiagramId(diagram.id)}
                    className="rounded-md border border-[#d7e7f7] bg-white px-3 py-1.5 text-sm font-semibold text-[#2563eb] hover:border-[#38bdf8] hover:bg-[#edf6ff]"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteDiagram(diagram)}
                    className="rounded-md border border-red-200 bg-white p-2 text-red-600 hover:border-red-300 hover:bg-red-50"
                    aria-label={`Delete ${diagram.title}`}
                    title="Delete diagram"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {selectedDiagram ? (
        <section className="rounded-md border border-[#d7e7f7] bg-white shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d7e7f7] px-4 py-3">
            <div>
              <h2 className="text-xl font-bold text-[#10213f]">{selectedDiagram.title}</h2>
              <p className="text-sm text-[#52627a]">{selectedDiagram.type}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={exportAsMmd}
                disabled={exportingFormat !== null}
                className="rounded-md border border-[#d7e7f7] bg-white px-3 py-1.5 text-sm font-semibold text-[#2563eb] shadow-sm hover:border-[#38bdf8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                MMD
              </button>
              <button
                type="button"
                onClick={() => void exportAsPng()}
                disabled={exportingFormat !== null}
                className="rounded-md border border-[#d7e7f7] bg-white px-3 py-1.5 text-sm font-semibold text-[#2563eb] shadow-sm hover:border-[#38bdf8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exportingFormat === "png" ? "Preparing..." : "PNG"}
              </button>
              <button
                type="button"
                onClick={() => void exportAsPdf()}
                disabled={exportingFormat !== null}
                className="rounded-md bg-[#2563eb] px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1d4ed8]"
              >
                {exportingFormat === "pdf" ? "Preparing..." : "PDF"}
              </button>
            </div>
          </div>

          <div className="p-4">
            <div ref={previewRef} className="rounded-md border border-[#d7e7f7] bg-[#f8fbff] p-4">
              <MermaidDiagram chart={selectedDiagram.mermaidCode} />
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
              {generateOptions.map((option) => (
                <button
                  key={option.title}
                  type="button"
                  onClick={() => void generateDiagram(option.title)}
                  disabled={isGenerating}
                  className="min-w-0 rounded-md border border-[#d7e7f7] bg-[#f8fbff] px-4 py-4 text-left transition hover:border-[#38bdf8] hover:bg-white"
                >
                  <div className="flex items-start gap-2">
                    <Workflow className="mt-0.5 h-4 w-4 text-[#2563eb]" />
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
