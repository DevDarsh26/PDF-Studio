import { create } from "zustand";
import { PdfDocumentMetadata, PageInfo } from "../core/models/document";
import { DocumentStyleProfile, TextToken, HyperlinkInfo } from "../core/models/style-profile";
import { Rect } from "../core/models/geometry";
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
  TextEditCommand,
  RedactionCommand,
  AddHyperlinkCommand,
  AddDrawingCommand,
} from "../core/commands/editor-commands";
import {
  saveDocumentSession,
  loadDocumentSession,
  clearDocumentSession,
} from "../core/persistence/document-persistence";

// ---- Debounced session save helper ----
let _debounceSaveTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_SAVE_MS = 500;

function _debouncedSaveSession(getState: () => EditorState): void {
  if (_debounceSaveTimer) clearTimeout(_debounceSaveTimer);
  _debounceSaveTimer = setTimeout(() => {
    _debounceSaveTimer = null;
    const { documentName, rawBytes, operations, currentPageNumber, zoomScale, viewRotation } = getState();
    if (documentName && rawBytes) {
      saveDocumentSession({
        documentName,
        rawBytes,
        operations,
        currentPageNumber,
        zoomScale,
        viewRotation,
      });
    }
  }, DEBOUNCE_SAVE_MS);
}

function _immediateSaveSession(state: EditorState): void {
  if (_debounceSaveTimer) {
    clearTimeout(_debounceSaveTimer);
    _debounceSaveTimer = null;
  }
  const { documentName, rawBytes, operations, currentPageNumber, zoomScale, viewRotation } = state;
  if (documentName && rawBytes) {
    saveDocumentSession({
      documentName,
      rawBytes,
      operations,
      currentPageNumber,
      zoomScale,
      viewRotation,
    });
  }
}

export type EditorTool =
  | "select"
  | "edit_text"
  | "add_text"
  | "add_image"
  | "whiteout"
  | "blackout"
  | "redaction"
  | "shape_rect"
  | "shape_circle"
  | "shape_line"
  | "shape_arrow"
  | "link"
  | "draw"
  | "highlight";

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
  editingTokenId: string | null;
  isExportModalOpen: boolean;
  isPageManagerOpen: boolean;
  pendingLinkRect: Rect | null;
  activeEditingLink: HyperlinkInfo | null;

  // Operations Ledger
  operations: EditOperation[];

  // Style Profiles & Formatting Clipboard
  currentStyleProfile: DocumentStyleProfile | null;
  activeFormatting: FormattingStyle;
  copiedFormatting: FormattingStyle | null;

  // Toast Feedback
  toastMessage: string | null;

  // Actions
  setEngineType: (type: SupportedEngineType) => void;
  loadDocumentBytes: (
    data: ArrayBuffer,
    fileName?: string,
    password?: string,
    restoreOptions?: {
      isRestoring?: boolean;
      operations?: EditOperation[];
      pageNumber?: number;
      zoomScale?: number;
      viewRotation?: number;
    }
  ) => Promise<void>;
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
  openTextEditorForToken: (tokenId: string) => void;
  closeTextEditor: () => void;
  openExportModal: () => void;
  closeExportModal: () => void;
  openPageManager: () => void;
  closePageManager: () => void;
  openAddLinkModal: (rect: Rect) => void;
  openEditLinkModal: (link: HyperlinkInfo) => void;
  closeLinkModal: () => void;
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
  showToast: (message: string) => void;
  copySelectedTextToClipboard: () => Promise<boolean>;
  restoreSession: () => Promise<boolean>;
  addBlankPageToDocument: (insertAtIndex?: number, dimensions?: { width: number; height: number }) => Promise<void>;
  deletePageFromDocument: (pageNumber: number) => Promise<void>;
  rotatePageInDocument: (pageNumber: number, rotationDegrees?: 90 | 180 | 270) => Promise<void>;
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

let sessionSaveTimer: ReturnType<typeof setTimeout> | null = null;
export const immediateSaveSession = (get: () => EditorState) => {
  if (sessionSaveTimer) {
    clearTimeout(sessionSaveTimer);
    sessionSaveTimer = null;
  }
  const { documentName, rawBytes, operations, currentPageNumber, zoomScale, viewRotation } = get();
  if (documentName && rawBytes) {
    saveDocumentSession({
      documentName,
      rawBytes,
      operations,
      currentPageNumber,
      zoomScale,
      viewRotation,
    });
  }
};

const debouncedSaveSession = (get: () => EditorState) => {
  if (sessionSaveTimer) clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(() => {
    immediateSaveSession(get);
  }, 350);
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
  editingTokenId: null,
  isExportModalOpen: false,
  isPageManagerOpen: false,
  pendingLinkRect: null,
  activeEditingLink: null,

  operations: [],
  currentStyleProfile: null,
  activeFormatting: DEFAULT_FORMATTING,
  copiedFormatting: null,
  toastMessage: null,

  setEngineType: (type: SupportedEngineType) => {
    const currentAdapter = get().adapter;
    currentAdapter.dispose();
    const newAdapter = createPdfAdapter(type);
    set({ engineType: type, adapter: newAdapter });
  },

  loadDocumentBytes: async (
    data: ArrayBuffer,
    fileName?: string,
    password?: string,
    restoreOptions?: {
      isRestoring?: boolean;
      operations?: EditOperation[];
      pageNumber?: number;
      zoomScale?: number;
      viewRotation?: number;
    }
  ) => {
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

      const initialPage = restoreOptions?.pageNumber && restoreOptions.pageNumber <= pageInfos.length
        ? restoreOptions.pageNumber
        : 1;

      set({ loadingProgress: 90 });
      let profile: DocumentStyleProfile | null = null;
      try {
        profile = await adapter.analyzeStyleProfile(initialPage);
      } catch {
        // Continue
      }

      const initialOps = restoreOptions?.isRestoring ? (restoreOptions.operations || []) : [];
      const initialZoom = restoreOptions?.isRestoring ? (restoreOptions.zoomScale || 1.0) : 1.0;
      const initialRotation = restoreOptions?.isRestoring ? (restoreOptions.viewRotation || 0) : 0;

      set({
        rawBytes: data.slice(0),
        metadata,
        pageInfos,
        currentPageNumber: initialPage,
        zoomScale: initialZoom,
        viewRotation: initialRotation,
        currentStyleProfile: profile,
        isLoading: false,
        loadingProgress: 100,
        errorMessage: null,
        isPasswordRequired: false,
        pendingBytes: null,
        operations: initialOps,
        selectedElementId: null,
        selectedTokenId: null,
      });

      useHistoryStore.getState().clearHistory();

      // Immediately persist document session to IndexedDB so refresh preserves workspace
      if (!restoreOptions?.isRestoring) {
        immediateSaveSession(get);
      }
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
    debouncedSaveSession(get);

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
    debouncedSaveSession(get);
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
    debouncedSaveSession(get);
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
    debouncedSaveSession(get);
  },

  rotateViewing: (direction: "cw" | "ccw" = "cw") => {
    const { viewRotation } = get();
    const delta = direction === "cw" ? 90 : 270;
    const nextRotation = (viewRotation + delta) % 360;
    set({ viewRotation: nextRotation });
    debouncedSaveSession(get);
  },

  setActiveTool: (tool: EditorTool) => {
    set({ activeTool: tool });
  },

  closeDocument: async () => {
    await clearDocumentSession();
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
      editingTokenId: null,
      isExportModalOpen: false,
  isPageManagerOpen: false,
  pendingLinkRect: null,
  activeEditingLink: null,
    });
    useHistoryStore.getState().clearHistory();
  },

  clearError: () => {
    set({ errorMessage: null });
  },

  // Interactive Operations Management
  selectElement: (id: string | null) => {
    set({ selectedElementId: id, selectedTokenId: null, editingTokenId: null });
    if (id) {
      const op = get().operations.find((o) => o.id === id);
      if (op) {
        if (op.type === "add_text" || op.type === "text_edit") {
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

  openTextEditorForToken: (tokenId: string) => {
    set({ editingTokenId: tokenId, selectedTokenId: tokenId, selectedElementId: null });
  },

  closeTextEditor: () => {
    set({ editingTokenId: null });
  },

  openExportModal: () => {
    set({ isExportModalOpen: true });
  },

  closeExportModal: () => {
    set({ isExportModalOpen: false });
  },

  openPageManager: () => {
    set({ isPageManagerOpen: true });
  },

  closePageManager: () => {
    set({ isPageManagerOpen: false });
  },

  openAddLinkModal: (rect: Rect) => {
    set({ pendingLinkRect: rect, activeEditingLink: null });
  },

  openEditLinkModal: (link: HyperlinkInfo) => {
    set({ activeEditingLink: link, pendingLinkRect: link.rect });
  },

  closeLinkModal: () => {
    set({ pendingLinkRect: null, activeEditingLink: null });
  },

  addOperationDirect: (op: EditOperation) => {
    const updated = [...get().operations, op];
    set({ operations: updated });
    debouncedSaveSession(get);
  },

  removeOperationDirect: (id: string) => {
    const updated = get().operations.filter((o) => o.id !== id);
    set({
      operations: updated,
      selectedElementId: get().selectedElementId === id ? null : get().selectedElementId,
    });
    debouncedSaveSession(get);
  },

  updateOperationDirect: (id: string, updates: Partial<EditOperation>) => {
    const updated = get().operations.map((o) => (o.id === id ? ({ ...o, ...updates } as EditOperation) : o));
    set({ operations: updated });
    debouncedSaveSession(get);
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
      case "redaction":
        command = new RedactionCommand(op, storeCallbacks);
        break;
      case "add_hyperlink":
        command = new AddHyperlinkCommand(op, storeCallbacks);
        break;
      case "text_edit":
        command = new TextEditCommand(op, storeCallbacks);
        break;
      case "freehand":
        command = new AddDrawingCommand(op, storeCallbacks);
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

  showToast: (message: string) => {
    set({ toastMessage: message });
    setTimeout(() => {
      if (get().toastMessage === message) {
        set({ toastMessage: null });
      }
    }, 2800);
  },

  copySelectedTextToClipboard: async () => {
    const { selectedTokenId, currentStyleProfile, selectedElementId, operations, showToast } = get();

    // 1. Text token is selected from document
    if (selectedTokenId && currentStyleProfile) {
      const token = currentStyleProfile.textTokens.find((t) => t.id === selectedTokenId);
      if (token && token.text) {
        try {
          await navigator.clipboard.writeText(token.text);
          showToast(`Copied: "${token.text.length > 25 ? token.text.substring(0, 25) + '...' : token.text}"`);
          return true;
        } catch {
          // Clipboard write fallback
        }
      }
    }

    // 2. Added/edited operation element is selected
    if (selectedElementId) {
      const op = operations.find((o) => o.id === selectedElementId);
      if (op) {
        let textToCopy = "";
        if (op.type === "add_text") textToCopy = op.text;
        else if (op.type === "text_edit") textToCopy = op.replacementText;

        if (textToCopy) {
          try {
            await navigator.clipboard.writeText(textToCopy);
            showToast(`Copied: "${textToCopy.length > 25 ? textToCopy.substring(0, 25) + '...' : textToCopy}"`);
            return true;
          } catch {
            // Clipboard write fallback
          }
        }
      }
    }

    // 3. Fallback to active browser text selection
    if (typeof window !== "undefined") {
      const selection = window.getSelection()?.toString();
      if (selection && selection.trim()) {
        try {
          await navigator.clipboard.writeText(selection);
          showToast(`Copied selection to clipboard`);
          return true;
        } catch {
          // Clipboard write fallback
        }
      }
    }

    return false;
  },

  restoreSession: async () => {
    try {
      const session = await loadDocumentSession();
      if (!session || !session.rawBytes || session.rawBytes.byteLength === 0) return false;

      const { loadDocumentBytes, showToast } = get();
      await loadDocumentBytes(
        session.rawBytes,
        session.documentName,
        undefined,
        {
          isRestoring: true,
          operations: session.operations || [],
          pageNumber: session.currentPageNumber || 1,
          zoomScale: session.zoomScale || 1.0,
          viewRotation: session.viewRotation || 0,
        }
      );

      showToast(`Restored session: ${session.documentName}`);
      return true;
    } catch (err) {
      console.warn("Failed to restore session:", err);
      return false;
    }
  },

  addBlankPageToDocument: async (insertAtIndex?: number, dimensions?: { width: number; height: number }) => {
    const { rawBytes, documentName, loadDocumentBytes, operations, zoomScale, viewRotation, showToast } = get();
    if (!rawBytes) return;

    try {
      const { PDFDocument } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.load(rawBytes.slice(0), { ignoreEncryption: true });
      const dims = dimensions || { width: 595.28, height: 841.89 }; // A4
      const targetIndex = insertAtIndex !== undefined ? insertAtIndex : pdfDoc.getPageCount();

      if (targetIndex >= 0 && targetIndex < pdfDoc.getPageCount()) {
        pdfDoc.insertPage(targetIndex, [dims.width, dims.height]);
      } else {
        pdfDoc.addPage([dims.width, dims.height]);
      }

      const newBytes = await pdfDoc.save({ useObjectStreams: true });
      const newPageNumber = targetIndex + 1;

      const safeBuffer = newBytes.buffer.slice(
        newBytes.byteOffset,
        newBytes.byteOffset + newBytes.byteLength
      ) as ArrayBuffer;

      await loadDocumentBytes(
        safeBuffer,
        documentName || "document.pdf",
        undefined,
        {
          isRestoring: true,
          operations: operations || [],
          pageNumber: newPageNumber,
          zoomScale,
          viewRotation,
        }
      );

      showToast(`Added new blank page (Page ${newPageNumber})`);
      immediateSaveSession(get);
    } catch (err) {
      console.error("Failed to add blank page:", err);
      showToast("Could not add blank page.");
    }
  },

  deletePageFromDocument: async (pageNumber: number) => {
    const { rawBytes, documentName, loadDocumentBytes, operations, zoomScale, viewRotation, pageInfos, showToast } = get();
    if (!rawBytes || pageInfos.length <= 1) {
      showToast("Cannot delete the only remaining page.");
      return;
    }

    try {
      const { PDFDocument } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.load(rawBytes.slice(0), { ignoreEncryption: true });
      pdfDoc.removePage(pageNumber - 1);

      const newBytes = await pdfDoc.save({ useObjectStreams: true });
      const nextPage = Math.max(1, Math.min(pageNumber, pdfDoc.getPageCount()));

      // Filter out operations belonging to the deleted page and decrement higher pages
      const updatedOps = (operations || [])
        .filter((op) => !("pageNumber" in op) || op.pageNumber !== pageNumber)
        .map((op) => {
          if ("pageNumber" in op && op.pageNumber > pageNumber) {
            return { ...op, pageNumber: op.pageNumber - 1 };
          }
          return op;
        });

      const safeBuffer = newBytes.buffer.slice(
        newBytes.byteOffset,
        newBytes.byteOffset + newBytes.byteLength
      ) as ArrayBuffer;

      await loadDocumentBytes(
        safeBuffer,
        documentName || "document.pdf",
        undefined,
        {
          isRestoring: true,
          operations: updatedOps,
          pageNumber: nextPage,
          zoomScale,
          viewRotation,
        }
      );

      showToast(`Deleted Page ${pageNumber}`);
      immediateSaveSession(get);
    } catch (err) {
      console.error("Failed to delete page:", err);
      showToast("Could not delete page.");
    }
  },

  rotatePageInDocument: async (pageNumber: number, rotationDegrees: 90 | 180 | 270 = 90) => {
    const { rawBytes, documentName, loadDocumentBytes, operations, zoomScale, viewRotation, showToast } = get();
    if (!rawBytes) return;

    try {
      const { PDFDocument, degrees } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.load(rawBytes.slice(0), { ignoreEncryption: true });
      const page = pdfDoc.getPage(pageNumber - 1);
      const curr = page.getRotation().angle;
      page.setRotation(degrees((curr + rotationDegrees) % 360));

      const newBytes = await pdfDoc.save({ useObjectStreams: true });

      const safeBuffer = newBytes.buffer.slice(
        newBytes.byteOffset,
        newBytes.byteOffset + newBytes.byteLength
      ) as ArrayBuffer;

      await loadDocumentBytes(
        safeBuffer,
        documentName || "document.pdf",
        undefined,
        {
          isRestoring: true,
          operations: operations || [],
          pageNumber,
          zoomScale,
          viewRotation,
        }
      );

      showToast(`Rotated Page ${pageNumber} by ${rotationDegrees}°`);
      immediateSaveSession(get);
    } catch (err) {
      console.error("Failed to rotate page:", err);
      showToast("Could not rotate page.");
    }
  },
}));
