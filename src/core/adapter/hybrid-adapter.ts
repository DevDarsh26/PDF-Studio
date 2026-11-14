import {
  PdfEngineAdapter,
  RenderPageOptions,
  RenderThumbnailOptions,
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
import {
  PasswordRequiredError,
  InvalidPasswordError,
  CorruptedPdfError,
} from "../models/errors";
import { validatePdfBytes } from "../utils/validation";
import { hexToRgb } from "../utils/color";
import { EditStrategy } from "../models/operations";
import {
  applyNativeModification,
  applyLocalReconstruction,
  applyVisualOverlayFallback,
  applyPermanentRedaction,
} from "../engine/stream-surgery";
import {
  addHyperlinkAnnotation,
  removeHyperlinkAnnotation,
} from "../hyperlinks/hyperlink-manager";
import { addBlankPage } from "../page-manager/page-manager";

/**
 * HybridPdfAdapter combines Mozilla's PDF.js (for layout, fonts, links, and high-DPI rendering)
 * with pdf-lib (for document mutations and saving).
 * 
 * 100% client-side, permissive MIT/Apache licenses, zero network dependencies.
 */
export class HybridPdfAdapter implements PdfEngineAdapter {
  readonly engineName = "Hybrid (PDF.js + pdf-lib)";
  readonly engineVersion = "1.0.0";
  readonly isWasmAccelerated = false;

  private rawBytes: ArrayBuffer | null = null;
  private currentPassword: string | undefined = undefined;
  private metadata: PdfDocumentMetadata | null = null;
  private pageInfos: PageInfo[] = [];

  // Cached PDF.js document instance to prevent reparsing on every render
  private cachedPdfJsDoc: any = null;

  // Active rendering tasks mapped by canvas element for clean cancellation
  private activeRenderTasks = new WeakMap<HTMLCanvasElement, any>();
  private canvasLocks = new WeakMap<HTMLCanvasElement, Promise<any>>();
  private renderTokens = new WeakMap<HTMLCanvasElement, number>();

  private configureWorker(pdfjsLib: any) {
    if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    }
  }

  async validate(data: ArrayBuffer): Promise<DocumentValidationResult> {
    return validatePdfBytes(data);
  }

  async loadDocument(data: ArrayBuffer, password?: string): Promise<PdfDocumentMetadata> {
    const validation = await this.validate(data);
    if (!validation.isValid) {
      throw new CorruptedPdfError(validation.error || "Invalid PDF document binary.");
    }

    if (validation.isEncrypted && !password) {
      throw new PasswordRequiredError();
    }

    // Clean up any previously loaded document
    await this.dispose();

    // Store immutable copy
    this.rawBytes = data.slice(0);
    this.currentPassword = password;

    const pdfjsLib = await import("pdfjs-dist");
    this.configureWorker(pdfjsLib);

    // Load with PDF.js for parsing and rendering
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(this.rawBytes.slice(0)),
        password: password || undefined,
        useSystemFonts: true,
        cMapUrl: "/cmaps/",
        cMapPacked: true,
      });

      this.cachedPdfJsDoc = await loadingTask.promise;
    } catch (err: any) {
      const errorMsg = (err?.message || "").toLowerCase();
      const errorName = err?.name || "";

      if (
        errorName === "PasswordException" ||
        errorMsg.includes("password") ||
        errorMsg.includes("encrypt")
      ) {
        if (!password) {
          throw new PasswordRequiredError();
        } else {
          throw new InvalidPasswordError();
        }
      }
      throw new CorruptedPdfError(`Failed to parse PDF: ${err?.message || err}`);
    }

    // Load with pdf-lib to extract catalog metadata and prepare mutation engine
    const { PDFDocument } = await import("pdf-lib");
    let pdfLibDoc;
    try {
      pdfLibDoc = await PDFDocument.load(this.rawBytes.slice(0), {
        ignoreEncryption: true,
        updateMetadata: false,
      });
    } catch {
      // If pdf-lib fails password or xref, we fallback to PDF.js metadata
    }

    const numPages = this.cachedPdfJsDoc.numPages;
    const pageInfos: PageInfo[] = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await this.cachedPdfJsDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      pageInfos.push({
        pageNumber: i,
        dimensions: {
          width: viewport.width,
          height: viewport.height,
        },
        rotation: page.rotate || 0,
      });
    }

    this.pageInfos = pageInfos;

    // Extract document metadata
    let docMetadata: any = {};
    try {
      const pdfJsMetadata = await this.cachedPdfJsDoc.getMetadata();
      docMetadata = pdfJsMetadata?.info || {};
    } catch {
      // Ignore metadata extraction errors
    }

    this.metadata = {
      title: docMetadata?.Title || pdfLibDoc?.getTitle() || undefined,
      author: docMetadata?.Author || pdfLibDoc?.getAuthor() || undefined,
      subject: docMetadata?.Subject || pdfLibDoc?.getSubject() || undefined,
      creator: docMetadata?.Creator || pdfLibDoc?.getCreator() || undefined,
      producer: docMetadata?.Producer || pdfLibDoc?.getProducer() || undefined,
      creationDate: pdfLibDoc?.getCreationDate() || undefined,
      modificationDate: pdfLibDoc?.getModificationDate() || undefined,
      pdfVersion: validation.version || docMetadata?.PDFFormatVersion || "1.7",
      isEncrypted: validation.isEncrypted || Boolean(password),
      pageCount: numPages,
      fileSizeBytes: data.byteLength,
    };

    return this.metadata;
  }

  async getPageInfos(): Promise<PageInfo[]> {
    if (!this.cachedPdfJsDoc) {
      throw new Error("No document loaded.");
    }
    return [...this.pageInfos];
  }

  async cancelRender(canvas: HTMLCanvasElement): Promise<void> {
    this.renderTokens.set(canvas, (this.renderTokens.get(canvas) || 0) + 1);
    const activeTask = this.activeRenderTasks.get(canvas);
    if (activeTask) {
      this.activeRenderTasks.delete(canvas);
      try {
        activeTask.cancel();
        // Wait for PDF.js to release the canvas internal lock
        await activeTask.promise.catch(() => {});
      } catch {
        // Ignored if already finished or cancelled
      }
    }

    const currentLock = this.canvasLocks.get(canvas);
    if (currentLock) {
      await currentLock.catch(() => {});
    }
  }

  async renderPage(options: RenderPageOptions): Promise<RenderResult> {
    if (!this.cachedPdfJsDoc) {
      throw new Error("No document loaded.");
    }

    const canvas = options.canvas;
    // Cancel in-flight render on this canvas and await complete release
    await this.cancelRender(canvas);

    const currentToken = (this.renderTokens.get(canvas) || 0) + 1;
    this.renderTokens.set(canvas, currentToken);

    let resolveLock: () => void = () => {};
    const lockPromise = new Promise<void>((res) => {
      resolveLock = res;
    });
    this.canvasLocks.set(canvas, lockPromise);

    try {
      const page = await this.cachedPdfJsDoc.getPage(options.pageNumber);
      if (this.renderTokens.get(canvas) !== currentToken) {
        return { width: 0, height: 0, renderedScale: options.scale };
      }

      const dpr =
        options.devicePixelRatio ||
        (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);

      // Calculate total rotation = native page rotation + viewing rotation
      const baseRotation = page.rotate || 0;
      const additionalRotation = options.rotation || 0;
      const totalRotation = (baseRotation + additionalRotation) % 360;

      // Viewport scaled by DPR for sharp high-DPI rendering
      const actualScale = options.scale * dpr;
      const viewport = page.getViewport({ scale: actualScale, rotation: totalRotation });

      // Logical dimensions for CSS
      const logicalViewport = page.getViewport({ scale: options.scale, rotation: totalRotation });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${logicalViewport.width}px`;
      canvas.style.height = `${logicalViewport.height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to get 2D canvas context.");
      }

      let renderTask: any;
      try {
        renderTask = page.render({
          canvasContext: ctx,
          viewport,
          intent: "display",
        });
        this.activeRenderTasks.set(canvas, renderTask);
      } catch (renderErr: any) {
        if (renderErr?.message?.includes("Cannot use the same canvas")) {
          await new Promise((res) => setTimeout(res, 80));
          if (this.renderTokens.get(canvas) !== currentToken) {
            return { width: 0, height: 0, renderedScale: options.scale };
          }
          renderTask = page.render({
            canvasContext: ctx,
            viewport,
            intent: "display",
          });
          this.activeRenderTasks.set(canvas, renderTask);
        } else {
          throw renderErr;
        }
      }

      try {
        await renderTask.promise;
      } catch (err: any) {
        if (
          err?.name === "RenderingCancelledException" ||
          err?.message?.includes("Rendering cancelled") ||
          err?.message?.includes("cancelled")
        ) {
          // Normal cancellation when user zooms or pages rapidly
          return {
            width: Math.round(logicalViewport.width),
            height: Math.round(logicalViewport.height),
            renderedScale: options.scale,
          };
        }
        throw err;
      } finally {
        this.activeRenderTasks.delete(canvas);
      }

      return {
        width: Math.round(logicalViewport.width),
        height: Math.round(logicalViewport.height),
        renderedScale: options.scale,
      };
    } finally {
      this.canvasLocks.delete(canvas);
      resolveLock();
    }
  }

  async renderThumbnail(options: RenderThumbnailOptions): Promise<RenderResult> {
    if (!this.cachedPdfJsDoc) {
      throw new Error("No document loaded.");
    }

    const canvas = options.canvas;
    await this.cancelRender(canvas);

    const currentToken = (this.renderTokens.get(canvas) || 0) + 1;
    this.renderTokens.set(canvas, currentToken);

    let resolveLock: () => void = () => {};
    const lockPromise = new Promise<void>((res) => {
      resolveLock = res;
    });
    this.canvasLocks.set(canvas, lockPromise);

    try {
      const page = await this.cachedPdfJsDoc.getPage(options.pageNumber);
      if (this.renderTokens.get(canvas) !== currentToken) {
        return { width: 0, height: 0, renderedScale: 1.0 };
      }

      const unscaledViewport = page.getViewport({ scale: 1.0 });

      const scale = options.targetWidth / unscaledViewport.width;
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const viewport = page.getViewport({ scale: scale * dpr, rotation: page.rotate || 0 });
      const logicalViewport = page.getViewport({ scale, rotation: page.rotate || 0 });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${logicalViewport.width}px`;
      canvas.style.height = `${logicalViewport.height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Failed to get 2D canvas context for thumbnail.");
      }

      let renderTask: any;
      try {
        renderTask = page.render({
          canvasContext: ctx,
          viewport,
        });
        this.activeRenderTasks.set(canvas, renderTask);
      } catch (renderErr: any) {
        if (renderErr?.message?.includes("Cannot use the same canvas")) {
          await new Promise((res) => setTimeout(res, 80));
          if (this.renderTokens.get(canvas) !== currentToken) {
            return { width: 0, height: 0, renderedScale: scale };
          }
          renderTask = page.render({
            canvasContext: ctx,
            viewport,
          });
          this.activeRenderTasks.set(canvas, renderTask);
        } else {
          throw renderErr;
        }
      }

      try {
        await renderTask.promise;
      } catch (err: any) {
        if (
          err?.name === "RenderingCancelledException" ||
          err?.message?.includes("Rendering cancelled") ||
          err?.message?.includes("cancelled")
        ) {
          return {
            width: Math.round(logicalViewport.width),
            height: Math.round(logicalViewport.height),
            renderedScale: scale,
          };
        }
        throw err;
      } finally {
        this.activeRenderTasks.delete(canvas);
      }

      return {
        width: Math.round(logicalViewport.width),
        height: Math.round(logicalViewport.height),
        renderedScale: scale,
      };
    } finally {
      this.canvasLocks.delete(canvas);
      resolveLock();
    }
  }

  async extractPageRegionAsImage(
    pageNumber: number,
    rect: { x: number; y: number; width: number; height: number }
  ): Promise<string> {
    if (!this.cachedPdfJsDoc) {
      throw new Error("No document loaded.");
    }

    const page = await this.cachedPdfJsDoc.getPage(pageNumber);
    const unscaledViewport = page.getViewport({ scale: 1.0 });

    const renderScale = 2.0;
    const viewport = page.getViewport({ scale: renderScale });

    if (typeof document === "undefined") return "";

    const offscreen = document.createElement("canvas");
    offscreen.width = viewport.width;
    offscreen.height = viewport.height;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return "";

    const renderTask = page.render({
      canvasContext: ctx,
      viewport,
    });
    await renderTask.promise;

    const cropX = Math.max(0, rect.x * renderScale);
    const cropY = Math.max(0, (unscaledViewport.height - rect.y - rect.height) * renderScale);
    const cropW = Math.min(offscreen.width - cropX, Math.max(10, rect.width * renderScale));
    const cropH = Math.min(offscreen.height - cropY, Math.max(10, rect.height * renderScale));

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext("2d");
    if (!cropCtx) return "";

    cropCtx.drawImage(offscreen, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    return cropCanvas.toDataURL("image/png");
  }

  async analyzeStyleProfile(pageNumber: number): Promise<DocumentStyleProfile> {
    if (!this.cachedPdfJsDoc) {
      throw new Error("No document loaded.");
    }

    const page = await this.cachedPdfJsDoc.getPage(pageNumber);
    const { analyzePdfPage } = await import("../analyzer/document-analyzer");
    return await analyzePdfPage(page);
  }

  async exportPdf(options: ExportPdfOptions): Promise<Uint8Array> {
    if (!this.rawBytes) {
      throw new Error("No document loaded.");
    }

    const { PDFDocument, rgb, StandardFonts, degrees } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.load(this.rawBytes.slice(0), {
      ignoreEncryption: true,
    });

    // Standard Font Dictionaries
    const fontsMap: Record<string, any> = {
      helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
      "helvetica-bold": await pdfDoc.embedFont(StandardFonts.HelveticaBold),
      "helvetica-italic": await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
      "helvetica-bolditalic": await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
      times: await pdfDoc.embedFont(StandardFonts.TimesRoman),
      "times-bold": await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
      "times-italic": await pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
      "times-bolditalic": await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic),
      courier: await pdfDoc.embedFont(StandardFonts.Courier),
      "courier-bold": await pdfDoc.embedFont(StandardFonts.CourierBold),
      "courier-italic": await pdfDoc.embedFont(StandardFonts.CourierOblique),
    };

    const resolveFont = (family: string, isBold: boolean, isItalic: boolean) => {
      const lower = (family || "helvetica").toLowerCase();
      let key = "helvetica";
      if (lower.includes("times")) key = "times";
      else if (lower.includes("courier")) key = "courier";

      if (isBold && isItalic) key += "-bolditalic";
      else if (isBold) key += "-bold";
      else if (isItalic) key += "-italic";

      return fontsMap[key] || fontsMap["helvetica"];
    };

    for (const op of options.operations) {
      if (op.type === "add_page") {
        await addBlankPage(pdfDoc, op.insertAtIndex, op.dimensions);
        continue;
      }

      if ("pageNumber" in op && op.pageNumber <= pdfDoc.getPageCount()) {
        const pageIdx = op.pageNumber - 1;
        const page = pdfDoc.getPage(pageIdx);

        switch (op.type) {
          case "whiteout": {
            const rgbColor = hexToRgb(op.fillColorHex) || { r: 255, g: 255, b: 255 };
            page.drawRectangle({
              x: op.rect.x,
              y: op.rect.y,
              width: op.rect.width,
              height: op.rect.height,
              color: rgb(rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255),
              opacity: op.opacity ?? 1.0,
            });
            break;
          }

          case "blackout": {
            page.drawRectangle({
              x: op.rect.x,
              y: op.rect.y,
              width: op.rect.width,
              height: op.rect.height,
              color: rgb(0, 0, 0),
              opacity: op.opacity ?? 1.0,
            });
            break;
          }

          case "redaction": {
            if (op.isPermanent) {
              await applyPermanentRedaction(
                pdfDoc,
                pageIdx,
                op.rect,
                op.textToRedact,
                op.fillColorHex
              );
            } else {
              const rgbColor = hexToRgb(op.fillColorHex) || { r: 0, g: 0, b: 0 };
              page.drawRectangle({
                x: op.rect.x,
                y: op.rect.y,
                width: op.rect.width,
                height: op.rect.height,
                color: rgb(rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255),
              });
            }
            break;
          }

          case "add_text": {
            const rgbColor = hexToRgb(op.fontColorHex) || { r: 0, g: 0, b: 0 };
            const font = resolveFont(
              op.fontFamily,
              op.fontWeight === "bold",
              op.fontStyle === "italic"
            );

            page.drawText(op.text, {
              x: op.position.x,
              y: op.position.y,
              size: op.fontSize,
              font,
              color: rgb(rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255),
              opacity: op.opacity ?? 1.0,
              rotate: op.rotation ? degrees(op.rotation) : undefined,
            });
            break;
          }

          case "add_shape": {
            const strokeRgb = hexToRgb(op.strokeColorHex) || { r: 0.1, g: 0.4, b: 0.9 };
            const fillRgb = op.fillColorHex ? hexToRgb(op.fillColorHex) : null;

            if (op.shapeType === "rectangle") {
              page.drawRectangle({
                x: op.rect.x,
                y: op.rect.y,
                width: op.rect.width,
                height: op.rect.height,
                borderColor: rgb(strokeRgb.r / 255, strokeRgb.g / 255, strokeRgb.b / 255),
                borderWidth: op.strokeWidth,
                color: fillRgb ? rgb(fillRgb.r / 255, fillRgb.g / 255, fillRgb.b / 255) : undefined,
                opacity: op.opacity ?? 1.0,
                rotate: op.rotation ? degrees(op.rotation) : undefined,
              });
            } else if (op.shapeType === "circle") {
              const xRadius = op.rect.width / 2;
              const yRadius = op.rect.height / 2;
              page.drawEllipse({
                x: op.rect.x + xRadius,
                y: op.rect.y + yRadius,
                xScale: xRadius,
                yScale: yRadius,
                borderColor: rgb(strokeRgb.r / 255, strokeRgb.g / 255, strokeRgb.b / 255),
                borderWidth: op.strokeWidth,
                color: fillRgb ? rgb(fillRgb.r / 255, fillRgb.g / 255, fillRgb.b / 255) : undefined,
                opacity: op.opacity ?? 1.0,
              });
            } else if (op.shapeType === "line" || op.shapeType === "arrow") {
              const startX = op.startPoint ? op.startPoint.x : op.rect.x;
              const startY = op.startPoint ? op.startPoint.y : op.rect.y;
              const endX = op.endPoint ? op.endPoint.x : op.rect.x + op.rect.width;
              const endY = op.endPoint ? op.endPoint.y : op.rect.y + op.rect.height;

              page.drawLine({
                start: { x: startX, y: startY },
                end: { x: endX, y: endY },
                thickness: op.strokeWidth,
                color: rgb(strokeRgb.r / 255, strokeRgb.g / 255, strokeRgb.b / 255),
                opacity: op.opacity ?? 1.0,
              });

              if (op.shapeType === "arrow") {
                // Draw arrowhead triangle at endPoint
                const angle = Math.atan2(endY - startY, endX - startX);
                const headLen = Math.max(8, op.strokeWidth * 4);
                const arrowX1 = endX - headLen * Math.cos(angle - Math.PI / 6);
                const arrowY1 = endY - headLen * Math.sin(angle - Math.PI / 6);
                const arrowX2 = endX - headLen * Math.cos(angle + Math.PI / 6);
                const arrowY2 = endY - headLen * Math.sin(angle + Math.PI / 6);

                page.drawLine({
                  start: { x: endX, y: endY },
                  end: { x: arrowX1, y: arrowY1 },
                  thickness: op.strokeWidth,
                  color: rgb(strokeRgb.r / 255, strokeRgb.g / 255, strokeRgb.b / 255),
                  opacity: op.opacity ?? 1.0,
                });
                page.drawLine({
                  start: { x: endX, y: endY },
                  end: { x: arrowX2, y: arrowY2 },
                  thickness: op.strokeWidth,
                  color: rgb(strokeRgb.r / 255, strokeRgb.g / 255, strokeRgb.b / 255),
                  opacity: op.opacity ?? 1.0,
                });
              }
            }
            break;
          }

          case "add_image": {
            try {
              const base64Data = op.imageDataUrl.split(",")[1] || op.imageDataUrl;
              const binary = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
              const embeddedImg =
                op.mimeType === "image/jpeg"
                  ? await pdfDoc.embedJpg(binary)
                  : await pdfDoc.embedPng(binary);

              page.drawImage(embeddedImg, {
                x: op.rect.x,
                y: op.rect.y,
                width: op.rect.width,
                height: op.rect.height,
                opacity: op.opacity ?? 1.0,
                rotate: op.rotation ? degrees(op.rotation) : undefined,
              });
            } catch {
              // Image embedding error fallback
            }
            break;
          }

          case "text_edit": {
            if (op.strategy === EditStrategy.NativeStreamModification) {
              const success = await applyNativeModification(
                pdfDoc,
                pageIdx,
                op.originalText,
                op.replacementText
              );
              if (!success) {
                // If stream surgery could not find exact byte sequence, gracefully fall back to local reconstruction
                await applyLocalReconstruction(
                  pdfDoc,
                  pageIdx,
                  op.originalText,
                  op.replacementText,
                  op.targetRect,
                  {
                    fontFamily: op.fontFamily,
                    fontSize: op.fontSize,
                    fontWeight: op.fontWeight,
                    fontStyle: op.fontStyle,
                    fontColorHex: op.fontColorHex,
                  }
                );
              }
            } else if (op.strategy === EditStrategy.LocalReconstruction) {
              await applyLocalReconstruction(
                pdfDoc,
                pageIdx,
                op.originalText,
                op.replacementText,
                op.targetRect,
                {
                  fontFamily: op.fontFamily,
                  fontSize: op.fontSize,
                  fontWeight: op.fontWeight,
                  fontStyle: op.fontStyle,
                  fontColorHex: op.fontColorHex,
                }
              );
            } else {
              await applyVisualOverlayFallback(
                pdfDoc,
                pageIdx,
                op.targetRect,
                op.replacementText,
                {
                  fontFamily: op.fontFamily,
                  fontSize: op.fontSize,
                  fontWeight: op.fontWeight,
                  fontStyle: op.fontStyle,
                  fontColorHex: op.fontColorHex,
                }
              );
            }
            break;
          }

          case "page_rotate": {
            const currentRotation = page.getRotation().angle;
            page.setRotation(degrees((currentRotation + op.rotationDegrees) % 360));
            break;
          }

          case "freehand": {
            if (op.points && op.points.length > 1) {
              const strokeRgb = hexToRgb(op.strokeColorHex) || { r: 0, g: 0, b: 0 };
              const color = rgb(strokeRgb.r / 255, strokeRgb.g / 255, strokeRgb.b / 255);
              const opac = op.opacity ?? (op.isHighlighter ? 0.45 : 1.0);
              const thick = op.strokeWidth || 3;
              for (let i = 0; i < op.points.length - 1; i++) {
                page.drawLine({
                  start: { x: op.points[i].x, y: op.points[i].y },
                  end: { x: op.points[i + 1].x, y: op.points[i + 1].y },
                  thickness: thick,
                  color,
                  opacity: opac,
                });
              }
            }
            break;
          }

          case "page_delete": {
            pdfDoc.removePage(pageIdx);
            break;
          }

          case "add_hyperlink": {
            await addHyperlinkAnnotation(pdfDoc, pageIdx, op);
            break;
          }

          case "delete_hyperlink": {
            await removeHyperlinkAnnotation(pdfDoc, pageIdx, op.rect);
            break;
          }
        }
      }
    }

    return await pdfDoc.save();
  }

  async exportPageImage(options: ExportImageOptions): Promise<Blob> {
    if (!this.cachedPdfJsDoc) {
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
      if (typeof canvas.toBlob === "function") {
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
      } else {
        // Fallback for environments lacking canvas.toBlob (e.g. standard JSDOM)
        try {
          const dataUrl = canvas.toDataURL(options.format, options.quality ?? 0.92);
          const base64 = dataUrl.split(",")[1] || "";
          const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          resolve(new Blob([binary], { type: options.format }));
        } catch (err) {
          reject(err);
        }
      }
    });
  }

  async exportAllPageImages(
    options: Omit<ExportImageOptions, "pageNumber">
  ): Promise<{ pageNumber: number; blob: Blob; fileName: string }[]> {
    if (!this.cachedPdfJsDoc) {
      throw new Error("No document loaded.");
    }
    const pageCount = this.cachedPdfJsDoc.numPages;
    const results: { pageNumber: number; blob: Blob; fileName: string }[] = [];
    const ext = options.format === "image/jpeg" ? "jpg" : "png";

    for (let p = 1; p <= pageCount; p++) {
      const blob = await this.exportPageImage({
        pageNumber: p,
        format: options.format,
        quality: options.quality,
        dpiScale: options.dpiScale,
      });
      const pageStr = String(p).padStart(2, "0");
      results.push({
        pageNumber: p,
        blob,
        fileName: `page-${pageStr}.${ext}`,
      });
    }

    return results;
  }

  async dispose(): Promise<void> {
    if (this.cachedPdfJsDoc) {
      try {
        await this.cachedPdfJsDoc.destroy();
      } catch {
        // Ignore destroy error
      }
      this.cachedPdfJsDoc = null;
    }
    this.rawBytes = null;
    this.currentPassword = undefined;
    this.metadata = null;
    this.pageInfos = [];
  }
}
