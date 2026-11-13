import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFRef,
  PDFString,
} from "pdf-lib";
import { AddHyperlinkOperation } from "../models/operations";
import { Rect } from "../models/geometry";

/**
 * Hyperlink Manager:
 * Safely creates, edits, and removes PDF link annotations while preserving
 * existing links, destinations, and unrelated annotations.
 */

export async function addHyperlinkAnnotation(
  pdfDoc: PDFDocument,
  pageIndexOrLink: number | AddHyperlinkOperation,
  maybeLink?: AddHyperlinkOperation
): Promise<PDFRef> {
  let pageIndex: number;
  let link: AddHyperlinkOperation;

  if (typeof pageIndexOrLink === "number") {
    pageIndex = pageIndexOrLink;
    link = maybeLink!;
  } else {
    link = pageIndexOrLink;
    pageIndex = (link.pageNumber ? link.pageNumber - 1 : 0);
  }

  const page = pdfDoc.getPage(pageIndex);
  const minX = Math.min(link.rect.x, link.rect.x + link.rect.width);
  const maxX = Math.max(link.rect.x, link.rect.x + link.rect.width);
  const minY = Math.min(link.rect.y, link.rect.y + link.rect.height);
  const maxY = Math.max(link.rect.y, link.rect.y + link.rect.height);

  let annotObj: any;

  if (link.targetType === "internal_page" && link.targetPage !== undefined) {
    const targetIdx = Math.max(
      0,
      Math.min(pdfDoc.getPageCount() - 1, link.targetPage - 1)
    );
    const targetPage = pdfDoc.getPage(targetIdx);

    annotObj = pdfDoc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [minX, minY, maxX, maxY],
      Border: [0, 0, 0],
      C: [0.15, 0.45, 0.85],
      Dest: [targetPage.ref, "XYZ", null, null, null],
    });
  } else {
    annotObj = pdfDoc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [minX, minY, maxX, maxY],
      Border: [0, 0, 0],
      C: [0.15, 0.45, 0.85],
      A: {
        Type: "Action",
        S: "URI",
        URI: PDFString.of(link.url || "https://"),
      },
    });
  }

  const annotRef = pdfDoc.context.register(annotObj);

  // Attach to page /Annots
  let annots: any = page.node.lookup(PDFName.of("Annots"));
  if (!annots) {
    page.node.set(PDFName.of("Annots"), pdfDoc.context.obj([annotRef]));
  } else if (annots instanceof PDFArray) {
    annots.push(annotRef);
  } else if (annots instanceof PDFRef) {
    const lookedUp = pdfDoc.context.lookup(annots);
    if (lookedUp instanceof PDFArray) {
      lookedUp.push(annotRef);
    }
  }

  return annotRef;
}

export async function removeHyperlinkAnnotation(
  pdfDoc: PDFDocument,
  pageIndexOrNumber: number,
  targetRect: Rect
): Promise<boolean> {
  const pageIndex =
    pageIndexOrNumber >= 1 && pageIndexOrNumber <= pdfDoc.getPageCount()
      ? pageIndexOrNumber - 1
      : 0;
  const page = pdfDoc.getPage(pageIndex);
  let annots: any = page.node.lookup(PDFName.of("Annots"));
  if (annots instanceof PDFRef) {
    annots = pdfDoc.context.lookup(annots);
  }

  if (!annots || !(annots instanceof PDFArray)) return false;

  let removed = false;
  const newArray: any[] = [];

  for (let i = 0; i < annots.size(); i++) {
    const annotRef = annots.get(i);
    const annot =
      annotRef instanceof PDFRef ? pdfDoc.context.lookup(annotRef) : annotRef;

    const annotDict = annot as any;
    if (annotDict && typeof annotDict.lookup === "function") {
      const subtype = annotDict.lookup(PDFName.of("Subtype"));
      if (subtype?.toString() === "/Link") {
        const rectObj = annotDict.lookup(PDFName.of("Rect"));
        if (rectObj instanceof PDFArray && rectObj.size() >= 4) {
          const x1 = (rectObj.get(0) as any).asNumber?.() ?? 0;
          const y1 = (rectObj.get(1) as any).asNumber?.() ?? 0;
          const x2 = (rectObj.get(2) as any).asNumber?.() ?? 0;
          const y2 = (rectObj.get(3) as any).asNumber?.() ?? 0;

          const rMinX = Math.min(x1, x2);
          const rMaxX = Math.max(x1, x2);
          const rMinY = Math.min(y1, y2);
          const rMaxY = Math.max(y1, y2);

          // Check if coordinates match within 4pt tolerance
          const matches =
            Math.abs(rMinX - targetRect.x) < 4 &&
            Math.abs(rMinY - targetRect.y) < 4;

          if (matches) {
            removed = true;
            continue; // Skip this annot (removes it)
          }
        }
      }
    }
    newArray.push(annotRef);
  }

  if (removed) {
    page.node.set(PDFName.of("Annots"), pdfDoc.context.obj(newArray));
  }

  return removed;
}
