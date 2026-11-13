"use client";

import React, { useRef, useState } from "react";
import {
  FileText,
  Upload,
  MousePointer,
  Type,
  Image as ImageIcon,
  Square,
  Circle,
  Minus,
  Link as LinkIcon,
  Undo2,
  Redo2,
  Download,
  ZoomIn,
  ZoomOut,
  Eraser,
  EyeOff,
  ShieldAlert,
} from "lucide-react";
import { useEditorStore, EditorTool } from "../store/editor-store";
import { useHistoryStore } from "../store/history-store";

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const {
    metadata,
    pageInfos,
    currentPageNumber,
    zoomScale,
    isLoading,
    loadingProgress,
    errorMessage,
    activeTool,
    engineType,
    loadDocumentBytes,
    setCurrentPage,
    setZoomScale,
    setActiveTool,
    clearError,
  } = useEditorStore();

  const { state: historyState, undo, redo } = useHistoryStore();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      await loadDocumentBytes(buffer);
    } catch {
      // Error handled by store
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      await loadDocumentBytes(buffer);
    } catch {
      // Error handled by store
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-studio-canvas text-studio-text">
      {/* Top Application Bar & Toolbar */}
      <header className="h-14 border-b border-studio-border bg-studio-toolbar px-4 flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 font-bold text-lg text-white">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center font-black text-sm">
              PS
            </div>
            <span>PDF Studio</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700/50 font-mono">
            v1.0 (Foundation)
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-700/40">
            100% Client-Side
          </span>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center space-x-1 bg-studio-sidebar/80 p-1 rounded-lg border border-studio-border">
          <button
            onClick={() => setActiveTool("select")}
            title="Select & Move (V)"
            className={`p-1.5 rounded transition ${
              activeTool === "select" ? "bg-blue-600 text-white" : "hover:bg-studio-border text-gray-300"
            }`}
          >
            <MousePointer className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool("edit_text")}
            title="Edit Existing Text (T)"
            className={`p-1.5 rounded transition ${
              activeTool === "edit_text" ? "bg-blue-600 text-white" : "hover:bg-studio-border text-gray-300"
            }`}
          >
            <Type className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool("whiteout")}
            title="Whiteout (W)"
            className={`p-1.5 rounded transition ${
              activeTool === "whiteout" ? "bg-blue-600 text-white" : "hover:bg-studio-border text-gray-300"
            }`}
          >
            <Eraser className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool("redact")}
            title="Permanent Redaction (R)"
            className={`p-1.5 rounded transition ${
              activeTool === "redact" ? "bg-blue-600 text-white" : "hover:bg-studio-border text-gray-300"
            }`}
          >
            <EyeOff className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-studio-border mx-1" />
          <button
            onClick={() => setActiveTool("shape_rect")}
            title="Draw Rectangle"
            className={`p-1.5 rounded transition ${
              activeTool === "shape_rect" ? "bg-blue-600 text-white" : "hover:bg-studio-border text-gray-300"
            }`}
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool("link")}
            title="Hyperlink Manager"
            className={`p-1.5 rounded transition ${
              activeTool === "link" ? "bg-blue-600 text-white" : "hover:bg-studio-border text-gray-300"
            }`}
          >
            <LinkIcon className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-studio-border mx-1" />
          <button
            onClick={() => undo()}
            disabled={!historyState.canUndo}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded hover:bg-studio-border text-gray-300 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => redo()}
            disabled={!historyState.canRedo}
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded hover:bg-studio-border text-gray-300 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Export & Document actions */}
        <div className="flex items-center space-x-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,application/pdf"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs font-medium rounded bg-studio-sidebar border border-studio-border hover:bg-studio-border flex items-center space-x-1.5 transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Open PDF</span>
          </button>
          <button
            disabled={!metadata}
            className="px-3 py-1.5 text-xs font-medium rounded bg-blue-600 hover:bg-blue-500 text-white flex items-center space-x-1.5 disabled:opacity-40 disabled:hover:bg-blue-600 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Sidebar: Pages & Navigation */}
        <aside className="w-56 border-r border-studio-border bg-studio-sidebar flex flex-col">
          <div className="p-3 border-b border-studio-border text-xs font-semibold text-gray-400 uppercase tracking-wider flex justify-between items-center">
            <span>Pages ({pageInfos.length})</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {pageInfos.length === 0 ? (
              <div className="text-center py-10 text-xs text-studio-text-muted">
                No document loaded
              </div>
            ) : (
              pageInfos.map((info) => (
                <div
                  key={info.pageNumber}
                  onClick={() => setCurrentPage(info.pageNumber)}
                  className={`p-2 rounded border cursor-pointer transition flex flex-col items-center ${
                    currentPageNumber === info.pageNumber
                      ? "border-blue-500 bg-blue-950/30"
                      : "border-studio-border hover:border-gray-500 bg-studio-toolbar"
                  }`}
                >
                  <div className="w-28 h-36 bg-white/10 rounded flex items-center justify-center text-xs text-gray-400 border border-white/5 shadow-inner">
                    Page {info.pageNumber}
                  </div>
                  <span className="text-[11px] mt-1 text-gray-400">
                    {Math.round(info.dimensions.width)} × {Math.round(info.dimensions.height)} pt
                  </span>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Center Canvas Area */}
        <main
          className="flex-1 bg-studio-canvas flex flex-col items-center justify-center p-6 overflow-auto relative"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {errorMessage && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-950/80 border border-red-700 text-red-200 px-4 py-2 rounded-lg text-xs flex items-center space-x-2 z-20 shadow-lg">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>{errorMessage}</span>
              <button onClick={clearError} className="ml-2 font-bold">✕</button>
            </div>
          )}

          {!metadata ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`max-w-lg w-full border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition text-center ${
                isDragging
                  ? "border-blue-500 bg-blue-950/20"
                  : "border-studio-border hover:border-blue-500/50 bg-studio-toolbar/40"
              }`}
            >
              <div className="w-16 h-16 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mb-4 text-blue-400">
                <FileText className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-1">
                Drop your PDF here, or <span className="text-blue-400">browse</span>
              </h2>
              <p className="text-xs text-studio-text-muted mb-4 max-w-sm">
                100% Client-side. Your document never leaves your browser.
                Supports high-accuracy text editing, redaction, and hyperlink preservation.
              </p>
              <div className="flex items-center space-x-2 text-[11px] text-gray-400">
                <span>PDF 1.0 – 2.0</span>
                <span>•</span>
                <span>Zero Server Uploads</span>
                <span>•</span>
                <span>Immutable Pipeline</span>
              </div>
            </div>
          ) : (
            <div className="relative border border-studio-border rounded shadow-2xl bg-white text-black p-8 min-w-[500px] min-h-[700px] flex items-center justify-center">
              <div className="text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <h3 className="font-semibold text-gray-800">
                  {metadata.title || "Document"} (Page {currentPageNumber})
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Rendering viewport ready (Scale: {Math.round(zoomScale * 100)}%)
                </p>
              </div>
            </div>
          )}
        </main>

        {/* Right Properties Panel */}
        <aside className="w-64 border-l border-studio-border bg-studio-sidebar flex flex-col">
          <div className="p-3 border-b border-studio-border text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Properties & Inspection
          </div>
          <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
            {metadata ? (
              <div className="space-y-3">
                <div>
                  <span className="text-gray-400 block text-[11px]">PDF Version</span>
                  <span className="font-mono text-gray-200">v{metadata.pdfVersion}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">File Size</span>
                  <span className="font-mono text-gray-200">
                    {(metadata.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">Page Count</span>
                  <span className="font-mono text-gray-200">{metadata.pageCount} pages</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[11px]">Engine Adapter</span>
                  <span className="font-mono text-blue-400">{engineType}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-studio-text-muted">
                Inspect fonts, colors, and layout blocks once a document is loaded.
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Bottom Status Bar */}
      <footer className="h-7 border-t border-studio-border bg-studio-toolbar px-4 flex items-center justify-between text-[11px] text-gray-400">
        <div className="flex items-center space-x-4">
          <span>
            Page {metadata ? `${currentPageNumber} of ${pageInfos.length}` : "—"}
          </span>
          <span>•</span>
          <span>Engine: {engineType.toUpperCase()}</span>
          <span>•</span>
          <span>Security: Local Sandbox (Zero Network)</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setZoomScale(zoomScale - 0.1)}
            className="hover:text-white p-0.5"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono">{Math.round(zoomScale * 100)}%</span>
          <button
            onClick={() => setZoomScale(zoomScale + 0.1)}
            className="hover:text-white p-0.5"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>
    </div>
  );
}
