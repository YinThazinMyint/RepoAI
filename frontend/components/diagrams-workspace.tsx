"use client";

import { useMemo, useRef, useState } from "react";
import { useEffect } from "react";
import { axiosInstance } from "@/lib/api";
import type { RepoDiagram, RepositoryDetail, RepositorySummary } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { Image as ImageIcon, Sparkles, Workflow, X } from "lucide-react";
import { MermaidDiagram } from "@/components/mermaid-diagram";

const generateOptions = [
  { description: "Code logic flow", title: "Flowchart" },
  { description: "Request/response flows", title: "Sequence Diagram" },
  { description: "System architecture diagram", title: "Architecture" },
] as const;

export function DiagramsWorkspace() {
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [selectedRepositoryId, setSelectedRepositoryId] = useState("");
  const [diagrams, setDiagrams] = useState<RepoDiagram[]>([]);
  const [selectedDiagramId, setSelectedDiagramId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"pdf" | "png">("png");
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

  const getDiagramSvgMarkup = () => {
    const svg = previewRef.current?.querySelector("svg");
    if (!svg) {
      return null;
    }
    return new XMLSerializer().serializeToString(svg);
  };

  const exportAsPng = async () => {
    const svgMarkup = getDiagramSvgMarkup();
    if (!svgMarkup || !selectedDiagram) {
      return;
    }

    const svg = previewRef.current?.querySelector("svg");
    const bounds = svg?.getBoundingClientRect();
    const width = Math.max(Math.round(bounds?.width ?? 1200), 600);
    const height = Math.max(Math.round(bounds?.height ?? 800), 400);

    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * 2;
      canvas.height = height * 2;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(blobUrl);
        return;
      }

      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.scale(2, 2);
      context.drawImage(image, 0, 0, width, height);

      const pngUrl = canvas.toDataURL("image/png");
      const anchor = document.createElement("a");
      anchor.href = pngUrl;
      anchor.download = `${selectedDiagram.title}.png`;
      anchor.click();
      URL.revokeObjectURL(blobUrl);
    };
    image.src = blobUrl;
  };

  const exportAsPdf = () => {
    const svgMarkup = getDiagramSvgMarkup();
    if (!svgMarkup || !selectedDiagram) {
      return;
    }

    const printWindow = window.open("", "_blank", "width=1000,height=800");
    if (!printWindow) {
      return;
    }

    const title = selectedDiagram.title
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { margin: 24px; font-family: Arial, sans-serif; color: #111; }
            h1 { margin-bottom: 16px; font-size: 20px; }
            .diagram { border: 1px solid #ccc; padding: 12px; }
            svg { width: 100%; height: auto; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="diagram">${svgMarkup}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleExport = () => {
    if (exportFormat === "png") {
      void exportAsPng();
      return;
    }
    exportAsPdf();
  };

  return (
    <div className="space-y-4 text-black">
      <section className="rounded-md border border-black/60 bg-[#f6f6f6]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/50 px-6 py-3">
          <h1 className="text-3xl font-semibold tracking-tight">Diagrams</h1>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Repository</label>
            <select
              value={selectedRepositoryId}
              onChange={(event) => setSelectedRepositoryId(event.target.value)}
              disabled={isLoading || repositories.length === 0}
              className="min-w-[220px] rounded-sm border border-black/60 bg-[#fefefe] px-2 py-1.5 text-sm outline-none"
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

          {diagrams.length === 0 ? (
            <div className="rounded-sm border border-dashed border-black/40 px-4 py-8 text-center text-sm text-black/60">
              No diagrams found for this repository.
            </div>
          ) : (
            diagrams.map((diagram) => (
              <article
                key={diagram.id}
                className="flex items-center justify-between gap-4 rounded-sm border border-black/55 bg-[#f9f9f9] px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-black/80" />
                    <h2 className="truncate text-lg font-semibold">{diagram.title}</h2>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/60">
                    <span className="rounded-sm border border-black/55 px-1.5 py-0.5 font-semibold text-black">
                      {diagram.type}
                    </span>
                    <span>{formatDate(diagram.updatedAt)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDiagramId(diagram.id)}
                  className="rounded-sm border border-black/60 bg-[#fdfdfd] px-3 py-1.5 text-sm font-semibold hover:bg-black/5"
                >
                  View
                </button>
              </article>
            ))
          )}
        </div>
      </section>

      {selectedDiagram ? (
        <section className="rounded-md border border-black/60 bg-[#f7f7f7]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/50 px-4 py-3">
            <div>
              <h2 className="text-xl font-semibold">{selectedDiagram.title}</h2>
              <p className="text-sm text-black/65">{selectedDiagram.type}</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value as "pdf" | "png")}
                className="rounded-sm border border-black/60 bg-[#fefefe] px-2 py-1.5 text-sm outline-none"
              >
                <option value="png">PNG (.png)</option>
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
            <div ref={previewRef} className="rounded-sm border border-black/30 bg-white p-4">
              <MermaidDiagram chart={selectedDiagram.mermaidCode} />
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
              {generateOptions.map((option) => (
                <button
                  key={option.title}
                  type="button"
                  onClick={() => {
                    setGenerationMessage(`${option.title} generation started for selected repository.`);
                    setIsGenerateOpen(false);
                  }}
                  className="rounded-xl border border-black/20 bg-[#eceff3] px-4 py-4 text-left transition hover:border-black/40 hover:bg-[#e6e9ee]"
                >
                  <div className="flex items-start gap-2">
                    <Workflow className="mt-0.5 h-4 w-4 text-[#14b8a6]" />
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
