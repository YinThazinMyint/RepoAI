"use client";

import mermaid from "mermaid";
import { useEffect, useId, useState } from "react";

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

export function MermaidDiagram({ chart }: { chart: string }) {
  const chartId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let isMounted = true;
    const cleanedChart = cleanMermaidChart(chart);

    void mermaid
      .parse(cleanedChart, { suppressErrors: true })
      .then((isValid) => {
        if (!isValid) {
          throw new Error("Invalid Mermaid syntax.");
        }
        return mermaid.render(`repoai-chart-${chartId}`, cleanedChart);
      })
      .then((result) => {
        if (isMounted) {
          setSvg(result.svg);
        }
      })
      .catch(() => {
        if (isMounted) {
          setSvg(`
            <div class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              This diagram has invalid Mermaid syntax. Regenerate it to create a renderable diagram.
            </div>
          `);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [chart, chartId]);

  return <div dangerouslySetInnerHTML={{ __html: svg }} className="overflow-x-auto" />;
}
