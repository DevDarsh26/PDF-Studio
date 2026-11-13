import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { HybridPdfAdapter } from "./hybrid-adapter";
import {
  createSinglePageSamplePdf,
  createMultiPageSamplePdf,
  createRotatedPageSamplePdf,
} from "../utils/sample-pdfs";
import {
  PasswordRequiredError,
  InvalidPasswordError,
  CorruptedPdfError,
} from "../models/errors";
import { PDFDocument } from "pdf-lib";

describe("HybridPdfAdapter — Loading & Rendering Foundation", () => {
  let adapter: HybridPdfAdapter;

  beforeEach(() => {
    adapter = new HybridPdfAdapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  it("loads and renders a 1-page PDF document", async () => {
    const buffer = await createSinglePageSamplePdf();
    const metadata = await adapter.loadDocument(buffer, undefined);

    expect(metadata.pageCount).toBe(1);
    expect(metadata.isEncrypted).toBe(false);
    expect(metadata.pdfVersion).toBeDefined();

    const pages = await adapter.getPageInfos();
    expect(pages.length).toBe(1);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[0].dimensions.width).toBeCloseTo(595.28, 1);
    expect(pages[0].dimensions.height).toBeCloseTo(841.89, 1);

    // Test page rendering to canvas
    const canvas = document.createElement("canvas");
    const renderResult = await adapter.renderPage({
      pageNumber: 1,
      scale: 1.0,
      canvas,
    });

    expect(renderResult.width).toBeGreaterThan(0);
    expect(renderResult.height).toBeGreaterThan(0);
    expect(renderResult.renderedScale).toBe(1.0);
  });

  it("loads and handles multi-page PDF documents", async () => {
    const buffer = await createMultiPageSamplePdf();
    const metadata = await adapter.loadDocument(buffer);

    expect(metadata.pageCount).toBe(5);
    const pages = await adapter.getPageInfos();
    expect(pages.length).toBe(5);

    // Verify all pages have valid dimensions
    pages.forEach((page, idx) => {
      expect(page.pageNumber).toBe(idx + 1);
      expect(page.dimensions.width).toBeGreaterThan(0);
      expect(page.dimensions.height).toBeGreaterThan(0);
    });

    // Test thumbnail generation for multiple pages
    for (let i = 1; i <= 3; i++) {
      const thumbCanvas = document.createElement("canvas");
      const thumbResult = await adapter.renderThumbnail({
        pageNumber: i,
        targetWidth: 100,
        canvas: thumbCanvas,
      });
      expect(thumbResult.width).toBe(100);
      expect(thumbResult.height).toBeGreaterThan(0);
    }
  });

  it("correctly identifies and renders natively rotated pages", async () => {
    const buffer = await createRotatedPageSamplePdf();
    const metadata = await adapter.loadDocument(buffer);
    expect(metadata.pageCount).toBe(3);

    const pages = await adapter.getPageInfos();
    // Page 1 is portrait (0 deg)
    expect(pages[0].rotation).toBe(0);
    // Page 2 is 90 deg rotated
    expect(pages[1].rotation).toBe(90);
    // Page 3 is 180 deg rotated
    expect(pages[2].rotation).toBe(180);

    // Render with additional viewing rotation (e.g. 90 deg)
    const canvas = document.createElement("canvas");
    const renderResult = await adapter.renderPage({
      pageNumber: 2,
      scale: 1.5,
      rotation: 90,
      canvas,
    });
    expect(renderResult.renderedScale).toBe(1.5);
  });

  it("handles encrypted / password-protected PDFs correctly", async () => {
    // Construct an encrypted PDF trailer structure
    const encryptedPdfStr =
      "%PDF-1.7\n%PDF Studio Encrypted Test\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
      "2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n" +
      "trailer\n<< /Root 1 0 R /Encrypt 3 0 R >>\n%%EOF";
    const buffer = new TextEncoder().encode(encryptedPdfStr).buffer;

    // Loading without password must detect encryption and throw PasswordRequiredError
    await expect(adapter.loadDocument(buffer)).rejects.toThrow(PasswordRequiredError);
  });

  it("rejects invalid and corrupted files gracefully", async () => {
    // 1. Empty buffer
    await expect(adapter.loadDocument(new ArrayBuffer(0))).rejects.toThrow(
      CorruptedPdfError
    );

    // 2. Corrupted bytes with valid header but garbled stream
    const corruptBuffer = new TextEncoder().encode(
      "%PDF-1.7\n/BrokenObject << not a valid xref >>\n%%EOF"
    ).buffer;
    await expect(adapter.loadDocument(corruptBuffer)).rejects.toThrow(CorruptedPdfError);

    // 3. Non-PDF binary (e.g. random image or text)
    const textBuffer = new TextEncoder().encode("Hello World, this is not a PDF!").buffer;
    await expect(adapter.loadDocument(textBuffer)).rejects.toThrow(CorruptedPdfError);
  });

  it("handles large multi-page PDF generation without memory leaks", async () => {
    const doc = await PDFDocument.create();
    // Create 15 pages in memory
    for (let i = 0; i < 15; i++) {
      const p = doc.addPage([500, 700]);
      p.drawText(`High-density stress page ${i + 1}`, { x: 40, y: 650 });
    }
    const bytes = await doc.save();
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

    const metadata = await adapter.loadDocument(buffer);
    expect(metadata.pageCount).toBe(15);

    // Test disposal frees cached documents
    await adapter.dispose();
    await expect(adapter.getPageInfos()).rejects.toThrow("No document loaded");
  });
});
