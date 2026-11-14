"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LayoutList,
  RotateCw,
  Trash2,
  Plus,
  Layers,
} from "lucide-react";
import { useEditorStore } from "@/store/editor-store";

interface ThumbnailItemProps {
  pageNumber: number;
  isActive: boolean;
  dimensions: { width: number; height: number };
  rotation: number;
  canDelete: boolean;
  onClick: () => void;
  onRotate: () => void;
  onDelete: () => void;
}

const ThumbnailItem: React.FC<ThumbnailItemProps> = ({
  pageNumber,
  isActive,
  dimensions,
  rotation,
  canDelete,
  onClick,
  onRotate,
  onDelete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { adapter } = useEditorStore();
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const render = async () => {
      try {
        await adapter.renderThumbnail({
          pageNumber,
          targetWidth: 120,
          canvas,
        });
        if (!isCancelled) {
          setIsRendered(true);
        }
      } catch (err: any) {
        if (!isCancelled && err?.name !== "RenderingCancelledException") {
          setTimeout(() => {
            if (!isCancelled) render();
          }, 120);
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
  }, [pageNumber, rotation, adapter]);

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-lg p-2 transition-all duration-150 flex flex-col items-center select-none cursor-pointer ${
        isActive
          ? "bg-blue-50/80 ring-2 ring-blue-500 shadow-sm"
          : "hover:bg-slate-100/80 bg-white border border-slate-200/80"
      }`}
    >
      <div className="relative w-full flex items-center justify-center min-h-[140px] bg-slate-50 rounded overflow-hidden border border-slate-100 shadow-2xs">
        <canvas ref={canvasRef} className="max-w-full h-auto object-contain block" />
        {!isRendered && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 font-mono">
            Loading...
          </div>
        )}

        {/* Hover Quick Action Buttons */}
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1 bg-white/90 backdrop-blur-xs p-0.5 rounded shadow-xs border border-slate-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRotate();
            }}
            title="Rotate Page 90° Clockwise"
            className="p-1 hover:bg-slate-200/80 text-slate-600 rounded transition"
          >
            <RotateCw className="w-3 h-3" />
          </button>
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete Page"
              className="p-1 hover:bg-red-100 text-red-600 rounded transition"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-1.5 flex items-center justify-between w-full px-1 text-[11px]">
        <span
          className={`font-semibold ${
            isActive ? "text-blue-700" : "text-slate-600 group-hover:text-slate-900"
          }`}
        >
          Page {pageNumber}
        </span>
        <span className="text-[10px] text-slate-400 font-mono">
          {Math.round(dimensions.width)} × {Math.round(dimensions.height)}
        </span>
      </div>
    </div>
  );
};

export const ThumbnailSidebar: React.FC = () => {
  const {
    pageInfos,
    currentPageNumber,
    setCurrentPage,
    addBlankPageToDocument,
    deletePageFromDocument,
    rotatePageInDocument,
    openPageManager,
  } = useEditorStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the active thumbnail into view
  useEffect(() => {
    if (containerRef.current) {
      const activeElement = containerRef.current.querySelector(
        `[data-page-index="${currentPageNumber}"]`
      );
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [currentPageNumber]);

  const handleRotatePage = (pageNumber: number) => {
    rotatePageInDocument(pageNumber, 90);
  };

  const handleDeletePage = (pageNumber: number) => {
    if (pageInfos.length <= 1) return;
    if (confirm(`Are you sure you want to delete Page ${pageNumber}?`)) {
      deletePageFromDocument(pageNumber);
    }
  };

  const handleAddBlankPage = () => {
    addBlankPageToDocument(pageInfos.length);
  };

  if (isCollapsed) {
    return (
      <div className="w-10 border-r border-slate-200 bg-slate-50/50 flex flex-col items-center py-3 select-none">
        <button
          onClick={() => setIsCollapsed(false)}
          title="Expand Thumbnail Panel"
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-48 sm:w-56 border-r border-slate-200 bg-slate-50 flex flex-col shrink-0 select-none">
      {/* Header */}
      <div className="h-10 border-b border-slate-200 px-3 flex items-center justify-between bg-white/70 backdrop-blur-xs">
        <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700">
          <LayoutList className="w-3.5 h-3.5 text-slate-500" />
          <span>Pages ({pageInfos.length})</span>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          title="Collapse Thumbnail Panel"
          className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Thumbnail List */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {pageInfos.map((info) => (
          <div key={info.pageNumber} data-page-index={info.pageNumber}>
            <ThumbnailItem
              pageNumber={info.pageNumber}
              isActive={currentPageNumber === info.pageNumber}
              dimensions={info.dimensions}
              rotation={info.rotation}
              canDelete={pageInfos.length > 1}
              onClick={() => setCurrentPage(info.pageNumber)}
              onRotate={() => handleRotatePage(info.pageNumber)}
              onDelete={() => handleDeletePage(info.pageNumber)}
            />
          </div>
        ))}
      </div>

      {/* Footer Quick Actions */}
      <div className="p-2 border-t border-slate-200 bg-white/80 space-y-1.5">
        <button
          onClick={handleAddBlankPage}
          className="w-full flex items-center justify-center space-x-1.5 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-medium transition"
        >
          <Plus className="w-3.5 h-3.5 text-slate-500" />
          <span>Add Blank Page</span>
        </button>
        <button
          onClick={openPageManager}
          className="w-full flex items-center justify-center space-x-1.5 px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-medium transition"
        >
          <Layers className="w-3.5 h-3.5 text-blue-600" />
          <span>Page Manager</span>
        </button>
      </div>
    </aside>
  );
};

