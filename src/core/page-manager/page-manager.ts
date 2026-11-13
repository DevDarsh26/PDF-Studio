import { PDFDocument, degrees } from "pdf-lib";
import { Dimensions } from "../models/geometry";

/**
 * Page Management Engine:
 * Add, delete, reorder, rotate, extract, merge, and split PDF documents
 * 100% locally in the browser with full preservation of fonts, images, and vectors.
 */

export async function addBlankPage(
  doc: PDFDocument,
  insertAtIndex?: number,
  dimensions: Dimensions = { width: 595.28, height: 841.89 } // Default A4
): Promise<void> {
  const pageDims: [number, number] = [dimensions.width, dimensions.height];
  if (
    insertAtIndex !== undefined &&
    insertAtIndex >= 0 &&
    insertAtIndex < doc.getPageCount()
  ) {
    doc.insertPage(insertAtIndex, pageDims);
  } else {
    doc.addPage(pageDims);
  }
}

export async function deletePage(
  doc: PDFDocument,
  pageIndex: number
): Promise<void> {
  if (doc.getPageCount() <= 1) {
    throw new Error("Cannot delete the only page in a document.");
  }
  if (pageIndex < 0 || pageIndex >= doc.getPageCount()) {
    throw new Error(`Invalid page index: ${pageIndex}.`);
  }
  doc.removePage(pageIndex);
}

export async function rotatePage(
  doc: PDFDocument,
  pageIndex: number,
  rotationDegrees: 90 | 180 | 270
): Promise<void> {
  if (pageIndex < 0 || pageIndex >= doc.getPageCount()) {
    throw new Error(`Invalid page index: ${pageIndex}.`);
  }
  const page = doc.getPage(pageIndex);
  const currentAngle = page.getRotation().angle;
  const newAngle = (currentAngle + rotationDegrees) % 360;
  page.setRotation(degrees(newAngle));
}

export async function reorderPages(
  sourceBytes: ArrayBuffer,
  newOrderZeroIndexed: number[]
): Promise<Uint8Array> {
  const sourceDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const newDoc = await PDFDocument.create();

  const copiedPages = await newDoc.copyPages(sourceDoc, newOrderZeroIndexed);
  for (const p of copiedPages) {
    newDoc.addPage(p);
  }

  return await newDoc.save();
}

export async function extractPages(
  sourceBytes: ArrayBuffer,
  pageNumbersOneIndexed: number[]
): Promise<Uint8Array> {
  const sourceDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const newDoc = await PDFDocument.create();

  const zeroIndices = pageNumbersOneIndexed.map((p) => p - 1);
  const copiedPages = await newDoc.copyPages(sourceDoc, zeroIndices);
  for (const p of copiedPages) {
    newDoc.addPage(p);
  }

  return await newDoc.save();
}

export async function mergePdfs(
  primaryBytes: ArrayBuffer,
  otherPdfBytes: ArrayBuffer,
  insertAtIndexZeroIndexed?: number
): Promise<Uint8Array> {
  const primaryDoc = await PDFDocument.load(primaryBytes, { ignoreEncryption: true });
  const otherDoc = await PDFDocument.load(otherPdfBytes, { ignoreEncryption: true });

  const otherIndices = otherDoc.getPageIndices();
  const copiedPages = await primaryDoc.copyPages(otherDoc, otherIndices);

  if (
    insertAtIndexZeroIndexed !== undefined &&
    insertAtIndexZeroIndexed >= 0 &&
    insertAtIndexZeroIndexed < primaryDoc.getPageCount()
  ) {
    for (let i = 0; i < copiedPages.length; i++) {
      primaryDoc.insertPage(insertAtIndexZeroIndexed + i, copiedPages[i]);
    }
  } else {
    for (const p of copiedPages) {
      primaryDoc.addPage(p);
    }
  }

  return await primaryDoc.save();
}

export async function splitPdf(
  sourceBytes: ArrayBuffer,
  rangesOneIndexed: { startPage: number; endPage: number }[]
): Promise<{ range: string; bytes: Uint8Array }[]> {
  const sourceDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const results: { range: string; bytes: Uint8Array }[] = [];

  for (const r of rangesOneIndexed) {
    const splitDoc = await PDFDocument.create();
    const indices: number[] = [];
    for (let p = r.startPage; p <= r.endPage; p++) {
      if (p >= 1 && p <= sourceDoc.getPageCount()) {
        indices.push(p - 1);
      }
    }

    if (indices.length > 0) {
      const copiedPages = await splitDoc.copyPages(sourceDoc, indices);
      for (const cp of copiedPages) {
        splitDoc.addPage(cp);
      }
      const bytes = await splitDoc.save();
      results.push({
        range: `pages-${r.startPage}-to-${r.endPage}`,
        bytes,
      });
    }
  }

  return results;
}
