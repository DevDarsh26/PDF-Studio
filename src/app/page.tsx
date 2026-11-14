"use client";

import React, { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import { UploadHomepage } from "@/components/upload/UploadHomepage";
import { TopToolbar } from "@/components/editor/TopToolbar";
import { ThumbnailSidebar } from "@/components/editor/ThumbnailSidebar";
import { PdfCanvasViewport } from "@/components/editor/PdfCanvasViewport";
import { StatusBar } from "@/components/editor/StatusBar";
import { PasswordModal } from "@/components/modals/PasswordModal";
import { TextEditModal } from "@/components/modals/TextEditModal";
import { ExportModal } from "@/components/modals/ExportModal";
import { HyperlinkModal } from "@/components/modals/HyperlinkModal";
import { PageManagerModal } from "@/components/modals/PageManagerModal";
import { Toast } from "@/components/ui/Toast";
import { DocumentAnalysisPanel } from "@/components/editor/DocumentAnalysisPanel";
import { LayoutList, Sparkles } from "lucide-react";

export default function Home() {
  const {
    rawBytes,
    metadata,
    nextPage,
    prevPage,
    zoomIn,
    zoomOut,
    setZoomScale,
    rotateViewing,
    copySelectedTextToClipboard,
    restoreSession,
  } = useEditorStore();

  const viewportContainerRef = useRef<HTMLDivElement>(null);
  const hasAttemptedRestore = useRef(false);

  // Responsive drawer visibility for mobile/tablet screens
  const [mobileShowThumbnails, setMobileShowThumbnails] = useState(false);
  const [mobileShowAnalysis, setMobileShowAnalysis] = useState(false);

  // Restore previous editing session on initial mount so reload NEVER loses work
  useEffect(() => {
    if (!hasAttemptedRestore.current && !rawBytes) {
      hasAttemptedRestore.current = true;
      restoreSession();
    }
  }, [rawBytes, restoreSession]);

  // Global keyboard shortcuts for PDF navigation and viewing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (!metadata) return;

      if (e.key === "PageDown" || (e.key === "ArrowRight" && !e.ctrlKey)) {
        e.preventDefault();
        nextPage();
      } else if (e.key === "PageUp" || (e.key === "ArrowLeft" && !e.ctrlKey)) {
        e.preventDefault();
        prevPage();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        zoomOut();
      } else if (e.key === "0" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setZoomScale(1.0);
      } else if (e.key.toLowerCase() === "r" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        rotateViewing("cw");
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        copySelectedTextToClipboard();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [metadata, nextPage, prevPage, zoomIn, zoomOut, setZoomScale, rotateViewing, copySelectedTextToClipboard]);

  const hasDocument = Boolean(rawBytes && metadata);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 text-slate-800 antialiased select-none">
      {/* Modals & Toasts */}
      <PasswordModal />
      <TextEditModal />
      <ExportModal />
      <HyperlinkModal />
      <PageManagerModal />
      <Toast />

      {!hasDocument ? (
        <UploadHomepage />
      ) : (
        <>
          {/* Top Application Toolbar */}
          <TopToolbar containerRef={viewportContainerRef} />

          {/* Main Workspace: Left Thumbnails + Center Canvas + Right Analysis Panel */}
          <div className="flex flex-1 overflow-hidden relative">
            {/* Left Thumbnail Sidebar: visible on md+ screens or toggled on mobile */}
            <div
              className={`${
                mobileShowThumbnails ? "fixed inset-y-0 left-0 z-30 flex shadow-2xl" : "hidden md:flex"
              }`}
            >
              <ThumbnailSidebar />
            </div>

            {/* Mobile backdrop for sidebar */}
            {mobileShowThumbnails && (
              <div
                onClick={() => setMobileShowThumbnails(false)}
                className="fixed inset-0 z-20 bg-slate-900/40 backdrop-blur-2xs md:hidden"
              />
            )}

            {/* Central Viewport */}
            <PdfCanvasViewport containerRef={viewportContainerRef} />

            {/* Right Style & Document Analysis Panel: visible on lg+ screens or toggled on mobile */}
            <div
              className={`${
                mobileShowAnalysis ? "fixed inset-y-0 right-0 z-30 flex shadow-2xl" : "hidden lg:flex"
              }`}
            >
              <DocumentAnalysisPanel />
            </div>

            {/* Mobile backdrop for analysis panel */}
            {mobileShowAnalysis && (
              <div
                onClick={() => setMobileShowAnalysis(false)}
                className="fixed inset-0 z-20 bg-slate-900/40 backdrop-blur-2xs lg:hidden"
              />
            )}

            {/* Floating Mobile Panel Toggle Buttons (Only on smaller screens) */}
            <div className="absolute bottom-10 left-3 z-20 flex md:hidden items-center space-x-2">
              <button
                onClick={() => setMobileShowThumbnails((v) => !v)}
                className="px-3 py-1.5 bg-white/95 border border-slate-200 rounded-full shadow-md text-xs font-semibold text-slate-700 flex items-center space-x-1.5"
              >
                <LayoutList className="w-3.5 h-3.5 text-blue-600" />
                <span>Pages</span>
              </button>
            </div>

            <div className="absolute bottom-10 right-3 z-20 flex lg:hidden items-center space-x-2">
              <button
                onClick={() => setMobileShowAnalysis((v) => !v)}
                className="px-3 py-1.5 bg-white/95 border border-slate-200 rounded-full shadow-md text-xs font-semibold text-slate-700 flex items-center space-x-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Analysis</span>
              </button>
            </div>
          </div>

          {/* Bottom Status Bar */}
          <StatusBar />
        </>
      )}
    </div>
  );
}
