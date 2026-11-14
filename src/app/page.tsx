"use client";

import React, { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import { useHistoryStore } from "@/store/history-store";
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
import { LayoutList, Sparkles, Loader2 } from "lucide-react";
import { saveDocumentSession } from "@/core/persistence/document-persistence";

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
    showThumbnails,
    showAnalysisPanel,
    toggleThumbnails,
    toggleAnalysisPanel,
  } = useEditorStore();

  const viewportContainerRef = useRef<HTMLDivElement>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Responsive drawer visibility for mobile/tablet screens
  const [mobileShowThumbnails, setMobileShowThumbnails] = useState(false);
  const [mobileShowAnalysis, setMobileShowAnalysis] = useState(false);

  // Restore previous editing session on initial mount so reload NEVER loses work or redirects to home
  useEffect(() => {
    let isCancelled = false;
    const initSession = async () => {
      try {
        if (!useEditorStore.getState().rawBytes) {
          await restoreSession();
        }
      } catch (e) {
        console.warn("Session restore error:", e);
      } finally {
        if (!isCancelled) {
          setIsCheckingSession(false);
        }
      }
    };
    initSession();

    // Flush any pending session state synchronously before unload/refresh
    const handleBeforeUnload = () => {
      const state = useEditorStore.getState();
      if (state.documentName && state.rawBytes) {
        saveDocumentSession({
          documentName: state.documentName,
          rawBytes: state.rawBytes,
          operations: state.operations,
          currentPageNumber: state.currentPageNumber,
          zoomScale: state.zoomScale,
          viewRotation: state.viewRotation,
        });
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      isCancelled = true;
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [restoreSession]);

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
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        const history = useHistoryStore.getState();
        if (history.state.canUndo) {
          history.undo();
          useEditorStore.getState().showToast("Undo");
        }
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")
      ) {
        e.preventDefault();
        const history = useHistoryStore.getState();
        if (history.state.canRedo) {
          history.redo();
          useEditorStore.getState().showToast("Redo");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [metadata, nextPage, prevPage, zoomIn, zoomOut, setZoomScale, rotateViewing, copySelectedTextToClipboard]);

  const hasDocument = Boolean(rawBytes && metadata);

  if (isCheckingSession) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-slate-900 text-white select-none">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black text-sm text-white shadow-lg shadow-blue-500/30">
            PS
          </div>
          <span className="font-bold text-lg tracking-tight text-white">PDF Studio</span>
        </div>
        <div className="flex items-center space-x-2 text-slate-400 text-xs">
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          <span>Restoring document workspace...</span>
        </div>
      </div>
    );
  }

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
            {/* Left Thumbnail Sidebar */}
            {showThumbnails && (
              <div
                className={`${
                  mobileShowThumbnails ? "fixed inset-y-0 left-0 z-30 flex shadow-2xl" : "hidden md:flex"
                } shrink-0 transition-all duration-200`}
              >
                <ThumbnailSidebar />
              </div>
            )}

            {/* Mobile backdrop for sidebar */}
            {mobileShowThumbnails && (
              <div
                onClick={() => setMobileShowThumbnails(false)}
                className="fixed inset-0 z-20 bg-slate-900/40 backdrop-blur-2xs md:hidden"
              />
            )}

            {/* Central Viewport */}
            <PdfCanvasViewport containerRef={viewportContainerRef} />

            {/* Right Style & Document Analysis Panel */}
            {showAnalysisPanel && (
              <div
                className={`${
                  mobileShowAnalysis ? "fixed inset-y-0 right-0 z-30 flex shadow-2xl" : "hidden lg:flex"
                } shrink-0 transition-all duration-200`}
              >
                <DocumentAnalysisPanel />
              </div>
            )}

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
