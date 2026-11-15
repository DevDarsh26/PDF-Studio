"use client";

import React, { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import { useHistoryStore } from "@/store/history-store";
import { UploadHomepage } from "@/components/upload/UploadHomepage";
import { ScrollytellingLandingPage } from "@/components/landing/ScrollytellingLandingPage";
import { TopToolbar } from "@/components/editor/TopToolbar";
import { EditorToolRail } from "@/components/editor/EditorToolRail";
import { ThumbnailSidebar } from "@/components/editor/ThumbnailSidebar";
import { PdfCanvasViewport } from "@/components/editor/PdfCanvasViewport";
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
    setActiveTool,
  } = useEditorStore();

  const viewportContainerRef = useRef<HTMLDivElement>(null);
  const [isCheckingSession, setIsCheckingSession] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<"landing" | "dashboard">("landing");

  // Sync view with URL hash or search params
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.hash === "#dashboard" || window.location.search.includes("dashboard")) {
        setCurrentView("dashboard");
      }
      const handleHashChange = () => {
        if (window.location.hash === "#dashboard") {
          setCurrentView("dashboard");
        } else if (!window.location.hash) {
          setCurrentView("landing");
        }
      };
      window.addEventListener("hashchange", handleHashChange);
      return () => window.removeEventListener("hashchange", handleHashChange);
    }
  }, []);

  // Responsive drawer visibility for mobile/tablet screens
  const [mobileShowThumbnails, setMobileShowThumbnails] = useState(false);
  const [mobileShowAnalysis, setMobileShowAnalysis] = useState(false);

  // Restore previous editing session on initial mount so reload NEVER loses work or redirects to home
  useEffect(() => {
    let isCancelled = false;

    // Trigger splash only after client mount to prevent SSR hydration mismatch
    try {
      if (typeof window !== "undefined" && localStorage.getItem("pdf_has_session") === "1" && !useEditorStore.getState().rawBytes) {
        setIsCheckingSession(true);
      }
    } catch {
      // Ignore localStorage access restrictions
    }

    // Safety timeout: never let splash screen stay stuck for more than 500ms under any circumstances
    const safetyTimer = setTimeout(() => {
      if (!isCancelled) {
        setIsCheckingSession(false);
      }
    }, 500);

    const initSession = async () => {
      try {
        if (!useEditorStore.getState().rawBytes) {
          await restoreSession();
        }
      } catch (e) {
        console.warn("Session restore error:", e);
      } finally {
        clearTimeout(safetyTimer);
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
      clearTimeout(safetyTimer);
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

      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "h") {
        setActiveTool("grab");
        return;
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "v") {
        setActiveTool("select");
        return;
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "e") {
        setActiveTool("edit_text");
        return;
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "t") {
        setActiveTool("add_text");
        return;
      }

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
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-[#f4f1ea] text-[#0d1b3d] select-none">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#2447f5] flex items-center justify-center font-black text-sm text-white shadow-lg shadow-blue-500/30">
            PS
          </div>
          <span className="serif text-2xl font-bold tracking-tight text-[#0d1b3d]">PDF Suite</span>
        </div>
        <div className="flex items-center space-x-2 text-[#4a5168] text-xs">
          <Loader2 className="w-4 h-4 text-[#2447f5] animate-spin" />
          <span>Restoring document workspace...</span>
        </div>
        <button
          onClick={() => setIsCheckingSession(false)}
          className="mt-4 px-3.5 py-1.5 text-xs text-[#0d1b3d] hover:bg-[#ffd84d] bg-[#fbf9f4] border border-[#d8d4c8] rounded-full transition-colors cursor-pointer font-semibold"
        >
          Skip to home &rarr;
        </button>
      </div>
    );
  }

  return (
    <div className="editor-app-shell flex flex-col h-screen w-screen overflow-hidden text-slate-800 antialiased select-none">
      {/* Modals & Toasts */}
      <PasswordModal />
      <TextEditModal />
      <ExportModal />
      <HyperlinkModal />
      <PageManagerModal />
      <Toast />

      {!hasDocument ? (
        currentView === "landing" ? (
          <ScrollytellingLandingPage
            onGoToDashboard={() => {
              setCurrentView("dashboard");
              if (typeof window !== "undefined") {
                window.location.hash = "dashboard";
              }
            }}
          />
        ) : (
          <UploadHomepage
            onBackToLanding={() => {
              setCurrentView("landing");
              if (typeof window !== "undefined") {
                window.location.hash = "";
              }
            }}
          />
        )
      ) : (
        <>
          {/* Top Application Header Bar */}
          <TopToolbar containerRef={viewportContainerRef} />

          {/* Main Workspace: 72px Tool Rail + 172px Thumbnails + Center Viewport + 310px Properties Panel */}
          <div className="flex flex-1 overflow-hidden relative min-h-0 bg-[#f4f1ea]">
            {/* 72px Left Tool Rail */}
            <EditorToolRail />

            {/* Left Thumbnail Sidebar (172px) */}
            {showThumbnails && (
              <div
                className={`${
                  mobileShowThumbnails ? "fixed inset-y-0 left-[72px] z-30 flex shadow-2xl" : "hidden md:flex"
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

            {/* Right Style & Document Analysis / Properties Panel (310px) */}
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
            <div className="absolute bottom-16 left-20 z-20 flex md:hidden items-center space-x-2">
              <button
                onClick={() => setMobileShowThumbnails((v) => !v)}
                className="px-3.5 py-1.5 bg-[#fbf9f4] border border-[#d8d4c8] rounded-full shadow-md text-xs font-semibold text-[#0d1b3d] flex items-center space-x-1.5"
              >
                <LayoutList className="w-3.5 h-3.5 text-[#2447f5]" />
                <span>Pages</span>
              </button>
            </div>

            <div className="absolute bottom-16 right-4 z-20 flex lg:hidden items-center space-x-2">
              <button
                onClick={() => setMobileShowAnalysis((v) => !v)}
                className="px-3.5 py-1.5 bg-[#fbf9f4] border border-[#d8d4c8] rounded-full shadow-md text-xs font-semibold text-[#0d1b3d] flex items-center space-x-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#2447f5]" />
                <span>Inspector</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
