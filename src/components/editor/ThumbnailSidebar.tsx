"use client";

import React, { useEffect, useRef, useState } from "react";
import {
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
          targetWidth: 100,
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
      className={`group relative flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all cursor-pointer select-none ${
        isActive
          ? "bg-[#ffd84d] text-[#0d1b3d] shadow-sm"
          : "bg-transparent hover:bg-[#e7e3d8] text-[#4a5168]"
      }`}
    >
      <div className="w-[100px] h-[130px] bg-[#fbf9f4] rounded-md border border-[#d8d4c8] p-1 flex items-center justify-center overflow-hidden shadow-2xs relative">
        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain block" />
        {!isRendered && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-[#4a5168] font-mono">
            ...
          </div>
        )}

        {/* Hover Quick Action Buttons */}
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#fbf9f4]/95 p-0.5 rounded shadow-xs border border-[#d8d4c8]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRotate();
            }}
            title="Rotate Page"
            className="p-1 hover:bg-[#e7e3d8] text-[#0d1b3d] rounded transition"
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

      <b className={`text-xs ${isActive ? "text-[#0d1b3d] font-bold" : "text-[#4a5168]"}`}>
        {pageNumber}
      </b>
    </div>
  );
};

export const ThumbnailSidebar: React.FC = () => {
  const {
    pageInfos,
    currentPageNumber,
    setCurrentPage,
    rotatePageInDocument,
    deletePageFromDocument,
    openPageManager,
    viewRotation,
  } = useEditorStore();

  const numPages = pageInfos.length;

  return (
    <aside className="w-[172px] bg-[#fbf9f4] border-r border-[#d8d4c8] p-3 flex flex-col items-center gap-2 overflow-y-auto z-10 shrink-0 select-none">
      <div className="w-full flex items-center justify-between pb-2 border-b border-[#d8d4c8] px-1">
        <span className="serif text-xl font-normal text-[#0d1b3d]">Pages</span>
        <button
          onClick={openPageManager}
          className="text-[11px] font-semibold text-[#2447f5] hover:underline flex items-center gap-0.5"
          title="Open Page Organizer"
        >
          <Layers className="w-3 h-3" />
          <span>Manage</span>
        </button>
      </div>

      <div className="w-full flex flex-col items-center gap-2 overflow-y-auto py-1">
        {pageInfos.map((info) => (
          <ThumbnailItem
            key={info.pageNumber}
            pageNumber={info.pageNumber}
            isActive={info.pageNumber === currentPageNumber}
            dimensions={info.dimensions}
            rotation={viewRotation}
            canDelete={numPages > 1}
            onClick={() => setCurrentPage(info.pageNumber)}
            onRotate={() => rotatePageInDocument(info.pageNumber, 90)}
            onDelete={() => deletePageFromDocument(info.pageNumber)}
          />
        ))}
      </div>

      <div className="w-full pt-2 border-t border-[#d8d4c8] mt-auto">
        <button
          onClick={openPageManager}
          className="w-full py-2 px-3 rounded-full border border-dashed border-[#d8d4c8] hover:border-[#2447f5] text-xs font-semibold text-[#0d1b3d] hover:bg-[#e7e3d8] flex items-center justify-center gap-1.5 transition"
        >
          <Plus className="w-3.5 h-3.5 text-[#2447f5]" />
          <span>Add Page</span>
        </button>
      </div>
    </aside>
  );
};
