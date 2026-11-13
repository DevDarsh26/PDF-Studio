import {
  PdfEngineAdapter,
  RenderPageOptions,
  RenderResult,
  ExportPdfOptions,
  ExportImageOptions,
} from "./types";
import {
  PdfDocumentMetadata,
  PageInfo,
  DocumentValidationResult,
} from "../models/document";
import {
  DocumentStyleProfile,
  FontProfile,
  ColorUsage,
  LayoutBlock,
  HyperlinkInfo,
  TextToken,
} from "../models/style-profile";
import { validatePdfBytes } from "../utils/validation";
import { hexToRgb } from "../utils/color";

/**
 * HybridPdfAdapter combines PDF.js (for rendering and structural analysis)
 * with pdf-lib (for document manipulation and export).
 * 
 * Runs 100% client-side with zero external dependencies and under permissive MIT/Apache licenses.
 */
export class HybridPdfAdapter implements PdfEngineAdapter {
  readonly engineName = "Hybrid (PDF.js + pdf-lib)";
  readonly engineVersion = "1.0.0";
  readonly isWasmAccelerated = false;

  private rawBytes: ArrayBuffer | null = null;
  private metadata: PdfDocumentMetadata | null = null;
  private pageInfos: PageInfo[] = [];

  async validate(data: ArrayBuffer): Promise<DocumentValidationResult> {
    return validatePdfBytes(data);
  }

  async loadDocument(data: ArrayBuffer, password?: string): Promise<PdfDocumentMetadata> {
    const validation = await this.validate(data);
    if (!validation.isValid) {
      throw new Error(validation.error || "Invalid PDF document binary.");
    }

    // Keep original bytes immutable by storing an isolated copy if detached
    this.rawBytes = data.slice(0);

    // Dynamic import to support SSR/Next.js client-side execution
    const { PDFDocument } = await import("pdf-lib");
    
    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(this.rawBytes, {
        ignoreEncryption: false,
        updateMetadata: false,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.toLowerCase().includes("encrypt") || errorMsg.toLowerCase().includes("password")) {
        throw new Error("Document is password protected.");
      }
      throw err;
    }

    const pageCount = pdfDoc.getPageCount();
    const pages = pdfDoc.getPages();
    this.pageInfos = pages.map((page, index) => {
      const { width, height } = page.getSize();
      return {
        pageNumber: index + 1,
        dimensions: { width, height },
        rotation: page.getRotation().angle,
      };
    });

    this.metadata = {
      title: pdfDoc.getTitle(),
      author: pdfDoc.getAuthor(),
      subject: pdfDoc.getSubject(),
      creator: pdfDoc.getCreator(),
      producer: pdfDoc.getProducer(),
      creationDate: pdfDoc.getCreationDate(),
      modificationDate: pdfDoc.getModificationDate(),
      pdfVersion: validation.version || "1.7",
      isEncrypted: false,
      pageCount,
      fileSizeBytes: data.byteLength,
    };

    return this.metadata;
  }

  async getPageInfos(): Promise<PageInfo[]> {
    if (!this.rawBytes) {
      throw new Error("No document loaded.");
    }
    return [...this.pageInfos];
  }

  async analyzeStyleProfile(pageNumber: number): Promise<DocumentStyleProfile> {
    if (!this.rawBytes) {
      throw new Error("No document loaded.");
    }

    // Lazy load pdfjs-dist for inspection
    const pdfjsLib = await import("pdfjs-dist");

    // Load document in pdfjs
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(this.rawBytes.slice(0)),
      useSystemFonts: true,
    });

    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(pageNumber);

    const textContent = await page.getTextContent();
    const annotations = await page.getAnnotations();

    const detectedFonts = new Map<string, FontProfile>();
    const colorUsageMap = new Map<string, number>();
    const tokens: TextToken[] = [];
    const layoutBlocks: LayoutBlock[] = [];

    // Parse font styles
    const styles = textContent.styles;

    for (let i = 0; i < textContent.items.length; i++) {
      const item = textContent.items[i] as any;
      if (!("str" in item) || !item.str.trim()) {
        continue;
      }

      const fontName = item.fontName || "default";
      const style = styles[fontName] || {};
      const fontFamily = style.fontFamily || "sans-serif";
      const fontSize = Math.hypot(item.transform[0], item.transform[1]) || 12;

      if (!detectedFonts.has(fontName)) {
        detectedFonts.set(fontName, {
          id: fontName,
          name: fontName,
          family: fontFamily,
          weight: style.descent && style.descent < -0.3 ? "bold" : "normal",
          isBold: fontFamily.toLowerCase().includes("bold"),
          isItalic: fontFamily.toLowerCase().includes("italic") || fontFamily.toLowerCase().includes("oblique"),
          isEmbedded: true,
          isSubset: fontName.includes("+"),
          frequency: 1,
        });
      } else {
        const font = detectedFonts.get(fontName)!;
        font.frequency += 1;
      }

      const token: TextToken = {
        id: `token-${pageNumber}-${i}`,
        text: item.str,
        rect: {
          x: item.transform[4],
          y: item.transform[5],
          width: item.width || 0,
          height: item.height || fontSize,
        },
        transform: item.transform,
        fontId: fontName,
        fontSize: Math.round(fontSize * 10) / 10,
        colorHex: "#000000",
      };

      tokens.push(token);
    }

    // Group adjacent tokens into layout blocks
    if (tokens.length > 0) {
      layoutBlocks.push({
        id: `block-${pageNumber}-0`,
        pageNumber,
        rect: tokens[0].rect,
        lines: [tokens.map((t) => t.text).join(" ")],
        tokens,
        dominantFontId: tokens[0].fontId,
        dominantFontSize: tokens[0].fontSize,
      });
    }

    // Parse hyperlinks
    const hyperlinks: HyperlinkInfo[] = [];
    for (let i = 0; i < annotations.length; i++) {
      const annot = annotations[i];
      if (annot.subtype === "Link") {
        hyperlinks.push({
          id: `link-${pageNumber}-${i}`,
          pageNumber,
          rect: {
            x: annot.rect[0],
            y: annot.rect[1],
            width: annot.rect[2] - annot.rect[0],
            height: annot.rect[3] - annot.rect[1],
          },
          targetType: annot.url ? "external_url" : "internal_page",
          target: annot.url || annot.dest || "",
        });
      }
    }

    const colors: ColorUsage[] = Array.from(colorUsageMap.entries()).map(([colorHex, frequency]) => ({
      colorHex,
      colorSpace: "RGB",
      components: [0, 0, 0],
      frequency,
      contexts: ["text"],
    }));

    return {
      detectedFonts,
      frequentlyUsedColors: colors,
      layoutBlocks,
      hyperlinks,
      inferredProperties: {
        bodyFontFamily: detectedFonts.values().next().value?.family || "Helvetica",
        baseFontSize: tokens[0]?.fontSize || 12,
        primaryTextColor: "#000000",
      },
    };
  }

  async renderPage(options: RenderPageOptions): Promise<RenderResult> {
    if (!this.rawBytes) {
      throw new Error("No document loaded.");
    }

    const pdfjsLib = await import("pdfjs-dist");
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(this.rawBytes.slice(0)),
      useSystemFonts: true,
    });

    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(options.pageNumber);

    const viewport = page.getViewport({ scale: options.scale });
    const canvas = options.canvas;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("Failed to acquire 2D rendering context from canvas.");
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderContext = {
      canvasContext: ctx,
      viewport,
    };

    await page.render(renderContext).promise;

    return {
      width: viewport.width,
      height: viewport.height,
      renderedScale: options.scale,
    };
  }

  async exportPdf(options: ExportPdfOptions): Promise<Uint8Array> {
    if (!this.rawBytes) {
      throw new Error("No document loaded.");
    }

    const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.load(this.rawBytes);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    for (const op of options.operations) {
      if ("pageNumber" in op && op.pageNumber <= pdfDoc.getPageCount()) {
        const page = pdfDoc.getPage(op.pageNumber - 1);

        switch (op.type) {
          case "whiteout": {
            const rgbColor = hexToRgb(op.fillColorHex) || { r: 255, g: 255, b: 255 };
            page.drawRectangle({
              x: op.rect.x,
              y: op.rect.y,
              width: op.rect.width,
              height: op.rect.height,
              color: rgb(rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255),
            });
            break;
          }

          case "redaction": {
            const rgbColor = hexToRgb(op.fillColorHex) || { r: 0, g: 0, b: 0 };
            page.drawRectangle({
              x: op.rect.x,
              y: op.rect.y,
              width: op.rect.width,
              height: op.rect.height,
              color: rgb(rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255),
            });
            break;
          }

          case "add_text": {
            const rgbColor = hexToRgb(op.fontColorHex) || { r: 0, g: 0, b: 0 };
            page.drawText(op.text, {
              x: op.position.x,
              y: op.position.y,
              size: op.fontSize,
              font: helvetica,
              color: rgb(rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255),
              opacity: op.opacity,
            });
            break;
          }

          case "text_edit": {
            // Strategy 3 (Visual Overlay Fallback): Cover target area with whiteout and redraw
            page.drawRectangle({
              x: op.targetRect.x,
              y: op.targetRect.y,
              width: op.targetRect.width,
              height: op.targetRect.height,
              color: rgb(1, 1, 1),
            });
            const rgbColor = hexToRgb(op.fontColorHex) || { r: 0, g: 0, b: 0 };
            page.drawText(op.replacementText, {
              x: op.targetRect.x,
              y: op.targetRect.y,
              size: op.fontSize,
              font: helvetica,
              color: rgb(rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255),
            });
            break;
          }
        }
      }
    }

    return await pdfDoc.save();
  }

  async exportPageImage(options: ExportImageOptions): Promise<Blob> {
    if (!this.rawBytes) {
      throw new Error("No document loaded.");
    }

    if (typeof document === "undefined") {
      throw new Error("Image export requires a browser DOM environment.");
    }

    const canvas = document.createElement("canvas");
    const scale = options.dpiScale || 2.0;

    await this.renderPage({
      pageNumber: options.pageNumber,
      scale,
      canvas,
    });

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to export canvas to image blob."));
          }
        },
        options.format,
        options.quality ?? 0.92
      );
    });
  }

  async dispose(): Promise<void> {
    this.rawBytes = null;
    this.metadata = null;
    this.pageInfos = [];
  }
}
