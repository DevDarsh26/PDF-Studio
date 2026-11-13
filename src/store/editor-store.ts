import { create } from "zustand";
import { PdfDocumentMetadata, PageInfo } from "../core/models/document";
import { DocumentStyleProfile } from "../core/models/style-profile";
import { PdfEngineAdapter } from "../core/adapter/types";
import { createPdfAdapter, SupportedEngineType } from "../core/adapter";

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

export interface EditorState {
  // Engine
  engineType: SupportedEngineType;
  adapter: PdfEngineAdapter;

  // Document state
  rawBytes: ArrayBuffer | null;
  metadata: PdfDocumentMetadata | null;
  pageInfos: PageInfo[];
  currentPageNumber: number;
  zoomScale: number;
  isLoading: boolean;
  loadingProgress: number; // 0 - 100
  errorMessage: string | null;

  // Active Tool
  activeTool: EditorTool;

  // Style Profile
  currentStyleProfile: DocumentStyleProfile | null;

  // Actions
  setEngineType: (type: SupportedEngineType) => void;
  loadDocumentBytes: (data: ArrayBuffer, password?: string) => Promise<void>;
  setCurrentPage: (pageNumber: number) => void;
  setZoomScale: (scale: number) => void;
  setActiveTool: (tool: EditorTool) => void;
  resetDocument: () => Promise<void>;
  clearError: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  engineType: "hybrid",
  adapter: createPdfAdapter("hybrid"),

  rawBytes: null,
  metadata: null,
  pageInfos: [],
  currentPageNumber: 1,
  zoomScale: 1.0,
  isLoading: false,
  loadingProgress: 0,
  errorMessage: null,

  activeTool: "select",
  currentStyleProfile: null,

  setEngineType: (type: SupportedEngineType) => {
    const currentAdapter = get().adapter;
    currentAdapter.dispose();
    const newAdapter = createPdfAdapter(type);
    set({ engineType: type, adapter: newAdapter });
  },

  loadDocumentBytes: async (data: ArrayBuffer, password?: string) => {
    const { adapter } = get();
    set({ isLoading: true, loadingProgress: 10, errorMessage: null });

    try {
      set({ loadingProgress: 30 });
      const metadata = await adapter.loadDocument(data, password);

      set({ loadingProgress: 60 });
      const pageInfos = await adapter.getPageInfos();

      set({ loadingProgress: 80 });
      const profile = await adapter.analyzeStyleProfile(1);

      set({
        rawBytes: data.slice(0),
        metadata,
        pageInfos,
        currentPageNumber: 1,
        currentStyleProfile: profile,
        isLoading: false,
        loadingProgress: 100,
        errorMessage: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load PDF document.";
      set({
        isLoading: false,
        loadingProgress: 0,
        errorMessage: message,
      });
      throw err;
    }
  },

  setCurrentPage: async (pageNumber: number) => {
    const { pageInfos, adapter } = get();
    if (pageNumber < 1 || pageNumber > pageInfos.length) return;

    set({ currentPageNumber: pageNumber });

    try {
      const profile = await adapter.analyzeStyleProfile(pageNumber);
      set({ currentStyleProfile: profile });
    } catch {
      // Keep existing profile on failure
    }
  },

  setZoomScale: (scale: number) => {
    const clamped = Math.max(0.25, Math.min(4.0, scale));
    set({ zoomScale: clamped });
  },

  setActiveTool: (tool: EditorTool) => {
    set({ activeTool: tool });
  },

  resetDocument: async () => {
    const { adapter } = get();
    await adapter.dispose();
    set({
      rawBytes: null,
      metadata: null,
      pageInfos: [],
      currentPageNumber: 1,
      currentStyleProfile: null,
      errorMessage: null,
    });
  },

  clearError: () => {
    set({ errorMessage: null });
  },
}));
