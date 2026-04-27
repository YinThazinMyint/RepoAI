"use client";

import mermaid from "mermaid";
import { useEffect, useId, useState } from "react";

mermaid.initialize({
  securityLevel: "loose",
  startOnLoad: false,
  theme: "default",
});

export function MermaidDiagram({ chart }: { chart: string }) {
  const chartId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState("");

  useEffect(() => {
    let isMounted = true;

    void mermaid
      .render(`repoai-chart-${chartId}`, chart)
      .then((result) => {
        if (isMounted) {
          setSvg(result.svg);
        }
      })
      .catch(() => {
        if (isMounted) {
          setSvg(`<pre>${chart}</pre>`);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [chart, chartId]);

  return <div dangerouslySetInnerHTML={{ __html: svg }} className="overflow-x-auto" />;
}
