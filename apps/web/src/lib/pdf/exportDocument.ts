"use client";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/** jsPDF letter size (mm). */
const LETTER_WIDTH_MM = 215.9;
const LETTER_HEIGHT_MM = 279.4;
/** Page margin when placing captured content — single margin layer (preview padding is stripped on capture). */
export const PDF_MARGIN_MM = 5;
const PAGE_CONTENT_HEIGHT_MM = LETTER_HEIGHT_MM - PDF_MARGIN_MM * 2;
/** Printable width in CSS px at 96dpi — capture size matches PDF content area 1:1. */
export const LETTER_CONTENT_WIDTH_PX = Math.round(
  ((LETTER_WIDTH_MM - PDF_MARGIN_MM * 2) / 25.4) * 96
);
/** @deprecated Use LETTER_CONTENT_WIDTH_PX for export; full page width for layout reference. */
export const LETTER_WIDTH_PX = Math.round((LETTER_WIDTH_MM / 25.4) * 96);

/** Scale for html2canvas — higher = sharper PDF (especially logos and signatures). */
const PDF_DOWNLOAD_SCALE = 2.75;
const PDF_EMAIL_SCALE = 2.25;
const PDF_EMAIL_JPEG_QUALITY = 0.93;

export interface PdfExportOptions {
  watermark?: boolean;
  /** JPEG at slightly lower scale for email attachments (Vercel ~4.5 MB body limit). */
  forEmail?: boolean;
  scale?: number;
}

export const FREE_PLAN_WATERMARK_TEXT = "DOC SOLID FREE";

type ImageFormat = "PNG" | "JPEG";

/** Elements that should never be sliced in half by a page break. */
const PAGE_BREAK_GUARD_SELECTOR =
  "tr, .doc-total-row, .doc-field, .doc-signature-block, .doc-preview-letterhead-poc";

/** Never shrink a page below this fraction of a full page just to dodge a split element. */
const MIN_PAGE_FRACTION = 0.55;

/**
 * Choose page-break y-positions (in captured-canvas px) that land in the gaps
 * between rows/fields/signature blocks instead of through the middle of one.
 * Falls back to even slicing past the last guarded element.
 */
export interface GuardSpan {
  top: number;
  bottom: number;
}

/**
 * Pure math core of the page-break search — takes guarded element spans and
 * picks break points that never land inside one. Exported (and framework-free)
 * so it can be unit tested without a browser/DOM.
 */
export function computeBreakPoints(
  spans: GuardSpan[],
  totalHeightPx: number,
  pageHeightPx: number
): number[] {
  if (pageHeightPx <= 0 || totalHeightPx <= pageHeightPx) return [totalHeightPx];

  const sorted = [...spans].sort((a, b) => a.top - b.top);
  const breaks: number[] = [];
  let cursor = 0;
  let guard = 0;

  while (cursor < totalHeightPx && guard < 10000) {
    guard += 1;
    let candidate = Math.min(cursor + pageHeightPx, totalHeightPx);
    if (candidate < totalHeightPx) {
      const collision = sorted.find((s) => candidate > s.top + 0.5 && candidate < s.bottom - 0.5);
      if (collision) {
        candidate = Math.max(collision.top, cursor + pageHeightPx * MIN_PAGE_FRACTION);
      }
    }
    // Guarantee forward progress even if a pathological span layout would
    // otherwise stall the cursor (e.g. overlapping spans taller than a page).
    if (candidate <= cursor) candidate = Math.min(cursor + pageHeightPx, totalHeightPx);
    breaks.push(candidate);
    cursor = candidate;
  }

  return breaks;
}

function findSafePageBreaks(
  element: HTMLElement,
  canvasHeightPx: number,
  pageHeightPx: number
): number[] {
  if (pageHeightPx <= 0 || canvasHeightPx <= pageHeightPx) return [canvasHeightPx];

  const rect = element.getBoundingClientRect();
  const scaleY = rect.height > 0 ? canvasHeightPx / rect.height : 1;

  const spans: GuardSpan[] = [];
  element.querySelectorAll<HTMLElement>(PAGE_BREAK_GUARD_SELECTOR).forEach((el) => {
    const r = el.getBoundingClientRect();
    const top = (r.top - rect.top) * scaleY;
    const bottom = (r.bottom - rect.top) * scaleY;
    if (bottom > top) spans.push({ top, bottom });
  });

  return computeBreakPoints(spans, canvasHeightPx, pageHeightPx);
}

/** Crop a vertical slice of a canvas onto a new white-backed canvas. */
function sliceCanvasVertical(source: HTMLCanvasElement, yStart: number, yEnd: number): HTMLCanvasElement {
  const height = Math.max(1, Math.round(yEnd - yStart));
  const out = document.createElement("canvas");
  out.width = source.width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, 0, Math.round(yStart), source.width, height, 0, 0, source.width, height);
  return out;
}

function addCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  startNewPage: boolean,
  imageFormat: ImageFormat = "PNG",
  jpegQuality = 0.85,
  pageBreaksPx?: number[]
): jsPDF {
  const margin = PDF_MARGIN_MM;
  const contentWidth = LETTER_WIDTH_MM - margin * 2;
  const imgWidth = contentWidth;
  const pxPerMm = canvas.width / contentWidth;
  const breaks = pageBreaksPx?.length ? pageBreaksPx : [canvas.height];

  if (startNewPage && pdf.getNumberOfPages() > 0) {
    pdf.addPage();
  } else if (pdf.getNumberOfPages() === 0) {
    pdf.addPage();
  }

  let yStart = 0;
  breaks.forEach((yEnd, index) => {
    if (index > 0) pdf.addPage();
    const slice = yStart === 0 && yEnd === canvas.height ? canvas : sliceCanvasVertical(canvas, yStart, yEnd);
    const sliceHeightMm = (yEnd - yStart) / pxPerMm;
    const imgData =
      imageFormat === "JPEG" ? slice.toDataURL("image/jpeg", jpegQuality) : slice.toDataURL("image/png");
    pdf.addImage(imgData, imageFormat, margin, margin, imgWidth, sliceHeightMm);
    yStart = yEnd;
  });

  return pdf;
}

function applyWatermark(pdf: jsPDF): void {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(48);
    pdf.setTextColor(200, 200, 200);
    pdf.text(FREE_PLAN_WATERMARK_TEXT, pageWidth / 2, pageHeight / 2, {
      align: "center",
      angle: 45,
    });
  }
}

function resolveCaptureElement(elementId: string): HTMLElement {
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`Export element not found: ${elementId}`);
  if (el.classList.contains("doc-preview")) return el;
  const inner = el.querySelector(".doc-preview") as HTMLElement | null;
  return inner ?? el;
}

async function prepareExportEnvironment(): Promise<() => void> {
  const stack = document.querySelector(".packets-export-stack") as HTMLElement | null;
  if (!stack) {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return () => undefined;
  }

  const prev = {
    visibility: stack.style.visibility,
    opacity: stack.style.opacity,
  };
  stack.style.visibility = "visible";
  stack.style.opacity = "1";

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  return () => {
    stack.style.visibility = prev.visibility;
    stack.style.opacity = prev.opacity;
  };
}

function prepareElementForCapture(element: HTMLElement): () => void {
  const prev = {
    width: element.style.width,
    maxWidth: element.style.maxWidth,
    boxSizing: element.style.boxSizing,
  };
  element.classList.add("doc-preview-capture");
  element.style.width = `${LETTER_CONTENT_WIDTH_PX}px`;
  element.style.maxWidth = `${LETTER_CONTENT_WIDTH_PX}px`;
  element.style.boxSizing = "border-box";
  return () => {
    element.classList.remove("doc-preview-capture");
    element.style.width = prev.width;
    element.style.maxWidth = prev.maxWidth;
    element.style.boxSizing = prev.boxSizing;
  };
}

function prepareCloneForCapture(clonedDoc: Document, root: HTMLElement): void {
  root.querySelectorAll("img").forEach((img) => {
    img.crossOrigin = "anonymous";
    img.style.imageRendering = "auto";
  });
}

interface CapturedDocument {
  canvas: HTMLCanvasElement;
  pageBreaksPx: number[];
}

async function captureElementCanvas(
  element: HTMLElement,
  options?: PdfExportOptions
): Promise<CapturedDocument> {
  const scale =
    options?.scale ??
    (options?.forEmail ? PDF_EMAIL_SCALE : PDF_DOWNLOAD_SCALE);
  const restore = prepareElementForCapture(element);
  try {
    // Guarantee web fonts are fully loaded before rasterizing — otherwise
    // html2canvas can capture a fallback-font frame, producing blurry or
    // wrong-looking text in the exported PDF.
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: LETTER_CONTENT_WIDTH_PX,
      windowWidth: LETTER_CONTENT_WIDTH_PX,
      imageTimeout: 15000,
      onclone: (clonedDoc, clonedElement) => {
        prepareCloneForCapture(clonedDoc, clonedElement);
      },
    });
    // Measured while the element is still styled for capture (fixed width,
    // .doc-preview-capture layout) so positions line up with the canvas.
    const contentWidthMm = LETTER_WIDTH_MM - PDF_MARGIN_MM * 2;
    const pxPerMm = canvas.width / contentWidthMm;
    const pageHeightPx = PAGE_CONTENT_HEIGHT_MM * pxPerMm;
    const pageBreaksPx = findSafePageBreaks(element, canvas.height, pageHeightPx);
    return { canvas, pageBreaksPx };
  } finally {
    restore();
  }
}

async function renderPdfBlob(elementId: string, options?: PdfExportOptions): Promise<Blob> {
  const element = resolveCaptureElement(elementId);

  const { canvas, pageBreaksPx } = await captureElementCanvas(element, options);
  const imageFormat: ImageFormat = options?.forEmail ? "JPEG" : "PNG";
  const jpegQuality = options?.forEmail ? PDF_EMAIL_JPEG_QUALITY : 0.95;

  let pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  pdf = addCanvasToPdf(pdf, canvas, false, imageFormat, jpegQuality, pageBreaksPx);
  if (options?.watermark) applyWatermark(pdf);
  return pdf.output("blob");
}

function downloadPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportDocumentPdf(
  elementId: string,
  filename: string,
  options?: PdfExportOptions
): Promise<void> {
  const blob = await renderPdfBlob(elementId, options);
  downloadPdfBlob(blob, filename);
}

async function buildMultiPagePdf(elementIds: string[], options?: PdfExportOptions): Promise<jsPDF> {
  if (elementIds.length === 0) throw new Error("No documents to export");

  const restoreEnv = await prepareExportEnvironment();

  let pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  let added = false;

  const imageFormat: ImageFormat = options?.forEmail ? "JPEG" : "PNG";
  const jpegQuality = options?.forEmail ? PDF_EMAIL_JPEG_QUALITY : 0.95;

  try {
    for (const id of elementIds) {
      const element = resolveCaptureElement(id);
      const { canvas, pageBreaksPx } = await captureElementCanvas(element, options);
      pdf = addCanvasToPdf(pdf, canvas, added, imageFormat, jpegQuality, pageBreaksPx);
      added = true;
    }
  } finally {
    restoreEnv();
  }

  if (!added) throw new Error("No document previews found");
  if (options?.watermark) applyWatermark(pdf);
  return pdf;
}

function blobToBase64(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return btoa(binary);
  });
}

export async function exportMultipleElementsPdf(
  elementIds: string[],
  filename: string,
  options?: PdfExportOptions
): Promise<void> {
  const pdf = await buildMultiPagePdf(elementIds, options);
  downloadPdfBlob(pdf.output("blob"), filename);
}

export async function exportMultipleElementsPdfBase64(
  elementIds: string[],
  options?: PdfExportOptions
): Promise<string> {
  const pdf = await buildMultiPagePdf(elementIds, options);
  const blob = pdf.output("blob");
  return blobToBase64(blob);
}

export async function exportDocumentPdfBase64(
  elementId: string,
  options?: PdfExportOptions
): Promise<string> {
  const blob = await renderPdfBlob(elementId, options);
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function documentPdfFilename(title: string): string {
  const slug = title.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const date = new Date().toISOString().split("T")[0];
  return `${slug || "document"}-${date}.pdf`;
}

export function packetPdfFilename(packetName: string): string {
  const slug = packetName.replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9-]/g, "");
  const date = new Date().toISOString().split("T")[0];
  return `${slug || "packet"}-${date}.pdf`;
}
