import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { mergePdfs, splitPdfByPages, parsePageRangeString, extractPageRanges } from "./pdf-split-merge";
import { compressPdf } from "./pdf-compress";
import { protectPdfWithPassword } from "./pdf-password";
import { textOrOfficeToPdf, pdfToWordDocx, pdfToExcel } from "./pdf-office-converters";

async function createTestPdf(pagesCount: number = 2): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pagesCount; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`Sample Test Content Page ${i + 1}`, { x: 50, y: 800, size: 14 });
  }
  return await doc.save();
}

describe("PDF Studio — Core Tools & Converters Suite", () => {
  it("splits a multi-page PDF into individual pages", async () => {
    const pdfBytes = await createTestPdf(3);
    const pages = await splitPdfByPages(pdfBytes.buffer);
    expect(pages.length).toBe(3);
    expect(pages[0].fileName).toBe("page-1.pdf");
    expect(pages[1].fileName).toBe("page-2.pdf");
    expect(pages[2].fileName).toBe("page-3.pdf");

    // Each split page is a valid PDF
    const firstPageDoc = await PDFDocument.load(pages[0].bytes);
    expect(firstPageDoc.getPageCount()).toBe(1);
  });

  it("parses page range strings accurately", () => {
    expect(parsePageRangeString("1-3, 5", 6)).toEqual([0, 1, 2, 4]);
    expect(parsePageRangeString("2, 4-5", 5)).toEqual([1, 3, 4]);
    expect(parsePageRangeString("all", 3)).toEqual([]);
  });

  it("extracts specific page ranges from a PDF", async () => {
    const pdfBytes = await createTestPdf(4);
    const extracted = await extractPageRanges(pdfBytes.buffer, "1, 3");
    const doc = await PDFDocument.load(extracted);
    expect(doc.getPageCount()).toBe(2);
  });

  it("merges multiple PDFs into a single unified document", async () => {
    const pdf1 = await createTestPdf(2);
    const pdf2 = await createTestPdf(1);

    const merged = await mergePdfs([
      { bytes: pdf1.buffer, name: "doc1.pdf" },
      { bytes: pdf2.buffer, name: "doc2.pdf" },
    ]);

    const mergedDoc = await PDFDocument.load(merged);
    expect(mergedDoc.getPageCount()).toBe(3);
  });

  it("compresses a PDF client-side and optimizes streams", async () => {
    const pdfBytes = await createTestPdf(2);
    const result = await compressPdf(pdfBytes.buffer, "recommended");
    expect(result.compressedBytes).toBeDefined();
    expect(result.compressedSize).toBeGreaterThan(0);
    expect(result.originalSize).toBe(pdfBytes.byteLength);

    const reloaded = await PDFDocument.load(result.compressedBytes);
    expect(reloaded.getPageCount()).toBe(2);
  });

  it("applies client-side document protection", async () => {
    const pdfBytes = await createTestPdf(1);
    const protectedBytes = await protectPdfWithPassword(pdfBytes.buffer, "secret123");
    expect(protectedBytes.length).toBeGreaterThan(0);

    const doc = await PDFDocument.load(protectedBytes);
    expect(doc.getTitle()).toContain("[Protected]");
  });

  it("converts raw text and office documents into styled PDF pages", async () => {
    const textContent = "Financial Report\n\nRevenue: $1,200,000\nExpenses: $800,000\nNet Profit: $400,000";
    const generatedPdf = await textOrOfficeToPdf(textContent, "Financial Summary");
    expect(generatedPdf.length).toBeGreaterThan(0);

    const doc = await PDFDocument.load(generatedPdf);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("converts PDF text to Microsoft Word (.docx) package", async () => {
    const pdfBytes = await createTestPdf(2);
    const docxBlob = await pdfToWordDocx(pdfBytes.buffer);
    expect(docxBlob.size).toBeGreaterThan(0);
    expect(docxBlob.type).toContain("wordprocessingml");
  });

  it("converts PDF text to CSV / Excel spreadsheet format", async () => {
    const pdfBytes = await createTestPdf(2);
    const csvBlob = await pdfToExcel(pdfBytes.buffer, "csv");
    expect(csvBlob.size).toBeGreaterThan(0);
    expect(csvBlob.type).toContain("csv");
  });
});

