"use client";

import React, { useRef, useState } from "react";
import {
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  X,
  MousePointer,
  Type,
  Eraser,
  Square,
  Circle,
  Minus,
  MoveRight,
  Image as ImageIcon,
  Copy,
  Trash2,
  Undo2,
  Redo2,
  Download,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  Pencil,
} from "lucide-react";
import { useEditorStore, EditorTool } from "@/store/editor-store";
import { useHistoryStore } from "@/store/history-store";
import { AddImageOperation } from "@/core/models/operations";

interface TopToolbarProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({ containerRef }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const {
    documentName,
    pageInfos,
    currentPageNumber,
    zoomScale,
    viewRotation,
    activeTool,
    selectedElementId,
    selectedTokenId,
    operations,
    activeFormatting,
    copiedFormatting,
    currentStyleProfile,
    adapter,
    loadDocumentBytes,
    setCurrentPage,
    nextPage,
    prevPage,
    setZoomScale,
    zoomIn,
    zoomOut,
    fitToWidth,
    fitToPage,
    rotateViewing,
    setActiveTool,
    closeDocument,
    deleteSelected,
    copyFormatting,
    pasteFormatting,
    setActiveFormatting,
    inheritStyleFromSelectedToken,
    executeAddOperation,
    openTextEditorForToken,
  } = useEditorStore();

  const { state: historyState, undo, redo } = useHistoryStore();
  const [isExporting, setIsExporting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      await loadDocumentBytes(buffer, file.name);
    } catch {
      // Handled in store
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      const currentPage = pageInfos[currentPageNumber - 1];
      const pageW = currentPage?.dimensions.width || 595;
      const pageH = currentPage?.dimensions.height || 842;

      const imgOp: AddImageOperation = {
        id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        pageNumber: currentPageNumber,
        timestamp: Date.now(),
        type: "add_image",
        imageDataUrl: dataUrl,
        mimeType: file.type === "image/jpeg" ? "image/jpeg" : "image/png",
        rect: {
          x: Math.round(pageW / 2 - 75),
          y: Math.round(pageH / 2 - 50),
          width: 150,
          height: 100,
        },
        opacity: 1.0,
      };

      await executeAddOperation(imgOp);
      setActiveTool("select");
    };
    reader.readAsDataURL(file);
    // Reset input
    e.target.value = "";
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const exportedBytes = await adapter.exportPdf({
        operations,
      });

      const blob = new Blob([exportedBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = documentName ? `edited-${documentName}` : "edited-document.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const totalPages = pageInfos.length;

  // Selected Token for Style Matching
  const selectedToken = selectedTokenId
    ? currentStyleProfile?.textTokens.find((t) => t.id === selectedTokenId)
    : null;
  const tokenFont = selectedToken
    ? currentStyleProfile?.detectedFonts.get(selectedToken.fontId)
    : null;

  return (
    <header className="border-b border-slate-200 bg-white flex flex-col z-20 shadow-2xs select-none">
      {/* Primary Navigation & Main Tools Bar */}
      <div className="h-13 px-4 flex items-center justify-between">
        {/* Brand & Document Name */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-black text-xs text-white shadow-sm">
              PS
            </div>
            <div className="hidden sm:block">
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-xs text-slate-900 tracking-tight">PDF Studio</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  <span>Local</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 12 Core Editing Tools */}
        <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
          {/* 1. Select */}
          <button
            onClick={() => setActiveTool("select")}
            title="Select & Transform (V)"
            className={`p-1.5 rounded transition ${
              activeTool === "select"
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-slate-700 hover:bg-white"
            }`}
          >
            <MousePointer className="w-3.5 h-3.5" />
          </button>

          {/* 2. Edit Existing Text */}
          <button
            onClick={() => setActiveTool("edit_text")}
            title="Edit Existing Text (Click any text on page)"
            className={`p-1.5 rounded transition ${
              activeTool === "edit_text"
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-slate-700 hover:bg-white"
            }`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          {/* 3. Add Text */}
          <button
            onClick={() => setActiveTool("add_text")}
            title="Add Text (T)"
            className={`p-1.5 rounded transition ${
              activeTool === "add_text"
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-slate-700 hover:bg-white"
            }`}
          >
            <Type className="w-3.5 h-3.5" />
          </button>

          {/* 3. Add Image */}
          <button
            onClick={() => imageInputRef.current?.click()}
            title="Add Image"
            className="p-1.5 rounded text-slate-700 hover:bg-white transition"
          >
            <ImageIcon className="w-3.5 h-3.5" />
          </button>
          <input
            type="file"
            ref={imageInputRef}
            onChange={handleImageUpload}
            accept="image/png,image/jpeg"
            className="hidden"
          />

          <div className="w-px h-4 bg-slate-300 mx-0.5" />

          {/* 4. Whiteout */}
          <button
            onClick={() => setActiveTool("whiteout")}
            title="Whiteout (Cover Area)"
            className={`p-1.5 rounded transition ${
              activeTool === "whiteout"
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-slate-700 hover:bg-white"
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>

          {/* 5. Blackout */}
          <button
            onClick={() => setActiveTool("blackout")}
            title="Blackout"
            className={`p-1.5 rounded transition ${
              activeTool === "blackout"
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-slate-700 hover:bg-white"
            }`}
          >
            <div className="w-3.5 h-3.5 rounded bg-black border border-slate-600" />
          </button>

          <div className="w-px h-4 bg-slate-300 mx-0.5" />

          {/* 6. Rectangle */}
          <button
            onClick={() => setActiveTool("shape_rect")}
            title="Rectangle"
            className={`p-1.5 rounded transition ${
              activeTool === "shape_rect"
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-slate-700 hover:bg-white"
            }`}
          >
            <Square className="w-3.5 h-3.5" />
          </button>

          {/* 7. Circle */}
          <button
            onClick={() => setActiveTool("shape_circle")}
            title="Circle"
            className={`p-1.5 rounded transition ${
              activeTool === "shape_circle"
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-slate-700 hover:bg-white"
            }`}
          >
            <Circle className="w-3.5 h-3.5" />
          </button>

          {/* 8. Line */}
          <button
            onClick={() => setActiveTool("shape_line")}
            title="Line"
            className={`p-1.5 rounded transition ${
              activeTool === "shape_line"
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-slate-700 hover:bg-white"
            }`}
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          {/* 9. Arrow */}
          <button
            onClick={() => setActiveTool("shape_arrow")}
            title="Arrow"
            className={`p-1.5 rounded transition ${
              activeTool === "shape_arrow"
                ? "bg-blue-600 text-white shadow-2xs"
                : "text-slate-700 hover:bg-white"
            }`}
          >
            <MoveRight className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-slate-300 mx-0.5" />

          {/* 10. Delete */}
          <button
            onClick={deleteSelected}
            disabled={!selectedElementId}
            title="Delete Selected Element (Del)"
            className="p-1.5 rounded text-slate-700 hover:text-red-600 hover:bg-white disabled:opacity-30 disabled:hover:text-slate-700 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* 11. Copy / Paste Formatting */}
          <button
            onClick={copyFormatting}
            disabled={!selectedElementId && !selectedTokenId}
            title="Copy Formatting"
            className="p-1.5 rounded text-slate-700 hover:bg-white disabled:opacity-30 transition"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-slate-300 mx-0.5" />

          {/* 12. Undo & Redo */}
          <button
            onClick={() => undo()}
            disabled={!historyState.canUndo}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded text-slate-700 hover:bg-white disabled:opacity-30 transition"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => redo()}
            disabled={!historyState.canRedo}
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded text-slate-700 hover:bg-white disabled:opacity-30 transition"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Page Nav & Export Action */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Page Nav */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/80 text-xs">
            <button
              onClick={() => prevPage()}
              disabled={currentPageNumber <= 1}
              className="p-1 text-slate-700 hover:bg-white rounded disabled:opacity-30"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 font-mono text-[11px] text-slate-700">
              {currentPageNumber} / {totalPages}
            </span>
            <button
              onClick={() => nextPage()}
              disabled={currentPageNumber >= totalPages}
              className="p-1 text-slate-700 hover:bg-white rounded disabled:opacity-30"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center space-x-1.5 shadow-sm transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? "Exporting..." : "Export PDF"}</span>
          </button>

          <button
            onClick={closeDocument}
            title="Close document"
            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Style Matching Banner when an extracted text token is selected */}
      {selectedToken && tokenFont && (
        <div className="bg-blue-50/80 border-t border-b border-blue-200/80 px-4 py-1.5 flex items-center justify-between text-xs text-blue-900 animate-in fade-in">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>
              Selected Document Text: <strong>&ldquo;{selectedToken.text.substring(0, 25)}&rdquo;</strong> (Font:{" "}
              <strong>{tokenFont.family}</strong>, Size: <strong>{selectedToken.fontSize}pt</strong>, Color:{" "}
              <strong>{selectedToken.colorHex}</strong>)
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => openTextEditorForToken(selectedToken.id)}
              className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition flex items-center space-x-1"
            >
              <Pencil className="w-3 h-3" />
              <span>Modify Text</span>
            </button>
            <button
              onClick={async () => {
                const inherited = inheritStyleFromSelectedToken();
                if (inherited) {
                  setActiveTool("add_text");
                }
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition flex items-center space-x-1"
            >
              <Sparkles className="w-3 h-3" />
              <span>Inherit Formatting & Add Text</span>
            </button>
          </div>
        </div>
      )}

      {/* Secondary Text & Shape Formatting Bar */}
      <div className="h-10 border-t border-slate-100 bg-slate-50/60 px-4 flex items-center space-x-3 text-xs overflow-x-auto">
        {/* Font Family */}
        <div className="flex items-center space-x-1">
          <span className="text-[10px] text-slate-400 font-medium">Font:</span>
          <select
            value={activeFormatting.fontFamily}
            onChange={(e) => setActiveFormatting({ fontFamily: e.target.value })}
            className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-700 font-medium cursor-pointer"
          >
            <option value="Helvetica">Helvetica</option>
            <option value="Times">Times Roman</option>
            <option value="Courier">Courier</option>
          </select>
        </div>

        {/* Font Size */}
        <div className="flex items-center space-x-1">
          <span className="text-[10px] text-slate-400 font-medium">Size:</span>
          <input
            type="number"
            min={6}
            max={120}
            value={activeFormatting.fontSize}
            onChange={(e) => setActiveFormatting({ fontSize: parseInt(e.target.value, 10) || 12 })}
            className="w-12 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-700 font-mono text-center"
          />
        </div>

        {/* Bold / Italic */}
        <div className="flex items-center bg-white rounded border border-slate-200 p-0.5 space-x-0.5">
          <button
            onClick={() =>
              setActiveFormatting({
                fontWeight: activeFormatting.fontWeight === "bold" ? "normal" : "bold",
              })
            }
            title="Bold"
            className={`p-1 rounded ${
              activeFormatting.fontWeight === "bold" ? "bg-slate-200 text-slate-900" : "text-slate-600"
            }`}
          >
            <Bold className="w-3 h-3" />
          </button>
          <button
            onClick={() =>
              setActiveFormatting({
                fontStyle: activeFormatting.fontStyle === "italic" ? "normal" : "italic",
              })
            }
            title="Italic"
            className={`p-1 rounded ${
              activeFormatting.fontStyle === "italic" ? "bg-slate-200 text-slate-900" : "text-slate-600"
            }`}
          >
            <Italic className="w-3 h-3" />
          </button>
        </div>

        {/* Text Color */}
        <div className="flex items-center space-x-1">
          <span className="text-[10px] text-slate-400 font-medium">Color:</span>
          <input
            type="color"
            value={activeFormatting.fontColorHex}
            onChange={(e) => setActiveFormatting({ fontColorHex: e.target.value })}
            className="w-5 h-5 rounded border border-slate-300 cursor-pointer p-0 bg-transparent"
          />
        </div>

        {/* Alignment */}
        <div className="flex items-center bg-white rounded border border-slate-200 p-0.5 space-x-0.5">
          <button
            onClick={() => setActiveFormatting({ alignment: "left" })}
            className={`p-1 rounded ${
              activeFormatting.alignment === "left" ? "bg-slate-200 text-slate-900" : "text-slate-600"
            }`}
          >
            <AlignLeft className="w-3 h-3" />
          </button>
          <button
            onClick={() => setActiveFormatting({ alignment: "center" })}
            className={`p-1 rounded ${
              activeFormatting.alignment === "center" ? "bg-slate-200 text-slate-900" : "text-slate-600"
            }`}
          >
            <AlignCenter className="w-3 h-3" />
          </button>
          <button
            onClick={() => setActiveFormatting({ alignment: "right" })}
            className={`p-1 rounded ${
              activeFormatting.alignment === "right" ? "bg-slate-200 text-slate-900" : "text-slate-600"
            }`}
          >
            <AlignRight className="w-3 h-3" />
          </button>
        </div>

        {/* Opacity */}
        <div className="flex items-center space-x-1.5">
          <span className="text-[10px] text-slate-400 font-medium">Opacity:</span>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={activeFormatting.opacity}
            onChange={(e) => setActiveFormatting({ opacity: parseFloat(e.target.value) })}
            className="w-16 accent-blue-600 cursor-pointer"
          />
          <span className="text-[10px] font-mono text-slate-500">
            {Math.round(activeFormatting.opacity * 100)}%
          </span>
        </div>

        {/* Stroke / Fill for Shapes */}
        <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
          <div className="flex items-center space-x-1">
            <span className="text-[10px] text-slate-400 font-medium">Stroke:</span>
            <input
              type="color"
              value={activeFormatting.strokeColorHex || "#2563eb"}
              onChange={(e) => setActiveFormatting({ strokeColorHex: e.target.value })}
              className="w-5 h-5 rounded border border-slate-300 cursor-pointer p-0 bg-transparent"
            />
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-[10px] text-slate-400 font-medium">Fill:</span>
            <input
              type="color"
              value={activeFormatting.fillColorHex || "#3b82f6"}
              onChange={(e) => setActiveFormatting({ fillColorHex: e.target.value })}
              className="w-5 h-5 rounded border border-slate-300 cursor-pointer p-0 bg-transparent"
            />
          </div>
        </div>

        {/* Paste Formatting Shortcut */}
        {copiedFormatting && (
          <button
            onClick={pasteFormatting}
            disabled={!selectedElementId}
            className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 disabled:opacity-40 text-[10px] font-medium transition"
          >
            Paste Copied Style
          </button>
        )}
      </div>
    </header>
  );
};
