"use client";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/** jsPDF letter size (mm). */
const LETTER_WIDTH_MM = 215.9;
/** Page margin when placing captured content — single margin layer (preview padding is stripped on capture). */
export const PDF_MARGIN_MM = 5;
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

function addCanvasToPdf(
  pdf: jsPDF,
  canvas: HTMLCanvasElement,
  startNewPage: boolean,
  imageFormat: ImageFormat = "PNG",
  jpegQuality = 0.85
): jsPDF {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = PDF_MARGIN_MM;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;
  const imgWidth = contentWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData =
    imageFormat === "JPEG"
      ? canvas.toDataURL("image/jpeg", jpegQuality)
      : canvas.toDataURL("image/png");

  if (startNewPage && pdf.getNumberOfPages() > 0) {
    pdf.addPage();
  }

  let heightLeft = imgHeight;
  let position = margin;
  let pageStarted = pdf.getNumberOfPages() === 0;

  if (pageStarted) {
    pdf.addPage();
    pageStarted = false;
  }

  pdf.addImage(imgData, imageFormat, margin, position, imgWidth, imgHeight);
  heightLeft -= contentHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight + margin;
    pdf.addPage();
    pdf.addImage(imgData, imageFormat, margin, position, imgWidth, imgHeight);
    heightLeft -= contentHeight;
  }

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

async function captureElementCanvas(
  element: HTMLElement,
  options?: PdfExportOptions
): Promise<HTMLCanvasElement> {
  const scale =
    options?.scale ??
    (options?.forEmail ? PDF_EMAIL_SCALE : PDF_DOWNLOAD_SCALE);
  const restore = prepareElementForCapture(element);
  try {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return await html2canvas(element, {
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
  } finally {
    restore();
  }
}

async function renderPdfBlob(elementId: string, options?: PdfExportOptions): Promise<Blob> {
  const element = resolveCaptureElement(elementId);

  const canvas = await captureElementCanvas(element, options);
  const imageFormat: ImageFormat = options?.forEmail ? "JPEG" : "PNG";
  const jpegQuality = options?.forEmail ? PDF_EMAIL_JPEG_QUALITY : 0.95;

  let pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  pdf = addCanvasToPdf(pdf, canvas, false, imageFormat, jpegQuality);
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
      const canvas = await captureElementCanvas(element, options);
      pdf = addCanvasToPdf(pdf, canvas, added, imageFormat, jpegQuality);
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
