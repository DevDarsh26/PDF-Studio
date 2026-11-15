"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Maximize2,
} from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import { InteractiveOverlay } from "./InteractiveOverlay";

interface PdfCanvasViewportProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const PdfCanvasViewport: React.FC<PdfCanvasViewportProps> = ({ containerRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    adapter,
    currentPageNumber,
    zoomScale,
    viewRotation,
    pageInfos,
    activeTool,
    nextPage,
    prevPage,
    zoomIn,
    zoomOut,
    fitToWidth,
  } = useEditorStore();

  const [isRendering, setIsRendering] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderNonce, setRenderNonce] = useState(0);

  // Spacebar hold quick-grab pan support
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.code === "Space" && !e.repeat) {
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const isGrabActive = activeTool === "grab" || isSpacePressed;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isGrabActive || !containerRef.current) return;
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: containerRef.current.scrollLeft,
      scrollTop: containerRef.current.scrollTop,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!panStartRef.current || !containerRef.current) return;
      const dx = moveEvent.clientX - panStartRef.current.x;
      const dy = moveEvent.clientY - panStartRef.current.y;
      containerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
      containerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
    };

    const handlePointerUp = () => {
      setIsPanning(false);
      panStartRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  useEffect(() => {
    let isCancelled = false;
    const canvas = canvasRef.current;
    if (!canvas || pageInfos.length === 0) return;

    setIsRendering(true);

    const render = async () => {
      try {
        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        await adapter.renderPage({
          pageNumber: currentPageNumber,
          scale: zoomScale,
          rotation: viewRotation,
          canvas,
          devicePixelRatio: dpr,
        });

        if (!isCancelled) {
          setIsRendering(false);
          setRenderError(null);
        }
      } catch (err: any) {
        if (!isCancelled) {
          if (
            err?.name === "RenderingCancelledException" ||
            err?.message?.includes("Rendering cancelled")
          ) {
            return;
          }
          if (err?.message?.includes("Cannot use the same canvas")) {
            setTimeout(() => {
              if (!isCancelled) setRenderNonce((n) => n + 1);
            }, 80);
            return;
          }
          setRenderError(err?.message || "Failed to render PDF page.");
          setIsRendering(false);
        }
      }
    };

    render();

    return () => {
      isCancelled = true;
      if (canvas) {
        adapter.cancelRender?.(canvas);
      }
    };
  }, [adapter, currentPageNumber, zoomScale, viewRotation, pageInfos, renderNonce]);

  const currentPage = pageInfos[currentPageNumber - 1];

  return (
    <main
      ref={containerRef}
      onPointerDown={handlePointerDown}
      className={`editor-workbench flex-1 flex flex-col items-center justify-start p-5 sm:p-8 lg:p-10 overflow-auto relative select-none ${
        isGrabActive
          ? isPanning
            ? "cursor-grabbing"
            : "cursor-grab"
          : ""
      }`}
      style={{
        backgroundColor: "#f4f1ea",
        backgroundImage: "radial-gradient(#d8d4c8 1.2px, transparent 1.2px)",
        backgroundSize: "26px 26px",
      }}
    >
      {renderError ? (
        <div className="my-auto max-w-md bg-[#fbf9f4] border border-red-300 rounded-2xl p-6 shadow-sm text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-[#0d1b3d] mb-1">Rendering Notice</h4>
          <p className="text-xs text-[#4a5168] mb-4">{renderError}</p>
          <div className="flex items-center justify-center space-x-2">
            <button
              onClick={() => {
                setRenderError(null);
                setRenderNonce((n) => n + 1);
              }}
              className="px-4 py-1.5 text-xs font-semibold bg-[#2447f5] hover:bg-[#0d1b3d] text-white rounded-full shadow-sm transition"
            >
              Retry Render
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 text-xs font-medium bg-[#e7e3d8] hover:bg-[#d9d6cc] rounded-full text-[#0d1b3d] transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      ) : (
        <div className="relative my-auto flex flex-col items-center pb-16">
          {/* Canvas Wrapper with White Paper Drop Shadow */}
          <div
            className="editor-paper relative bg-white overflow-hidden transition-[box-shadow,transform] duration-150"
            style={{
              borderRadius: "6px",
              boxShadow: "0 40px 80px -30px rgba(13, 27, 61, 0.35)",
            }}
          >
            <canvas ref={canvasRef} className="block" />

            {/* Interactive Drawing & Selection Overlay Layer */}
            {currentPage && (
              <InteractiveOverlay
                pageWidth={currentPage.dimensions.width}
                pageHeight={currentPage.dimensions.height}
                scale={zoomScale}
                containerRef={containerRef}
                isSpacePressed={isSpacePressed}
              />
            )}

            {/* Subtle Loading Overlay for smooth zoom transitions */}
            {isRendering && (
              <div className="absolute inset-0 bg-white/40 backdrop-blur-2xs flex items-center justify-center transition pointer-events-none z-20">
                <div className="flex items-center space-x-2 px-3.5 py-1.5 bg-[#fbf9f4]/95 rounded-full shadow-md border border-[#d8d4c8] text-xs font-medium text-[#0d1b3d]">
                  <Loader2 className="w-3.5 h-3.5 text-[#2447f5] animate-spin" />
                  <span>Rendering...</span>
                </div>
              </div>
            )}
          </div>

          {/* Floating Page Footnote */}
          {currentPage && (
            <div className="editor-page-meta mt-3 text-[11px] font-mono text-[#4a5168] flex items-center space-x-2">
              <span>
                Page {currentPageNumber} of {pageInfos.length}
              </span>
              <span>•</span>
              <span>
                {Math.round(currentPage.dimensions.width)} × {Math.round(currentPage.dimensions.height)} pt
              </span>
              {viewRotation !== 0 && (
                <>
                  <span>•</span>
                  <span>Rotated {viewRotation}°</span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Floating Bottom Navigation Pill (Mockup Style) */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-[#0d1b3d] text-[#f4f1ea] rounded-full px-3 py-1.5 flex items-center gap-1.5 shadow-2xl z-30 select-none border border-slate-700/50">
        <button
          onClick={prevPage}
          disabled={currentPageNumber <= 1}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition text-white"
          title="Previous Page"
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <b className="text-xs sm:text-sm px-2 font-mono whitespace-nowrap">
          {currentPageNumber} / {pageInfos.length}
        </b>

        <button
          onClick={nextPage}
          disabled={currentPageNumber >= pageInfos.length}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 disabled:opacity-30 disabled:hover:bg-transparent transition text-white"
          title="Next Page"
          aria-label="Next Page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <span className="w-px h-5 bg-[#2a3a66] mx-1" />

        <button
          onClick={zoomOut}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 transition text-white"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>

        <button
          onClick={() => fitToWidth(containerRef.current?.clientWidth || 800)}
          className="text-xs sm:text-sm font-mono px-1.5 hover:text-[#ffd84d] transition"
          title="Click to Fit Width"
        >
          {Math.round(zoomScale * 100)}%
        </button>

        <button
          onClick={zoomIn}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/15 transition text-white"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </main>
  );
};
