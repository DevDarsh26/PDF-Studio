import { create } from "zustand";
import { PdfDocumentMetadata, PageInfo } from "../core/models/document";
import { DocumentStyleProfile } from "../core/models/style-profile";
import { PdfEngineAdapter } from "../core/adapter/types";
import { createPdfAdapter, SupportedEngineType } from "../core/adapter";
import { PasswordRequiredError, InvalidPasswordError } from "../core/models/errors";

export type EditorTool =
  | "select"
  | "edit_text"
  | "add_text"
  | "add_image"
  | "whiteout"
  | "blackout"
  | "redact"
  | "shape_rect"
  | "shape_circle"
  | "shape_line"
  | "link";

export type FitMode = "custom" | "width" | "page";

export interface EditorState {
  // Engine
  engineType: SupportedEngineType;
  adapter: PdfEngineAdapter;

  // Document state
  documentName: string | null;
  rawBytes: ArrayBuffer | null;
  metadata: PdfDocumentMetadata | null;
  pageInfos: PageInfo[];
  currentPageNumber: number;
  zoomScale: number;
  viewRotation: number; // 0, 90, 180, 270
  fitMode: FitMode;

  // Loading & Error States
  isLoading: boolean;
  loadingProgress: number; // 0 - 100
  errorMessage: string | null;

  // Password Protection Modal State
  isPasswordRequired: boolean;
  pendingBytes: ArrayBuffer | null;

  // Active Tool
  activeTool: EditorTool;

  // Style Profile
  currentStyleProfile: DocumentStyleProfile | null;

  // Actions
  setEngineType: (type: SupportedEngineType) => void;
  loadDocumentBytes: (data: ArrayBuffer, fileName?: string, password?: string) => Promise<void>;
  submitPassword: (password: string) => Promise<void>;
  cancelPasswordPrompt: () => void;
  setCurrentPage: (pageNumber: number) => Promise<void>;
  nextPage: () => Promise<void>;
  prevPage: () => Promise<void>;
  setZoomScale: (scale: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToWidth: (containerWidth: number) => void;
  fitToPage: (containerWidth: number, containerHeight: number) => void;
  rotateViewing: (direction?: "cw" | "ccw") => void;
  setActiveTool: (tool: EditorTool) => void;
  closeDocument: () => Promise<void>;
  clearError: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  engineType: "hybrid",
  adapter: createPdfAdapter("hybrid"),

  documentName: null,
  rawBytes: null,
  metadata: null,
  pageInfos: [],
  currentPageNumber: 1,
  zoomScale: 1.0,
  viewRotation: 0,
  fitMode: "custom",

  isLoading: false,
  loadingProgress: 0,
  errorMessage: null,

  isPasswordRequired: false,
  pendingBytes: null,

  activeTool: "select",
  currentStyleProfile: null,

  setEngineType: (type: SupportedEngineType) => {
    const currentAdapter = get().adapter;
    currentAdapter.dispose();
    const newAdapter = createPdfAdapter(type);
    set({ engineType: type, adapter: newAdapter });
  },

  loadDocumentBytes: async (data: ArrayBuffer, fileName?: string, password?: string) => {
    const { adapter } = get();
    set({
      isLoading: true,
      loadingProgress: 15,
      errorMessage: null,
      documentName: fileName || get().documentName || "document.pdf",
    });

    try {
      set({ loadingProgress: 40 });
      const metadata = await adapter.loadDocument(data, password);

      set({ loadingProgress: 75 });
      const pageInfos = await adapter.getPageInfos();

      set({ loadingProgress: 90 });
      let profile: DocumentStyleProfile | null = null;
      try {
        profile = await adapter.analyzeStyleProfile(1);
      } catch {
        // Continue even if initial style inspection encounters non-standard tokens
      }

      set({
        rawBytes: data.slice(0),
        metadata,
        pageInfos,
        currentPageNumber: 1,
        viewRotation: 0,
        currentStyleProfile: profile,
        isLoading: false,
        loadingProgress: 100,
        errorMessage: null,
        isPasswordRequired: false,
        pendingBytes: null,
      });
    } catch (err: unknown) {
      if (err instanceof PasswordRequiredError) {
        set({
          isLoading: false,
          loadingProgress: 0,
          isPasswordRequired: true,
          pendingBytes: data.slice(0),
          errorMessage: null,
        });
        return;
      }

      if (err instanceof InvalidPasswordError) {
        set({
          isLoading: false,
          loadingProgress: 0,
          isPasswordRequired: true,
          pendingBytes: data.slice(0),
          errorMessage: "Incorrect password. Please verify and try again.",
        });
        return;
      }

      const message = err instanceof Error ? err.message : "Failed to load PDF document.";
      set({
        isLoading: false,
        loadingProgress: 0,
        errorMessage: message,
        isPasswordRequired: false,
        pendingBytes: null,
      });
      throw err;
    }
  },

  submitPassword: async (password: string) => {
    const { pendingBytes, documentName, loadDocumentBytes } = get();
    if (!pendingBytes) return;
    await loadDocumentBytes(pendingBytes, documentName || undefined, password);
  },

  cancelPasswordPrompt: () => {
    set({
      isPasswordRequired: false,
      pendingBytes: null,
      errorMessage: null,
      isLoading: false,
    });
  },

  setCurrentPage: async (pageNumber: number) => {
    const { pageInfos, adapter } = get();
    if (pageNumber < 1 || pageNumber > pageInfos.length) return;

    set({ currentPageNumber: pageNumber });

    try {
      const profile = await adapter.analyzeStyleProfile(pageNumber);
      set({ currentStyleProfile: profile });
    } catch {
      // Keep existing profile
    }
  },

  nextPage: async () => {
    const { currentPageNumber, pageInfos, setCurrentPage } = get();
    if (currentPageNumber < pageInfos.length) {
      await setCurrentPage(currentPageNumber + 1);
    }
  },

  prevPage: async () => {
    const { currentPageNumber, setCurrentPage } = get();
    if (currentPageNumber > 1) {
      await setCurrentPage(currentPageNumber - 1);
    }
  },

  setZoomScale: (scale: number) => {
    const clamped = Math.max(0.25, Math.min(4.0, Math.round(scale * 100) / 100));
    set({ zoomScale: clamped, fitMode: "custom" });
  },

  zoomIn: () => {
    const { zoomScale, setZoomScale } = get();
    setZoomScale(zoomScale + 0.15);
  },

  zoomOut: () => {
    const { zoomScale, setZoomScale } = get();
    setZoomScale(zoomScale - 0.15);
  },

  fitToWidth: (containerWidth: number) => {
    const { pageInfos, currentPageNumber, viewRotation } = get();
    const page = pageInfos[currentPageNumber - 1];
    if (!page || containerWidth <= 0) return;

    const isRotated = (page.rotation + viewRotation) % 180 !== 0;
    const pageWidth = isRotated ? page.dimensions.height : page.dimensions.width;
    const targetWidth = Math.max(200, containerWidth - 64); // 32px padding on each side
    const scale = Math.max(0.25, Math.min(3.0, targetWidth / pageWidth));

    set({ zoomScale: Math.round(scale * 100) / 100, fitMode: "width" });
  },

  fitToPage: (containerWidth: number, containerHeight: number) => {
    const { pageInfos, currentPageNumber, viewRotation } = get();
    const page = pageInfos[currentPageNumber - 1];
    if (!page || containerWidth <= 0 || containerHeight <= 0) return;

    const isRotated = (page.rotation + viewRotation) % 180 !== 0;
    const pageWidth = isRotated ? page.dimensions.height : page.dimensions.width;
    const pageHeight = isRotated ? page.dimensions.width : page.dimensions.height;

    const availWidth = Math.max(200, containerWidth - 64);
    const availHeight = Math.max(200, containerHeight - 64);

    const scaleW = availWidth / pageWidth;
    const scaleH = availHeight / pageHeight;
    const scale = Math.max(0.25, Math.min(3.0, Math.min(scaleW, scaleH)));

    set({ zoomScale: Math.round(scale * 100) / 100, fitMode: "page" });
  },

  rotateViewing: (direction: "cw" | "ccw" = "cw") => {
    const { viewRotation } = get();
    const delta = direction === "cw" ? 90 : 270;
    const nextRotation = (viewRotation + delta) % 360;
    set({ viewRotation: nextRotation });
  },

  setActiveTool: (tool: EditorTool) => {
    set({ activeTool: tool });
  },

  closeDocument: async () => {
    const { adapter } = get();
    await adapter.dispose();
    set({
      documentName: null,
      rawBytes: null,
      metadata: null,
      pageInfos: [],
      currentPageNumber: 1,
      zoomScale: 1.0,
      viewRotation: 0,
      fitMode: "custom",
      currentStyleProfile: null,
      errorMessage: null,
      isPasswordRequired: false,
      pendingBytes: null,
      activeTool: "select",
    });
  },

  clearError: () => {
    set({ errorMessage: null });
  },
}));
