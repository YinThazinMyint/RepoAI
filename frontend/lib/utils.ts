import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatDate = (value?: string) => {
  if (!value) {
    return "Unknown";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
};

export const downloadTextFile = (
  content: string,
  filename: string,
  mimeType = "text/plain;charset=utf-8",
) => {
  if (typeof window === "undefined") {
    return;
  }

  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
};

export const safeFilename = (value: string, fallback = "download") => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return normalized || fallback;
};

export const safeArtifactFilename = (
  repositoryName: string | undefined,
  artifactName: string | undefined,
  fallback = "repoai_export",
) => {
  const normalized = [repositoryName, artifactName]
    .filter((part): part is string => Boolean(part?.trim()))
    .join("_")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");

  return normalized || fallback;
};

export const statusLabel = (status: string) =>
  status.charAt(0) + status.slice(1).toLowerCase();

export const serializeSvgElementForExport = (svgElement: SVGSVGElement) => {
  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
  clonedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clonedSvg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  const bounds = svgElement.getBoundingClientRect();
  const viewBox = clonedSvg.getAttribute("viewBox");
  const viewBoxParts = viewBox?.split(/\s+/).map(Number) ?? [];
  const width = Math.max(
    Math.round(bounds.width || Number(clonedSvg.getAttribute("width")) || viewBoxParts[2] || 1200),
    600,
  );
  const height = Math.max(
    Math.round(bounds.height || Number(clonedSvg.getAttribute("height")) || viewBoxParts[3] || 800),
    400,
  );

  clonedSvg.setAttribute("width", String(width));
  clonedSvg.setAttribute("height", String(height));

  return {
    height,
    markup: new XMLSerializer().serializeToString(clonedSvg),
    width,
  };
};

const downloadPreparedSvgMarkupAsPng = async (
  markup: string,
  width: number,
  height: number,
  filename: string,
) => {
  const canvas = await renderSvgMarkupToCanvas(markup, width, height);

  await new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("PNG export failed."));
        return;
      }

      const pngUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = pngUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(pngUrl);
      resolve();
    }, "image/png");
  });
};

const renderSvgMarkupToCanvas = async (
  markup: string,
  width: number,
  height: number,
) => {
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  const image = new Image();
  image.decoding = "async";

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Diagram image could not be loaded for PNG export."));
    image.src = svgUrl;
  });

  if ("decode" in image) {
    await image.decode().catch(() => undefined);
  }

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas is not available for PNG export.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.drawImage(image, 0, 0, width, height);

  return canvas;
};

const inlineComputedSvgStyles = (source: Element, target: Element) => {
  const computedStyle = window.getComputedStyle(source);
  const inlineProperties = [
    "alignment-baseline",
    "baseline-shift",
    "clip-path",
    "color",
    "display",
    "dominant-baseline",
    "fill",
    "fill-opacity",
    "font-family",
    "font-size",
    "font-style",
    "font-weight",
    "letter-spacing",
    "line-height",
    "marker-end",
    "marker-mid",
    "marker-start",
    "opacity",
    "paint-order",
    "stroke",
    "stroke-dasharray",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-opacity",
    "stroke-width",
    "text-anchor",
    "text-decoration",
    "transform",
    "visibility",
    "white-space",
  ];

  inlineProperties.forEach((property) => {
    const value = computedStyle.getPropertyValue(property);
    if (value) {
      (target as HTMLElement).style.setProperty(property, value);
    }
  });

  Array.from(source.children).forEach((sourceChild, index) => {
    const targetChild = target.children.item(index);
    if (targetChild) {
      inlineComputedSvgStyles(sourceChild, targetChild);
    }
  });
};

const serializeRenderedSvgMarkupForExport = (svgMarkup: string) => {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "1600px";
  container.style.background = "#ffffff";
  container.style.pointerEvents = "none";
  container.innerHTML = svgMarkup;
  document.body.appendChild(container);

  try {
    const renderedSvg = container.querySelector("svg");
    if (!renderedSvg) {
      throw new Error("PNG export requires SVG markup.");
    }

    const clonedSvg = renderedSvg.cloneNode(true) as SVGSVGElement;
    inlineComputedSvgStyles(renderedSvg, clonedSvg);
    return serializeSvgElementForExport(clonedSvg);
  } finally {
    container.remove();
  }
};

export const downloadSvgElementAsPng = async (
  svgElement: SVGSVGElement,
  filename: string,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const { height, markup, width } = serializeSvgElementForExport(svgElement);
  await downloadPreparedSvgMarkupAsPng(markup, width, height, filename);
};

export const downloadSvgMarkupAsPng = async (
  svgMarkup: string,
  filename: string,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const { height, markup, width } = serializeRenderedSvgMarkupForExport(svgMarkup);
  await downloadPreparedSvgMarkupAsPng(markup, width, height, filename);
};

export const downloadTextAsPdf = async (
  content: string,
  filename: string,
  title: string,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ format: "a4", unit: "pt" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 48;
  const lineHeight = 16;
  let cursorY = margin;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(title, margin, cursorY);
  cursorY += 30;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);

  const lines = pdf.splitTextToSize(content, pageWidth - margin * 2) as string[];
  lines.forEach((line) => {
    if (cursorY > pageHeight - margin) {
      pdf.addPage();
      cursorY = margin;
    }

    pdf.text(line, margin, cursorY);
    cursorY += lineHeight;
  });

  pdf.save(filename);
};

export const downloadSvgMarkupAsPdf = async (
  svgMarkup: string,
  filename: string,
  title: string,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const { height, markup, width } = serializeRenderedSvgMarkupForExport(svgMarkup);
  const canvas = await renderSvgMarkupToCanvas(markup, width, height);
  const { jsPDF } = await import("jspdf");
  const margin = 36;
  const titleHeight = 34;
  const pdfWidth = width + margin * 2;
  const pdfHeight = height + margin * 2 + titleHeight;
  const pdf = new jsPDF({
    format: [pdfWidth, pdfHeight],
    orientation: pdfWidth > pdfHeight ? "landscape" : "portrait",
    unit: "pt",
  });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(title, margin, margin);
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin + titleHeight, width, height);
  pdf.save(filename);
};

export const writeSvgMarkupToPrintableWindow = (
  printWindow: Window,
  svgMarkup: string,
  title: string,
) => {
  const safeTitle = title
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  printWindow.document.write(`
    <html>
      <head>
        <title>${safeTitle}</title>
        <style>
          @page { margin: 18mm; }
          body { margin: 0; font-family: Arial, sans-serif; color: #111; background: #fff; }
          h1 { margin: 0 0 16px; font-size: 20px; }
          .diagram { width: 100%; overflow: visible; }
          svg { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        <h1>${safeTitle}</h1>
        <div class="diagram">${svgMarkup}</div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
};

export const openSvgMarkupAsPrintablePdf = (
  svgMarkup: string,
  title: string,
) => {
  if (typeof window === "undefined") {
    return;
  }

  const printWindow = window.open("", "_blank", "width=1100,height=850");
  if (!printWindow) {
    throw new Error("Popup blocked while opening PDF export.");
  }

  writeSvgMarkupToPrintableWindow(printWindow, svgMarkup, title);
};
