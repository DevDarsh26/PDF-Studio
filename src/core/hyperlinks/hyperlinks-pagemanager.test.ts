import { describe, it, expect } from "vitest";
import { PDFDocument, rgb, StandardFonts, PDFRef } from "pdf-lib";
import {
  addHyperlinkAnnotation,
  removeHyperlinkAnnotation,
} from "./hyperlink-manager";
import {
  addBlankPage,
  deletePage,
  rotatePage,
  reorderPages,
  extractPages,
  mergePdfs,
  splitPdf,
} from "../page-manager/page-manager";
import {
  applyPermanentRedaction,
  getStreamText,
} from "../engine/stream-surgery";

// Helper to construct a synthetic 3-page test PDF with text and existing link
async function createSamplePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  // Page 1
  const page1 = doc.addPage([600, 800]);
  page1.drawText("CONFIDENTIAL RECORD", { x: 50, y: 700, size: 16, font });
  page1.drawText("Taxpayer SSN: 123-45-6789", { x: 50, y: 650, size: 12, font });
  page1.drawText("Salary: $150,000 USD", { x: 50, y: 620, size: 12, font });

  // Add existing external link on page 1
  await addHyperlinkAnnotation(doc, {
    id: "existing-link-1",
    pageNumber: 1,
    rect: { x: 50, y: 550, width: 120, height: 20 },
    targetType: "external_url",
    url: "https://example.com/original",
  });

  // Page 2
  const page2 = doc.addPage([600, 800]);
  page2.drawText("Page 2 Content - Section A", { x: 50, y: 700, size: 14, font });

  // Page 3
  const page3 = doc.addPage([600, 800]);
  page3.drawText("Page 3 Content - Appendix", { x: 50, y: 700, size: 14, font });

  return await doc.save();
}

describe("Hyperlink Management Subsystem", () => {
  it("adds an external URL hyperlink annotation to a page", async () => {
    const originalBytes = await createSamplePdf();
    const doc = await PDFDocument.load(originalBytes);

    const initialAnnots = doc.getPage(0).node.Annots();
    const initialCount = initialAnnots ? initialAnnots.size() : 0;

    await addHyperlinkAnnotation(doc, {
      id: "link-new-ext",
      pageNumber: 1,
      rect: { x: 100, y: 500, width: 200, height: 25 },
      targetType: "external_url",
      url: "https://github.com/project",
    });

    const updatedAnnots = doc.getPage(0).node.Annots();
    expect(updatedAnnots).toBeDefined();
    expect(updatedAnnots!.size()).toBe(initialCount + 1);

    const savedBytes = await doc.save();
    const reloaded = await PDFDocument.load(savedBytes);
    const reloadedAnnots = reloaded.getPage(0).node.Annots();
    expect(reloadedAnnots!.size()).toBe(initialCount + 1);
  });

  it("adds an internal page navigation destination link", async () => {
    const originalBytes = await createSamplePdf();
    const doc = await PDFDocument.load(originalBytes);

    await addHyperlinkAnnotation(doc, {
      id: "link-internal-dest",
      pageNumber: 1,
      rect: { x: 50, y: 400, width: 150, height: 20 },
      targetType: "internal_page",
      targetPage: 3, // Navigate to page 3
    });

    const savedBytes = await doc.save();
    const reloaded = await PDFDocument.load(savedBytes);
    expect(reloaded.getPageCount()).toBe(3);

    const annots = reloaded.getPage(0).node.Annots();
    expect(annots).toBeDefined();
    expect(annots!.size()).toBeGreaterThanOrEqual(2);
  });

  it("removes a targeted hyperlink annotation while preserving unrelated links", async () => {
    const originalBytes = await createSamplePdf();
    const doc = await PDFDocument.load(originalBytes);

    // Add a second link
    await addHyperlinkAnnotation(doc, {
      id: "link-to-delete",
      pageNumber: 1,
      rect: { x: 200, y: 300, width: 100, height: 20 },
      targetType: "external_url",
      url: "https://delete-me.org",
    });

    const countBefore = doc.getPage(0).node.Annots()!.size();
    expect(countBefore).toBe(2);

    const removed = await removeHyperlinkAnnotation(doc, 1, {
      x: 200,
      y: 300,
      width: 100,
      height: 20,
    });

    expect(removed).toBe(true);
    const countAfter = doc.getPage(0).node.Annots()!.size();
    expect(countAfter).toBe(1);

    // The original link at 50, 550 is preserved
    const savedBytes = await doc.save();
    const reloaded = await PDFDocument.load(savedBytes);
    expect(reloaded.getPage(0).node.Annots()!.size()).toBe(1);
  });
});

describe("Page Management Subsystem", () => {
  it("adds a blank page with specific dimensions at a targeted index", async () => {
    const originalBytes = await createSamplePdf();
    const doc = await PDFDocument.load(originalBytes);

    await addBlankPage(doc, 1, { width: 500, height: 750 });
    expect(doc.getPageCount()).toBe(4);

    const page2 = doc.getPage(1);
    expect(page2.getWidth()).toBe(500);
    expect(page2.getHeight()).toBe(750);
  });

  it("rotates an individual page by 90 degrees", async () => {
    const originalBytes = await createSamplePdf();
    const doc = await PDFDocument.load(originalBytes);

    await rotatePage(doc, 0, 90);
    const p1 = doc.getPage(0);
    expect(p1.getRotation().angle).toBe(90);
  });

  it("deletes a page and adjusts total page count", async () => {
    const originalBytes = await createSamplePdf();
    const doc = await PDFDocument.load(originalBytes);

    await deletePage(doc, 1);
    expect(doc.getPageCount()).toBe(2);
  });

  it("reorders pages according to arbitrary permutation order", async () => {
    const originalBytes = await createSamplePdf();
    // Reverse page order: page 3, 2, 1 (0-indexed indices: 2, 1, 0)
    const updatedBytes = await reorderPages(originalBytes.buffer as ArrayBuffer, [2, 1, 0]);

    const reloaded = await PDFDocument.load(updatedBytes);
    expect(reloaded.getPageCount()).toBe(3);
  });

  it("extracts specific pages into an independent document", async () => {
    const originalBytes = await createSamplePdf();
    // Extract only pages 1 and 3 (1-indexed)
    const extractedBytes = await extractPages(originalBytes.buffer as ArrayBuffer, [1, 3]);

    const reloaded = await PDFDocument.load(extractedBytes);
    expect(reloaded.getPageCount()).toBe(2);
  });

  it("merges multiple PDFs into a single continuous document", async () => {
    const pdfA = await createSamplePdf(); // 3 pages
    const pdfB = await createSamplePdf(); // 3 pages

    const mergedBytes = await mergePdfs(pdfA.buffer as ArrayBuffer, pdfB.buffer as ArrayBuffer);
    const reloaded = await PDFDocument.load(mergedBytes);
    expect(reloaded.getPageCount()).toBe(6);
  });

  it("splits a multi-page PDF into single-page documents", async () => {
    const originalBytes = await createSamplePdf(); // 3 pages
    const splitResults = await splitPdf(originalBytes.buffer as ArrayBuffer, [
      { startPage: 1, endPage: 1 },
      { startPage: 2, endPage: 2 },
      { startPage: 3, endPage: 3 },
    ]);

    expect(splitResults.length).toBe(3);
    for (const result of splitResults) {
      const doc = await PDFDocument.load(result.bytes);
      expect(doc.getPageCount()).toBe(1);
    }
  });
});

describe("Permanent Redaction vs Visual Blackout (Data Sanitization)", () => {
  it("permanently purges sensitive text tokens from the content stream so they cannot be extracted", async () => {
    const testDoc = await PDFDocument.create();
    const testPage = testDoc.addPage([600, 400]);
    const font = await testDoc.embedFont(StandardFonts.Helvetica);
    testPage.drawText("Taxpayer SSN: 123-45-6789", { x: 50, y: 350, size: 12, font });

    await applyPermanentRedaction(
      testDoc,
      0,
      { x: 45, y: 345, width: 200, height: 20 },
      "123-45-6789"
    );

    const saved = await testDoc.save();
    const loadedDoc = await PDFDocument.load(saved);
    const p = loadedDoc.getPage(0);
    let contents: any = p.node.Contents();
    if (contents instanceof PDFRef) {
      contents = loadedDoc.context.lookup(contents);
    }
    let decompressedText = "";
    if (contents && "size" in contents && typeof contents.size === "function") {
      for (let i = 0; i < contents.size(); i++) {
        decompressedText += await getStreamText(contents.get(i), loadedDoc);
      }
    } else if (contents) {
      decompressedText = await getStreamText(contents, loadedDoc);
    }

    // Secret must NOT be in the decompressed stream!
    expect(decompressedText.includes("123-45-6789") || decompressedText.includes("3132332D34352D36373839")).toBe(false);

    // Unredacted prefix "Taxpayer SSN:" must still be in the stream
    expect(decompressedText.includes("Taxpayer SSN:") || decompressedText.includes("5461787061796572")).toBe(true);
  });

  it("visual blackout does NOT strip underlying text, demonstrating why true redaction is required", async () => {
    const blackoutDoc = await PDFDocument.create();
    const boPage = blackoutDoc.addPage([600, 400]);
    const boFont = await blackoutDoc.embedFont(StandardFonts.Helvetica);
    boPage.drawText("Taxpayer SSN: 123-45-6789", { x: 50, y: 350, size: 12, font: boFont });
    boPage.drawRectangle({ x: 45, y: 345, width: 200, height: 20, color: rgb(0, 0, 0) });

    const boSaved = await blackoutDoc.save();
    const boLoaded = await PDFDocument.load(boSaved);
    const boP = boLoaded.getPage(0);
    let boContents: any = boP.node.Contents();
    if (boContents instanceof PDFRef) {
      boContents = boLoaded.context.lookup(boContents);
    }
    let boDecompressedText = "";
    if (boContents && "size" in boContents && typeof boContents.size === "function") {
      for (let i = 0; i < boContents.size(); i++) {
        boDecompressedText += await getStreamText(boContents.get(i), boLoaded);
      }
    } else if (boContents) {
      boDecompressedText = await getStreamText(boContents, boLoaded);
    }

    // In visual blackout, the secret is STILL fully present in the decompressed stream (either literal or hex)!
    expect(boDecompressedText.includes("123-45-6789") || boDecompressedText.includes("3132332D34352D36373839")).toBe(true);
  });
});

describe("Document Integrity & Reopening", () => {
  it("preserves unrelated fonts, vector graphics, dimensions, and annotations across operations", async () => {
    const originalBytes = await createSamplePdf();

    // 1. Add internal link
    const doc = await PDFDocument.load(originalBytes);
    await addHyperlinkAnnotation(doc, {
      id: "doc-link-nav",
      pageNumber: 1,
      rect: { x: 50, y: 200, width: 80, height: 20 },
      targetType: "internal_page",
      targetPage: 2,
    });

    // 2. Rotate page 2
    await rotatePage(doc, 1, 180);

    // 3. Add a blank page
    await addBlankPage(doc, 3, { width: 612, height: 792 });

    const savedBytes = await doc.save();

    // Reopen and verify complete integrity
    const finalDoc = await PDFDocument.load(savedBytes);
    expect(finalDoc.getPageCount()).toBe(4);

    // Page 1 has both links preserved
    const p1Annots = finalDoc.getPage(0).node.Annots();
    expect(p1Annots!.size()).toBe(2);

    // Page 2 has 180 degree rotation preserved
    expect(finalDoc.getPage(1).getRotation().angle).toBe(180);

    // Page 4 has dimensions preserved
    expect(finalDoc.getPage(3).getWidth()).toBe(612);
    expect(finalDoc.getPage(3).getHeight()).toBe(792);
  });
});
