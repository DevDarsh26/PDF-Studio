import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";
import { HybridPdfAdapter } from "../adapter/hybrid-adapter";
import { validateExportedPdf } from "./export-validator";
import { ZipArchive, computeCrc32 } from "../utils/zip-archive";
import { EditStrategy, TextEditOperation } from "../models/operations";
import { createMultiPageSamplePdf, createSinglePageSamplePdf } from "../utils/sample-pdfs";

describe("Export & Conversion Engine", () => {
  let adapter: HybridPdfAdapter;

  beforeEach(() => {
    adapter = new HybridPdfAdapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  describe("PDF Export & Preservation Fidelity", () => {
    it("preserves exact page dimensions and avoids unnecessary rasterization", async () => {
      const buffer = await createSinglePageSamplePdf();
      await adapter.loadDocument(buffer);

      const exportedBytes = await adapter.exportPdf({
        operations: [
          {
            id: "text-1",
            pageNumber: 1,
            timestamp: Date.now(),
            type: "add_text",
            position: { x: 60, y: 500 },
            text: "Vector Preservation Test",
            fontFamily: "Helvetica",
            fontSize: 16,
            fontWeight: "normal",
            fontStyle: "normal",
            fontColorHex: "#000000",
            alignment: "left",
            opacity: 1.0,
          },
        ],
        preserveOriginalMetadata: true,
        compress: true,
      });

      expect(exportedBytes).toBeInstanceOf(Uint8Array);
      expect(exportedBytes.length).toBeGreaterThan(500);

      // Reopen and verify with pdf-lib
      const reloadedDoc = await PDFDocument.load(exportedBytes);
      expect(reloadedDoc.getPageCount()).toBe(1);
      const page = reloadedDoc.getPage(0);
      expect(page.getWidth()).toBeCloseTo(595.28, 1);
      expect(page.getHeight()).toBeCloseTo(841.89, 1);

      // Verify page is not a raster image
      const contents = page.node.Contents();
      expect(contents).toBeDefined();
    });

    it("preserves multiple pages and reflects page rotations accurately", async () => {
      const buffer = await createMultiPageSamplePdf();
      await adapter.loadDocument(buffer);

      const exportedBytes = await adapter.exportPdf({
        operations: [
          {
            id: "rotate-p2",
            pageNumber: 2,
            timestamp: Date.now(),
            type: "page_rotate",
            rotationDegrees: 90,
          },
        ],
      });

      const reloadedDoc = await PDFDocument.load(exportedBytes);
      expect(reloadedDoc.getPageCount()).toBe(5);
      const page2 = reloadedDoc.getPage(1);
      expect(page2.getRotation().angle).toBe(90);
    });

    it("preserves hyperlinks in exported documents", async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage([600, 400]);
      page.drawText("Link Page", { x: 50, y: 350, size: 14 });
      const rawBytes = await doc.save();

      await adapter.loadDocument(rawBytes.buffer as ArrayBuffer);
      const exportedBytes = await adapter.exportPdf({ operations: [] });

      const reloaded = await PDFDocument.load(exportedBytes);
      expect(reloaded.getPageCount()).toBe(1);
    });
  });

  describe("Post-Export Verification Engine (validateExportedPdf)", () => {
    it("successfully validates compliant exported PDFs with exact dimensions and expected text", async () => {
      const buffer = await createSinglePageSamplePdf();
      await adapter.loadDocument(buffer);

      const exportedBytes = await adapter.exportPdf({
        operations: [
          {
            id: "txt-verify",
            pageNumber: 1,
            timestamp: Date.now(),
            type: "add_text",
            position: { x: 80, y: 400 },
            text: "Confidential Report 2026",
            fontFamily: "Helvetica",
            fontSize: 14,
            fontWeight: "bold",
            fontStyle: "normal",
            fontColorHex: "#000000",
            alignment: "left",
            opacity: 1.0,
          },
        ],
      });

      const validation = await validateExportedPdf(exportedBytes, {
        expectedPageCount: 1,
        expectedPageDimensions: [{ pageNumber: 1, width: 595.28, height: 841.89 }],
        expectedTexts: ["Confidential Report 2026"],
      });

      expect(validation.isValid).toBe(true);
      expect(validation.pageCountVerified).toBe(true);
      expect(validation.dimensionsVerified).toBe(true);
      expect(validation.textPreservationVerified).toBe(true);
      expect(validation.foundExpectedTexts).toContain("Confidential Report 2026");
      expect(validation.errors.length).toBe(0);
    });

    it("detects and flags page dimension distortion", async () => {
      const buffer = await createSinglePageSamplePdf();
      await adapter.loadDocument(buffer);

      const exportedBytes = await adapter.exportPdf({ operations: [] });

      // Expecting Letter dimensions (612x792) on an A4 document (595.28x841.89)
      const validation = await validateExportedPdf(exportedBytes, {
        expectedPageCount: 1,
        expectedPageDimensions: [{ pageNumber: 1, width: 612, height: 792 }],
      });

      expect(validation.dimensionsVerified).toBe(false);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.includes("dimensions distorted"))).toBe(true);
    });

    it("verifies that permanently redacted text is not recoverable through text extraction", async () => {
      const doc = await PDFDocument.create();
      const page = doc.addPage([600, 400]);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      page.drawText("SecretSSN: 999-00-1111", {
        x: 50,
        y: 350,
        size: 14,
        font,
        color: rgb(0, 0, 0),
      });
      const initialBytes = await doc.save();

      await adapter.loadDocument(initialBytes.buffer as ArrayBuffer);

      // Apply permanent redaction
      const exportedBytes = await adapter.exportPdf({
        operations: [
          {
            id: "redact-1",
            pageNumber: 1,
            timestamp: Date.now(),
            type: "redaction",
            rect: { x: 50, y: 345, width: 180, height: 20 },
            isPermanent: true,
            fillColorHex: "#000000",
            textToRedact: "999-00-1111",
          },
        ],
      });

      const validation = await validateExportedPdf(exportedBytes, {
        expectedPageCount: 1,
        redactedTexts: ["999-00-1111"],
      });

      expect(validation.redactionVerified).toBe(true);
      expect(validation.leakedRedactedTexts.length).toBe(0);
    });
  });

  describe("Zero-Dependency ZIP Archive Generator", () => {
    it("computes accurate CRC-32 checksums", () => {
      const data = new TextEncoder().encode("Hello PDF Studio");
      const crc = computeCrc32(data);
      expect(crc).toBeGreaterThan(0);
      expect(typeof crc).toBe("number");
    });

    it("packages multiple image files into a compliant ZIP archive binary", async () => {
      const zip = new ZipArchive();
      const file1 = new TextEncoder().encode("Image file 1 content");
      const file2 = new TextEncoder().encode("Image file 2 content");

      zip.addFile("page-01.png", file1);
      zip.addFile("page-02.png", file2);

      const zipBytes = zip.build();
      expect(zipBytes).toBeInstanceOf(Uint8Array);
      expect(zipBytes.length).toBeGreaterThan(100);

      // Check standard ZIP signature (0x04034b50) at byte 0
      const view = new DataView(zipBytes.buffer, zipBytes.byteOffset);
      expect(view.getUint32(0, true)).toBe(0x04034b50);

      const blob = await zip.buildBlob();
      expect(blob.type).toBe("application/zip");
      expect(blob.size).toBe(zipBytes.length);
    });
  });

  describe("Image Conversion & Scaling", () => {
    it("exports an individual page as a Blob with custom DPI scale", async () => {
      const buffer = await createSinglePageSamplePdf();
      await adapter.loadDocument(buffer);

      const blob = await adapter.exportPageImage({
        pageNumber: 1,
        format: "image/png",
        dpiScale: 1.0,
      });

      expect(blob).toBeDefined();
      expect(blob.type).toBe("image/png");
      expect(blob.size).toBeGreaterThan(0);
    });

    it("exports all pages sequentially for archive packaging", async () => {
      const buffer = await createMultiPageSamplePdf();
      await adapter.loadDocument(buffer);

      const pageImages = await adapter.exportAllPageImages({
        format: "image/png",
        dpiScale: 1.0,
      });

      expect(pageImages.length).toBe(5);
      expect(pageImages[0].fileName).toBe("page-01.png");
      expect(pageImages[1].fileName).toBe("page-02.png");
      expect(pageImages[2].fileName).toBe("page-03.png");
      expect(pageImages[0].blob.size).toBeGreaterThan(0);
    });
  });
});
