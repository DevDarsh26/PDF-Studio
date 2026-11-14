"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
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

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isGrabActive) return;
    if (e.button !== 0 && e.button !== 1) return;
    const container = containerRef.current;
    if (!container) return;

    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
    };
    setIsPanning(true);
  };

  useEffect(() => {
    if (!isPanning) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!panStartRef.current || !containerRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      containerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
      containerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
    };

    const onPointerUp = () => {
      setIsPanning(false);
      panStartRef.current = null;
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [isPanning, containerRef]);

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
    >
      {renderError ? (
        <div className="my-auto max-w-md bg-white border border-red-200 rounded-xl p-6 shadow-sm text-center">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-800 mb-1">Rendering Notice</h4>
          <p className="text-xs text-slate-500 mb-4">{renderError}</p>
          <div className="flex items-center justify-center space-x-2">
            <button
              onClick={() => {
                setRenderError(null);
                setRenderNonce((n) => n + 1);
              }}
              className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition"
            >
              Retry Render
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      ) : (
        <div className="relative my-auto flex flex-col items-center">
          {/* Canvas Wrapper with White Paper Drop Shadow */}
          <div className="editor-paper relative bg-white overflow-hidden transition-[box-shadow,transform] duration-150">
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
                <div className="flex items-center space-x-2 px-3 py-1.5 bg-white/90 rounded-full shadow-md border border-slate-200 text-xs font-medium text-slate-700">
                  <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                  <span>Rendering...</span>
                </div>
              </div>
            )}
          </div>

          {/* Floating Page Footnote */}
          {currentPage && (
            <div className="editor-page-meta mt-4 text-[11px] font-mono flex items-center space-x-2">
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
    </main>
  );
};

