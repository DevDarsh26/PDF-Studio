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
  } = useEditorStore();

  const [isRendering, setIsRendering] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [renderNonce, setRenderNonce] = useState(0);

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
      className="flex-1 bg-slate-100 flex flex-col items-center justify-start p-8 overflow-auto relative"
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
          <div className="relative bg-white shadow-xl rounded-sm border border-slate-300/60 overflow-hidden transition-all duration-150">
            <canvas ref={canvasRef} className="block" />

            {/* Interactive Drawing & Selection Overlay Layer */}
            {currentPage && (
              <InteractiveOverlay
                pageWidth={currentPage.dimensions.width}
                pageHeight={currentPage.dimensions.height}
                scale={zoomScale}
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
            <div className="mt-4 text-[11px] text-slate-400 font-mono flex items-center space-x-2">
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

