"use client";

import React, { useRef } from "react";
import {
  FileText,
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
  EyeOff,
  Square,
  Link as LinkIcon,
  Undo2,
  Redo2,
  Download,
} from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import { useHistoryStore } from "@/store/history-store";

interface TopToolbarProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({ containerRef }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    documentName,
    metadata,
    pageInfos,
    currentPageNumber,
    zoomScale,
    viewRotation,
    activeTool,
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
  } = useEditorStore();

  const { state: historyState, undo, redo } = useHistoryStore();

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

  const handleFitWidth = () => {
    if (containerRef.current) {
      fitToWidth(containerRef.current.clientWidth);
    }
  };

  const handleFitPage = () => {
    if (containerRef.current) {
      fitToPage(containerRef.current.clientWidth, containerRef.current.clientHeight);
    }
  };

  const totalPages = pageInfos.length;

  return (
    <header className="h-14 border-b border-slate-200 bg-white px-4 flex items-center justify-between z-20 shadow-2xs select-none">
      {/* Brand & Document Name */}
      <div className="flex items-center space-x-3 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-sm text-white shadow-sm">
            PS
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-sm text-slate-900 tracking-tight">PDF Studio</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                <ShieldCheck className="w-3 h-3" />
                <span>Local</span>
              </span>
            </div>
            {documentName && (
              <span className="text-[11px] text-slate-500 font-medium truncate max-w-[180px] block" title={documentName}>
                {documentName}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Central Controls: Page Navigation & Zoom & Rotation */}
      <div className="flex items-center space-x-2">
        {/* Page Navigation */}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/80">
          <button
            onClick={() => prevPage()}
            disabled={currentPageNumber <= 1}
            title="Previous Page (PageUp)"
            className="p-1 rounded text-slate-700 hover:bg-white hover:shadow-2xs disabled:opacity-30 disabled:hover:bg-transparent transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center px-2 space-x-1 text-xs font-medium text-slate-700">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPageNumber}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) setCurrentPage(val);
              }}
              className="w-8 text-center bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none font-mono"
            />
            <span className="text-slate-400 font-normal">/</span>
            <span className="font-mono text-slate-500">{totalPages}</span>
          </div>

          <button
            onClick={() => nextPage()}
            disabled={currentPageNumber >= totalPages}
            title="Next Page (PageDown)"
            className="p-1 rounded text-slate-700 hover:bg-white hover:shadow-2xs disabled:opacity-30 disabled:hover:bg-transparent transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-slate-200 mx-1 hidden md:block" />

        {/* Zoom Controls */}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/80">
          <button
            onClick={zoomOut}
            disabled={zoomScale <= 0.25}
            title="Zoom Out (-)"
            className="p-1 rounded text-slate-700 hover:bg-white hover:shadow-2xs disabled:opacity-30 disabled:hover:bg-transparent transition"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <select
            value={Math.round(zoomScale * 100)}
            onChange={(e) => setZoomScale(parseInt(e.target.value, 10) / 100)}
            className="bg-transparent text-xs font-mono font-medium text-slate-700 px-1.5 focus:outline-none cursor-pointer"
          >
            <option value="50">50%</option>
            <option value="75">75%</option>
            <option value="100">100%</option>
            <option value="125">125%</option>
            <option value="150">150%</option>
            <option value="200">200%</option>
            <option value="300">300%</option>
          </select>

          <button
            onClick={zoomIn}
            disabled={zoomScale >= 4.0}
            title="Zoom In (+)"
            className="p-1 rounded text-slate-700 hover:bg-white hover:shadow-2xs disabled:opacity-30 disabled:hover:bg-transparent transition"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Fit Controls */}
        <div className="hidden lg:flex items-center space-x-1">
          <button
            onClick={handleFitWidth}
            title="Fit to Width"
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/60 transition"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleFitPage}
            title="Fit to Page"
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/60 transition"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Rotate View */}
        <button
          onClick={() => rotateViewing("cw")}
          title={`Rotate View 90° (Current: ${viewRotation}°)`}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/60 transition relative"
        >
          <RotateCw className="w-3.5 h-3.5" />
          {viewRotation !== 0 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-600 rounded-full" />
          )}
        </button>
      </div>

      {/* Right Actions: Open, Close */}
      <div className="flex items-center space-x-2 shrink-0">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,application/pdf"
          className="hidden"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          title="Open another PDF"
          className="px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition flex items-center space-x-1"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Open</span>
        </button>

        <button
          onClick={closeDocument}
          title="Close current document"
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

