"use client";

import React from "react";
import { ShieldCheck, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { useEditorStore } from "@/store/editor-store";

export const StatusBar: React.FC = () => {
  const {
    metadata,
    pageInfos,
    currentPageNumber,
    zoomScale,
    viewRotation,
    engineType,
    setZoomScale,
    zoomIn,
    zoomOut,
  } = useEditorStore();

  const currentPage = pageInfos[currentPageNumber - 1];

  return (
    <footer className="h-7 border-t border-slate-200 bg-white px-2 sm:px-4 flex items-center justify-between text-[11px] text-slate-500 select-none z-20 shrink-0">
      {/* Left Metadata */}
      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
        <span className="font-medium text-slate-700 whitespace-nowrap">
          Page {currentPageNumber} of {pageInfos.length}
        </span>
        {/* Page dimensions — hidden on mobile */}
        {currentPage && (
          <span className="hidden sm:inline-flex items-center space-x-1">
            <span className="text-slate-300">•</span>
            <span className="font-mono text-slate-500">
              {Math.round(currentPage.dimensions.width)} ×{" "}
              {Math.round(currentPage.dimensions.height)} pt
            </span>
          </span>
        )}
        {/* View rotation — hidden on small screens */}
        {viewRotation !== 0 && (
          <span className="hidden md:inline-flex items-center space-x-1">
            <span className="text-slate-300">•</span>
            <span className="flex items-center space-x-1 text-blue-600 font-medium">
              <RotateCw className="w-3 h-3" />
              <span>{viewRotation}° View</span>
            </span>
          </span>
        )}
      </div>

      {/* Center Privacy Badge — hidden on mobile */}
      <div className="hidden lg:flex items-center space-x-1 text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
        <ShieldCheck className="w-3 h-3" />
        <span>Local Browser Sandbox • Zero Network Calls</span>
      </div>

      {/* Right Zoom Controls */}
      <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
        <button
          onClick={zoomOut}
          disabled={zoomScale <= 0.25}
          className="hover:text-slate-900 disabled:opacity-30 p-0.5"
          title="Zoom Out"
        >
          <ZoomOut className="w-3 h-3" />
        </button>

        <button
          onClick={() => setZoomScale(1.0)}
          title="Reset zoom to 100%"
          className="font-mono hover:text-blue-600 font-medium transition min-w-[34px] text-center"
        >
          {Math.round(zoomScale * 100)}%
        </button>

        <button
          onClick={zoomIn}
          disabled={zoomScale >= 4.0}
          className="hover:text-slate-900 disabled:opacity-30 p-0.5"
          title="Zoom In"
        >
          <ZoomIn className="w-3 h-3" />
        </button>

        {/* Engine type — only on larger screens */}
        <span className="hidden sm:inline-flex items-center">
          <span className="text-slate-300 ml-1">•</span>
          <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider ml-1">
            {engineType}
          </span>
        </span>
      </div>
    </footer>
  );
};
