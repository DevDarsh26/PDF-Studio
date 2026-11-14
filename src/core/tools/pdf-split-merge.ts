import { PDFDocument } from "pdf-lib";
import { ConversionProgress } from "./types";

/**
 * Merge multiple PDF documents into a single document in sequential order.
 */
export async function mergePdfs(
  documents: { bytes: ArrayBuffer; name: string }[],
  onProgress?: (p: ConversionProgress) => void
): Promise<Uint8Array> {
  if (documents.length === 0) {
    throw new Error("At least one PDF file must be provided to merge.");
  }

  const mergedPdf = await PDFDocument.create();
  const total = documents.length;

  for (let i = 0; i < total; i++) {
    const docItem = documents[i];
    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        stage: `Merging ${docItem.name} (${i + 1}/${total})...`,
        percentage: Math.round((i / total) * 100),
      });
    }

    const sourcePdf = await PDFDocument.load(docItem.bytes.slice(0), {
      ignoreEncryption: true,
    });
    const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
    for (const page of copiedPages) {
      mergedPdf.addPage(page);
    }
  }

  if (onProgress) {
    onProgress({ current: total, total, stage: "Saving merged PDF...", percentage: 100 });
  }

  return await mergedPdf.save({ useObjectStreams: true });
}

/**
 * Split a PDF into individual 1-page documents.
 */
export async function splitPdfByPages(
  pdfBytes: ArrayBuffer,
  onProgress?: (p: ConversionProgress) => void
): Promise<{ pageNumber: number; bytes: Uint8Array; fileName: string }[]> {
  const sourcePdf = await PDFDocument.load(pdfBytes.slice(0), { ignoreEncryption: true });
  const total = sourcePdf.getPageCount();
  const results: { pageNumber: number; bytes: Uint8Array; fileName: string }[] = [];

  for (let i = 0; i < total; i++) {
    const pageNum = i + 1;
    if (onProgress) {
      onProgress({
        current: pageNum,
        total,
        stage: `Splitting page ${pageNum} of ${total}...`,
        percentage: Math.round((i / total) * 100),
      });
    }

    const singlePagePdf = await PDFDocument.create();
    const [copiedPage] = await singlePagePdf.copyPages(sourcePdf, [i]);
    singlePagePdf.addPage(copiedPage);

    const bytes = await singlePagePdf.save();
    results.push({
      pageNumber: pageNum,
      bytes,
      fileName: `page-${pageNum}.pdf`,
    });
  }

  if (onProgress) {
    onProgress({ current: total, total, stage: "Split complete", percentage: 100 });
  }

  return results;
}

/**
 * Parse human page ranges string (e.g. "1-3, 5, 8-10") into 0-indexed page numbers.
 */
export function parsePageRangeString(rangeStr: string, totalPages: number): number[] {
  const clean = rangeStr.replace(/\s+/g, "");
  const parts = clean.split(",");
  const indices = new Set<number>();

  for (const part of parts) {
    if (!part) continue;
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = Math.max(1, parseInt(startStr, 10));
      const end = Math.min(totalPages, parseInt(endStr, 10));
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let p = start; p <= end; p++) {
          indices.add(p - 1);
        }
      }
    } else {
      const page = parseInt(part, 10);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        indices.add(page - 1);
      }
    }
  }

  return Array.from(indices).sort((a, b) => a - b);
}

/**
 * Extract specific page ranges from a PDF and bundle into a new PDF.
 */
export async function extractPageRanges(
  pdfBytes: ArrayBuffer,
  rangeStr: string,
  onProgress?: (p: ConversionProgress) => void
): Promise<Uint8Array> {
  const sourcePdf = await PDFDocument.load(pdfBytes.slice(0), { ignoreEncryption: true });
  const total = sourcePdf.getPageCount();
  const pageIndices = parsePageRangeString(rangeStr, total);

  if (pageIndices.length === 0) {
    throw new Error(`Invalid page range "${rangeStr}". Document has ${total} pages.`);
  }

  if (onProgress) {
    onProgress({ current: 1, total: 2, stage: `Extracting ${pageIndices.length} pages...`, percentage: 50 });
  }

  const outputPdf = await PDFDocument.create();
  const copiedPages = await outputPdf.copyPages(sourcePdf, pageIndices);
  for (const page of copiedPages) {
    outputPdf.addPage(page);
  }

  if (onProgress) {
    onProgress({ current: 2, total: 2, stage: "Saving extracted PDF...", percentage: 100 });
  }

  return await outputPdf.save({ useObjectStreams: true });
}
