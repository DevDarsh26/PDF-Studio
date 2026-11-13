import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { HybridPdfAdapter } from "./hybrid-adapter";
import { createSinglePageSamplePdf } from "../utils/sample-pdfs";
import {
  AddTextOperation,
  AddShapeOperation,
  AddImageOperation,
  WhiteoutOperation,
  BlackoutOperation,
  EditOperation,
} from "../models/operations";
import { PDFDocument } from "pdf-lib";

const SAMPLE_TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("HybridPdfAdapter — Export Pipeline with Applied Operations", () => {
  let adapter: HybridPdfAdapter;

  beforeEach(() => {
    adapter = new HybridPdfAdapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  it("exports document with text, shapes, whiteout, blackout, and image operations", async () => {
    const buffer = await createSinglePageSamplePdf();
    await adapter.loadDocument(buffer);

    const operations: EditOperation[] = [
      // 1. Add formatted text
      {
        id: "test-text-1",
        pageNumber: 1,
        timestamp: Date.now(),
        type: "add_text",
        position: { x: 70, y: 300 },
        text: "Export Verification Note",
        fontFamily: "Helvetica",
        fontSize: 16,
        fontWeight: "bold",
        fontStyle: "normal",
        fontColorHex: "#2563eb",
        alignment: "left",
        opacity: 1.0,
      },
      // 2. Add Whiteout
      {
        id: "test-wo-1",
        pageNumber: 1,
        timestamp: Date.now(),
        type: "whiteout",
        rect: { x: 50, y: 650, width: 300, height: 30 },
        fillColorHex: "#ffffff",
        opacity: 1.0,
      },
      // 3. Add Blackout
      {
        id: "test-bo-1",
        pageNumber: 1,
        timestamp: Date.now(),
        type: "blackout",
        rect: { x: 50, y: 600, width: 200, height: 20 },
        fillColorHex: "#000000",
        opacity: 1.0,
      },
      // 4. Add Rectangle Shape
      {
        id: "test-rect-1",
        pageNumber: 1,
        timestamp: Date.now(),
        type: "add_shape",
        shapeType: "rectangle",
        rect: { x: 70, y: 200, width: 120, height: 60 },
        strokeColorHex: "#059669",
        fillColorHex: "#d1fae5",
        strokeWidth: 2,
        opacity: 0.9,
      },
      // 5. Add Circle Shape
      {
        id: "test-circle-1",
        pageNumber: 1,
        timestamp: Date.now(),
        type: "add_shape",
        shapeType: "circle",
        rect: { x: 250, y: 200, width: 60, height: 60 },
        strokeColorHex: "#dc2626",
        strokeWidth: 2,
        opacity: 1.0,
      },
      // 6. Add Arrow Shape
      {
        id: "test-arrow-1",
        pageNumber: 1,
        timestamp: Date.now(),
        type: "add_shape",
        shapeType: "arrow",
        rect: { x: 100, y: 150, width: 150, height: 0 },
        startPoint: { x: 100, y: 150 },
        endPoint: { x: 250, y: 150 },
        strokeColorHex: "#7c3aed",
        strokeWidth: 2,
        opacity: 1.0,
      },
      // 7. Add Image
      {
        id: "test-img-1",
        pageNumber: 1,
        timestamp: Date.now(),
        type: "add_image",
        rect: { x: 350, y: 150, width: 80, height: 80 },
        imageDataUrl: `data:image/png;base64,${SAMPLE_TINY_PNG}`,
        mimeType: "image/png",
        opacity: 1.0,
      },
    ];

    const exportedBytes = await adapter.exportPdf({ operations });
    expect(exportedBytes).toBeInstanceOf(Uint8Array);
    expect(exportedBytes.length).toBeGreaterThan(100);

    // Verify the exported PDF can be re-opened and parsed cleanly
    const reloadedDoc = await PDFDocument.load(exportedBytes);
    expect(reloadedDoc.getPageCount()).toBe(1);
    const firstPage = reloadedDoc.getPage(0);
    expect(firstPage.getWidth()).toBeCloseTo(595.28, 1);
    expect(firstPage.getHeight()).toBeCloseTo(841.89, 1);
  });
});
