import { PdfDocumentMetadata, PageInfo, DocumentValidationResult } from "../models/document";
import { DocumentStyleProfile } from "../models/style-profile";
import { EditOperation } from "../models/operations";

export interface RenderPageOptions {
  pageNumber: number;
  scale: number;
  rotation?: number; // Additional viewing rotation degrees (0, 90, 180, 270)
  canvas: HTMLCanvasElement;
  renderAnnotations?: boolean;
  devicePixelRatio?: number;
}

export interface RenderThumbnailOptions {
  pageNumber: number;
  targetWidth: number;
  canvas: HTMLCanvasElement;
}

export interface RenderResult {
  width: number;
  height: number;
  renderedScale: number;
}

export interface ExportPdfOptions {
  operations: EditOperation[];
  preserveOriginalMetadata?: boolean;
  compress?: boolean;
}

export interface ExportImageOptions {
  pageNumber: number;
  format: "image/png" | "image/jpeg";
  quality?: number; // 0.0 - 1.0 (for JPEG)
  dpiScale?: number; // 1 = 72dpi, 2 = 144dpi, 4 = 300dpi
}

/**
 * Standard pluggable adapter interface for PDF engines.
 * Decouples the UI and application state from specific low-level libraries
 * (e.g. pdf-lib, pdfjs-dist, mupdf).
 */
export interface PdfEngineAdapter {
  readonly engineName: string;
  readonly engineVersion: string;
  readonly isWasmAccelerated: boolean;

  /**
   * Validates raw document bytes before full loading.
   */
  validate(data: ArrayBuffer): Promise<DocumentValidationResult>;

  /**
   * Initializes a document session from raw immutable bytes.
   * Throws PasswordRequiredError or InvalidPasswordError if password-protected.
   */
  loadDocument(data: ArrayBuffer, password?: string): Promise<PdfDocumentMetadata>;

  /**
   * Retrieves page count and dimension metrics for all pages.
   */
  getPageInfos(): Promise<PageInfo[]>;

  /**
   * Extracts layout, typography, hyperlinks, and color profiles from a page.
   */
  analyzeStyleProfile(pageNumber: number): Promise<DocumentStyleProfile>;

  /**
   * High-accuracy rasterization of a specific page to an HTML5 canvas.
   */
  renderPage(options: RenderPageOptions): Promise<RenderResult>;

  /**
   * Quick thumbnail rasterization for the navigation sidebar.
   */
  renderThumbnail(options: RenderThumbnailOptions): Promise<RenderResult>;

  /**
   * Cancels in-flight render task for a given canvas if active.
   */
  cancelRender?(canvas: HTMLCanvasElement): void;

  /**
   * Applies all recorded operations on top of the immutable source bytes,
   * yielding a valid, high-accuracy exported PDF binary.
   */
  exportPdf(options: ExportPdfOptions): Promise<Uint8Array>;

  /**
   * Exports an individual page as an image Blob (PNG or JPEG).
   */
  exportPageImage(options: ExportImageOptions): Promise<Blob>;

  /**
   * Destroys in-memory resources, worker instances, or WASM heaps.
   */
  dispose(): Promise<void>;
}
