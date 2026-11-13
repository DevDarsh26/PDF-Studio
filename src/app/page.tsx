"use client";

import React, { useEffect, useRef } from "react";
import { useEditorStore } from "@/store/editor-store";
import { UploadHomepage } from "@/components/upload/UploadHomepage";
import { TopToolbar } from "@/components/editor/TopToolbar";
import { ThumbnailSidebar } from "@/components/editor/ThumbnailSidebar";
import { PdfCanvasViewport } from "@/components/editor/PdfCanvasViewport";
import { StatusBar } from "@/components/editor/StatusBar";
import { PasswordModal } from "@/components/modals/PasswordModal";
import { TextEditModal } from "@/components/modals/TextEditModal";

import { DocumentAnalysisPanel } from "@/components/editor/DocumentAnalysisPanel";

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
  } = useEditorStore();

  const viewportContainerRef = useRef<HTMLDivElement>(null);

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
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [metadata, nextPage, prevPage, zoomIn, zoomOut, setZoomScale, rotateViewing]);

  const hasDocument = Boolean(rawBytes && metadata);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 text-slate-800">
      {/* Modals */}
      <PasswordModal />
      <TextEditModal />

      {!hasDocument ? (
        <UploadHomepage />
      ) : (
        <>
          {/* Top Application Toolbar */}
          <TopToolbar containerRef={viewportContainerRef} />

          {/* Main Workspace: Left Thumbnails + Center Canvas + Right Analysis Panel */}
          <div className="flex flex-1 overflow-hidden relative">
            <ThumbnailSidebar />
            <PdfCanvasViewport containerRef={viewportContainerRef} />
            <DocumentAnalysisPanel />
          </div>

          {/* Bottom Status Bar */}
          <StatusBar />
        </>
      )}
    </div>
  );
}
