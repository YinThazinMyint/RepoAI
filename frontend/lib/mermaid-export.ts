"use client";

import mermaid from "mermaid";
import { serializeSvgElementForExport } from "@/lib/utils";

mermaid.initialize({
  er: {
    useMaxWidth: true,
  },
  flowchart: {
    htmlLabels: false,
    useMaxWidth: true,
  },
  securityLevel: "loose",
  startOnLoad: false,
  theme: "default",
});

mermaid.parseError = () => undefined;

const cleanMermaidChart = (chart: string) => chart
  .trim()
  .replace(/^```(?:mermaid)?\s*/i, "")
  .replace(/\s*```$/i, "")
  .trim();

export const renderMermaidForExport = async (chart: string) => {
  const id = `repoai-export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const cleanedChart = cleanMermaidChart(chart);
  const isValid = await mermaid.parse(cleanedChart, { suppressErrors: true });
  if (!isValid) {
    throw new Error("Invalid Mermaid syntax.");
  }

  const result = await mermaid.render(id, cleanedChart);
  const parser = new DOMParser();
  const svgDocument = parser.parseFromString(result.svg, "image/svg+xml");
  const svgElement = svgDocument.documentElement;

  if (svgElement.nodeName.toLowerCase() !== "svg") {
    throw new Error("Mermaid did not return SVG output.");
  }

  return serializeSvgElementForExport(svgElement as unknown as SVGSVGElement).markup;
};
