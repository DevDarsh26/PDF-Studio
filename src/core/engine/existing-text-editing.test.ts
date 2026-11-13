import { describe, it, expect, beforeEach } from "vitest";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  applyNativeModification,
  applyLocalReconstruction,
  applyVisualOverlayFallback,
  decompressStream,
  compressStream,
  stringToHex,
  escapePdfLiteral,
} from "./stream-surgery";
import {
  validateTextReplacement,
  detectTextScope,
} from "./text-validator";
import { EditStrategy, TextEditOperation } from "../models/operations";
import { FontProfile, TextToken } from "../models/style-profile";
import { TextEditCommand } from "../commands/editor-commands";

describe("Existing-Text Editing Subsystem", () => {
  let pdfDoc: PDFDocument;

  beforeEach(async () => {
    pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    page.drawText("Invoice Number: 98452", {
      x: 50,
      y: 350,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });
    page.drawText("Subtotal: $150.00", {
      x: 50,
      y: 300,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });
  });

  describe("Stream Surgery & Decompression", () => {
    it("converts strings to hex representation and escapes literals", () => {
      expect(stringToHex("PDF")).toBe("504446");
      expect(escapePdfLiteral("Hello (World)")).toBe("Hello \\(World\\)");
    });

    it("compresses and decompresses stream content round-trip", async () => {
      const sampleStream = "BT /F1 12 Tf 50 350 Td (Invoice Number) Tj ET";
      const compressed = await compressStream(sampleStream);
      const decompressed = await decompressStream(compressed);
      expect(decompressed).toBe(sampleStream);
    });
  });

  describe("Strategy A: Native Stream Modification", () => {
    it("modifies existing number natively in content stream", async () => {
      const success = await applyNativeModification(
        pdfDoc,
        0,
        "98452",
        "99999"
      );
      expect(success).toBe(true);

      const savedBytes = await pdfDoc.save();
      const reloadedDoc = await PDFDocument.load(savedBytes);
      const page = reloadedDoc.getPage(0);
      const contents = page.node.Contents();
      expect(contents).toBeDefined();
    });

    it("modifies existing word natively in content stream", async () => {
      const success = await applyNativeModification(
        pdfDoc,
        0,
        "Subtotal",
        "Total"
      );
      expect(success).toBe(true);
    });

    it("returns false gracefully when target text is not found in stream", async () => {
      const success = await applyNativeModification(
        pdfDoc,
        0,
        "NonExistentTextInStream",
        "Replacement"
      );
      expect(success).toBe(false);
    });
  });

  describe("Strategy B: Local Reconstruction", () => {
    it("suppresses original text in stream and reconstructs at baseline", async () => {
      const targetRect = { x: 50, y: 350, width: 120, height: 16 };
      const success = await applyLocalReconstruction(
        pdfDoc,
        0,
        "Invoice Number: 98452",
        "Receipt No: 12345",
        targetRect,
        {
          fontFamily: "Helvetica",
          fontSize: 14,
          fontWeight: "bold",
          fontStyle: "normal",
          fontColorHex: "#000000",
        }
      );

      expect(success).toBe(true);
      const savedBytes = await pdfDoc.save();
      expect(savedBytes.length).toBeGreaterThan(0);
    });
  });

  describe("Strategy C: Visual Overlay Fallback", () => {
    it("masks target bounding box and renders replacement overlay", async () => {
      const targetRect = { x: 50, y: 300, width: 100, height: 16 };
      await applyVisualOverlayFallback(
        pdfDoc,
        0,
        targetRect,
        "$250.00",
        {
          fontFamily: "Helvetica",
          fontSize: 14,
          fontWeight: "normal",
          fontStyle: "normal",
          fontColorHex: "#2563eb",
          backgroundColorHex: "#ffffff",
        }
      );

      const savedBytes = await pdfDoc.save();
      expect(savedBytes.length).toBeGreaterThan(0);
    });
  });

  describe("Pre-Flight Validation & Scope Detection", () => {
    it("accurately detects scopes: word, number, sentence, block, deletion", () => {
      expect(detectTextScope("Total", "Sum")).toBe("word");
      expect(detectTextScope("12,450.00", "15,000.00")).toBe("number");
      expect(detectTextScope("The quick brown fox", "The lazy dog")).toBe("sentence");
      expect(detectTextScope("Paragraph with a very long string that spans multiple words across several lines...", "New")).toBe("block");
      expect(detectTextScope("RemoveMe", "")).toBe("deletion");
    });

    it("validates Standard 14 font and recommends Strategy A", () => {
      const font: FontProfile = {
        id: "f1",
        postScriptName: "Helvetica",
        family: "Helvetica",
        weight: "normal",
        style: "normal",
        isBold: false,
        isItalic: false,
        isEmbedded: false,
        isSubset: false,
        isStandard14: true,
        canBeReusedForEditing: true,
        reusabilityReason: "Standard 14 Type 1 font.",
        characterCoverage: { count: 256, sampleCharacters: [] },
        frequency: 1,
        provenance: "extracted",
      };

      const result = validateTextReplacement(
        "Subtotal",
        "Total",
        { x: 50, y: 300, width: 60, height: 14 },
        14,
        font
      );

      expect(result.recommendedStrategy).toBe(EditStrategy.NativeStreamModification);
      expect(result.canUseNative).toBe(true);
      expect(result.characterCoverage.isCovered).toBe(true);
    });

    it("detects subset font missing characters and warns user with Strategy B recommendation", () => {
      const subsetFont: FontProfile = {
        id: "f2",
        postScriptName: "ABCDEF+CustomFont",
        family: "CustomFont",
        weight: "normal",
        style: "normal",
        isBold: false,
        isItalic: false,
        isEmbedded: true,
        isSubset: true,
        isStandard14: false,
        canBeReusedForEditing: false,
        reusabilityReason: "Subset font.",
        characterCoverage: { count: 4, sampleCharacters: ["P", "D", "F", "1"] },
        frequency: 1,
        provenance: "extracted",
      };

      const result = validateTextReplacement(
        "PDF 1",
        "XYZ Special",
        { x: 50, y: 300, width: 40, height: 14 },
        14,
        subsetFont
      );

      expect(result.characterCoverage.isCovered).toBe(false);
      expect(result.recommendedStrategy).toBe(EditStrategy.LocalReconstruction);
      expect(result.warnings.some((w) => w.includes("embedded subset"))).toBe(true);
    });

    it("detects text overflow and adjacent content collisions", () => {
      const neighborToken: TextToken = {
        id: "tok-1",
        text: "Adjacent Label",
        rect: { x: 130, y: 300, width: 80, height: 14 },
        transform: [1, 0, 0, 1, 130, 300],
        fontId: "f1",
        fontSize: 14,
        colorHex: "#000000",
        colorSpace: "DeviceRGB",
        advanceWidth: 80,
        provenance: "extracted",
      };

      const result = validateTextReplacement(
        "Short",
        "A Much Longer Replacement Text That Expands Considerably",
        { x: 50, y: 300, width: 50, height: 14 },
        14,
        undefined,
        { textTokens: [neighborToken] }
      );

      expect(result.dimensionMetrics.isOverflowing).toBe(true);
      expect(result.dimensionMetrics.overflowRatio).toBeGreaterThan(1.5);
      expect(result.hasOverlapWithAdjacent).toBe(true);
      expect(result.warnings.some((w) => w.includes("overflow"))).toBe(true);
    });
  });

  describe("Command Ledger & Undo/Redo Integration", () => {
    it("records text edit operations in ledger and reverses cleanly on undo", () => {
      const operations: any[] = [];
      const storeCallbacks = {
        addOperation: (op: any) => operations.push(op),
        removeOperation: (id: string) => {
          const idx = operations.findIndex((o) => o.id === id);
          if (idx !== -1) operations.splice(idx, 1);
        },
        updateOperation: (id: string, updates: any) => {
          const op = operations.find((o) => o.id === id);
          if (op) Object.assign(op, updates);
        },
      };

      const editOp: TextEditOperation = {
        id: "edit-1",
        pageNumber: 1,
        timestamp: Date.now(),
        type: "text_edit",
        targetRect: { x: 50, y: 350, width: 100, height: 16 },
        originalText: "98452",
        replacementText: "10000",
        fontFamily: "Helvetica",
        fontSize: 14,
        fontWeight: "normal",
        fontStyle: "normal",
        fontColorHex: "#000000",
        alignment: "left",
        opacity: 1.0,
        strategy: EditStrategy.NativeStreamModification,
      };

      const command = new TextEditCommand(editOp, storeCallbacks);
      command.execute();
      expect(operations.length).toBe(1);
      expect(operations[0].replacementText).toBe("10000");

      command.undo();
      expect(operations.length).toBe(0);

      command.redo();
      expect(operations.length).toBe(1);
      expect(operations[0].id).toBe("edit-1");
    });
  });
});
