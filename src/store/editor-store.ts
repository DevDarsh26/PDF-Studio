import { create } from "zustand";
import { PdfDocumentMetadata, PageInfo } from "../core/models/document";
import { DocumentStyleProfile, TextToken } from "../core/models/style-profile";
import { PdfEngineAdapter } from "../core/adapter/types";
import { createPdfAdapter, SupportedEngineType } from "../core/adapter";
import { PasswordRequiredError, InvalidPasswordError } from "../core/models/errors";
import { EditOperation, FormattingStyle } from "../core/models/operations";
import { useHistoryStore } from "./history-store";
import {
  AddTextCommand,
  AddShapeCommand,
  AddImageCommand,
  WhiteoutCommand,
  BlackoutCommand,
  DeleteElementCommand,
  UpdateElementCommand,
} from "../core/commands/editor-commands";

export type EditorTool =
  | "select"
  | "add_text"
  | "add_image"
  | "whiteout"
  | "blackout"
  | "shape_rect"
  | "shape_circle"
  | "shape_line"
  | "shape_arrow"
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

  // Active Tool & Selection
  activeTool: EditorTool;
  selectedElementId: string | null;
  selectedTokenId: string | null;

  // Operations Ledger
  operations: EditOperation[];

  // Style Profiles & Formatting Clipboard
  currentStyleProfile: DocumentStyleProfile | null;
  activeFormatting: FormattingStyle;
  copiedFormatting: FormattingStyle | null;

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

  // Interactive Operations & Formatting
  selectElement: (id: string | null) => void;
  selectToken: (id: string | null) => void;
  addOperationDirect: (op: EditOperation) => void;
  removeOperationDirect: (id: string) => void;
  updateOperationDirect: (id: string, updates: Partial<EditOperation>) => void;
  executeAddOperation: (op: EditOperation) => Promise<void>;
  executeUpdateElement: (id: string, updates: Partial<EditOperation>) => Promise<void>;
  deleteSelected: () => Promise<void>;
  copyFormatting: () => void;
  pasteFormatting: () => Promise<void>;
  setActiveFormatting: (formatting: Partial<FormattingStyle>) => void;
  inheritStyleFromSelectedToken: () => FormattingStyle | null;
}

const DEFAULT_FORMATTING: FormattingStyle = {
  fontFamily: "Helvetica",
  fontSize: 14,
  fontWeight: "normal",
  fontStyle: "normal",
  fontColorHex: "#000000",
  alignment: "left",
  opacity: 1.0,
  strokeColorHex: "#2563eb",
  fillColorHex: "#3b82f6",
  strokeWidth: 2,
};

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
  selectedElementId: null,
  selectedTokenId: null,

  operations: [],
  currentStyleProfile: null,
  activeFormatting: DEFAULT_FORMATTING,
  copiedFormatting: null,

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
        // Continue
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
        operations: [],
        selectedElementId: null,
        selectedTokenId: null,
      });

      useHistoryStore.getState().clearHistory();
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

    set({ currentPageNumber: pageNumber, selectedElementId: null, selectedTokenId: null });

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
    const targetWidth = Math.max(200, containerWidth - 64);
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
      operations: [],
      selectedElementId: null,
      selectedTokenId: null,
    });
    useHistoryStore.getState().clearHistory();
  },

  clearError: () => {
    set({ errorMessage: null });
  },

  // Interactive Operations Management
  selectElement: (id: string | null) => {
    set({ selectedElementId: id, selectedTokenId: null });
    if (id) {
      const op = get().operations.find((o) => o.id === id);
      if (op) {
        if (op.type === "add_text") {
          set({
            activeFormatting: {
              ...get().activeFormatting,
              fontFamily: op.fontFamily,
              fontSize: op.fontSize,
              fontWeight: op.fontWeight,
              fontStyle: op.fontStyle,
              fontColorHex: op.fontColorHex,
              alignment: op.alignment,
              opacity: op.opacity,
            },
          });
        } else if (op.type === "add_shape") {
          set({
            activeFormatting: {
              ...get().activeFormatting,
              strokeColorHex: op.strokeColorHex,
              fillColorHex: op.fillColorHex,
              strokeWidth: op.strokeWidth,
              opacity: op.opacity,
            },
          });
        }
      }
    }
  },

  selectToken: (id: string | null) => {
    set({ selectedTokenId: id, selectedElementId: null });
  },

  addOperationDirect: (op: EditOperation) => {
    set({ operations: [...get().operations, op] });
  },

  removeOperationDirect: (id: string) => {
    set({
      operations: get().operations.filter((o) => o.id !== id),
      selectedElementId: get().selectedElementId === id ? null : get().selectedElementId,
    });
  },

  updateOperationDirect: (id: string, updates: Partial<EditOperation>) => {
    set({
      operations: get().operations.map((o) => (o.id === id ? ({ ...o, ...updates } as EditOperation) : o)),
    });
  },

  executeAddOperation: async (op: EditOperation) => {
    const storeCallbacks = {
      addOperation: get().addOperationDirect,
      removeOperation: get().removeOperationDirect,
      updateOperation: get().updateOperationDirect,
    };

    let command;
    switch (op.type) {
      case "add_text":
        command = new AddTextCommand(op, storeCallbacks);
        break;
      case "add_shape":
        command = new AddShapeCommand(op, storeCallbacks);
        break;
      case "add_image":
        command = new AddImageCommand(op, storeCallbacks);
        break;
      case "whiteout":
        command = new WhiteoutCommand(op, storeCallbacks);
        break;
      case "blackout":
        command = new BlackoutCommand(op, storeCallbacks);
        break;
      default:
        get().addOperationDirect(op);
        return;
    }

    await useHistoryStore.getState().executeCommand(command);
    set({ selectedElementId: op.id });
  },

  executeUpdateElement: async (id: string, updates: Partial<EditOperation>) => {
    const currentOp = get().operations.find((o) => o.id === id);
    if (!currentOp) return;

    const previousState: Partial<EditOperation> = {};
    for (const key of Object.keys(updates) as Array<keyof EditOperation>) {
      (previousState as any)[key] = currentOp[key];
    }

    const command = new UpdateElementCommand(
      id,
      previousState,
      updates,
      {
        addOperation: get().addOperationDirect,
        removeOperation: get().removeOperationDirect,
        updateOperation: get().updateOperationDirect,
      }
    );

    await useHistoryStore.getState().executeCommand(command);
  },

  deleteSelected: async () => {
    const { selectedElementId, operations } = get();
    if (!selectedElementId) return;

    const targetOp = operations.find((o) => o.id === selectedElementId);
    if (!targetOp) return;

    const command = new DeleteElementCommand(targetOp, {
      addOperation: get().addOperationDirect,
      removeOperation: get().removeOperationDirect,
      updateOperation: get().updateOperationDirect,
    });

    await useHistoryStore.getState().executeCommand(command);
    set({ selectedElementId: null });
  },

  copyFormatting: () => {
    const { selectedElementId, selectedTokenId, operations, currentStyleProfile } = get();

    if (selectedElementId) {
      const op = operations.find((o) => o.id === selectedElementId);
      if (op && op.type === "add_text") {
        set({
          copiedFormatting: {
            fontFamily: op.fontFamily,
            fontSize: op.fontSize,
            fontWeight: op.fontWeight,
            fontStyle: op.fontStyle,
            fontColorHex: op.fontColorHex,
            alignment: op.alignment,
            opacity: op.opacity,
          },
        });
        return;
      }
    }

    if (selectedTokenId && currentStyleProfile) {
      const token = currentStyleProfile.textTokens.find((t) => t.id === selectedTokenId);
      if (token) {
        const font = currentStyleProfile.detectedFonts.get(token.fontId);
        set({
          copiedFormatting: {
            fontFamily: font?.family || "Helvetica",
            fontSize: token.fontSize || 12,
            fontWeight: font?.isBold ? "bold" : "normal",
            fontStyle: font?.isItalic ? "italic" : "normal",
            fontColorHex: token.colorHex || "#000000",
            alignment: "left",
            opacity: 1.0,
          },
        });
      }
    }
  },

  pasteFormatting: async () => {
    const { selectedElementId, copiedFormatting, executeUpdateElement } = get();
    if (!selectedElementId || !copiedFormatting) return;

    await executeUpdateElement(selectedElementId, {
      fontFamily: copiedFormatting.fontFamily,
      fontSize: copiedFormatting.fontSize,
      fontWeight: copiedFormatting.fontWeight,
      fontStyle: copiedFormatting.fontStyle,
      fontColorHex: copiedFormatting.fontColorHex,
      alignment: copiedFormatting.alignment,
      opacity: copiedFormatting.opacity,
    } as any);
  },

  setActiveFormatting: (formatting: Partial<FormattingStyle>) => {
    const updated = { ...get().activeFormatting, ...formatting };
    set({ activeFormatting: updated });

    const selectedId = get().selectedElementId;
    if (selectedId) {
      get().executeUpdateElement(selectedId, formatting as any);
    }
  },

  inheritStyleFromSelectedToken: (): FormattingStyle | null => {
    const { selectedTokenId, currentStyleProfile } = get();
    if (!selectedTokenId || !currentStyleProfile) return null;

    const token = currentStyleProfile.textTokens.find((t) => t.id === selectedTokenId);
    if (!token) return null;

    const font = currentStyleProfile.detectedFonts.get(token.fontId);
    const inherited: FormattingStyle = {
      fontFamily: font?.family || "Helvetica",
      fontSize: token.fontSize || 12,
      fontWeight: font?.isBold ? "bold" : "normal",
      fontStyle: font?.isItalic ? "italic" : "normal",
      fontColorHex: token.colorHex || "#000000",
      alignment: "left",
      opacity: 1.0,
    };

    set({ activeFormatting: inherited, copiedFormatting: inherited });
    return inherited;
  },
}));
