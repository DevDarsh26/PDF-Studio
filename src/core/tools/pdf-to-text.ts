/**
 * PDF-to-text extraction using pdfjs-dist.
 *
 * Extracts all textual content from every page of a PDF document,
 * preserving reading order. Runs 100 % client-side.
 */

import * as pdfjsLib from "pdfjs-dist";

/** Ensure the PDF.js web-worker is configured. */
function ensureWorker(): void {
  if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
}

/**
 * Extract all text from every page of a PDF.
 *
 * Text items are concatenated in the order returned by PDF.js
 * (`getTextContent`). Pages are separated by newlines.
 *
 * @param pdfBytes  - Raw PDF file bytes.
 * @param onProgress - Optional callback invoked after each page is processed.
 * @returns The full extracted text as a single string.
 *
 * @example
 * ```ts
 * const text = await pdfToText(buffer, (cur, total) =>
 *   console.log(`Page ${cur}/${total}`)
 * );
 * ```
 */
export async function pdfToText(
  pdfBytes: ArrayBuffer,
  onProgress?: (current: number, total: number) => void,
): Promise<string> {
  try {
    ensureWorker();

    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
    const totalPages = pdf.numPages;
    const pageTexts: string[] = [];

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      // Concatenate all text items, inserting spaces between items on the
      // same line and newlines where the PDF indicates an end-of-line.
      const lineText = content.items
        .filter((item: any) => "str" in item)
        .map((item: any) => item.str)
        .join(" ");

      pageTexts.push(lineText);

      onProgress?.(i, totalPages);
    }

    await pdf.destroy();

    return pageTexts.join("\n");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`pdfToText failed: ${msg}`);
  }
}
