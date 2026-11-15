"use client";

import React from "react";
import {
  ChevronLeft,
  Undo2,
  Redo2,
  Download,
  Layers,
  Sparkles,
  LayoutList,
  RotateCw,
} from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import { useHistoryStore } from "@/store/history-store";

interface TopToolbarProps {
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export const TopToolbar: React.FC<TopToolbarProps> = () => {
  const {
    documentName,
    operations,
    closeDocument,
    openExportModal,
    openPageManager,
    showThumbnails,
    showAnalysisPanel,
    toggleThumbnails,
    toggleAnalysisPanel,
  } = useEditorStore();

  const { state: historyState, undo, redo } = useHistoryStore();

  return (
    <header className="h-14 sm:h-[68px] bg-[#fbf9f4] border-b border-[#d8d4c8] flex items-center justify-between px-3 sm:px-6 z-20 shrink-0 select-none">
      <style jsx>{`
        .serif {
          font-family: 'Instrument Serif', Georgia, serif;
          font-weight: 400;
          letter-spacing: -0.02em;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 38px;
          padding: 0 14px;
          border-radius: 99px;
          font: 600 13px 'Inter Tight', sans-serif;
          border: 1px solid #0d1b3d;
          background: transparent;
          color: #0d1b3d;
          cursor: pointer;
          transition: transform .2s cubic-bezier(.2,.8,.2,1), background .2s, color .2s;
        }
        @media (min-width: 640px) {
          .btn {
            height: 44px;
            padding: 0 20px;
            font-size: 14px;
            gap: 8px;
          }
        }
        .btn:hover {
          transform: translateY(-1px);
          background: #ffd84d;
        }
        .btn.pri {
          background: #2447f5;
          border-color: #2447f5;
          color: #f4f1ea;
        }
        .btn.pri:hover {
          background: #0d1b3d;
          border-color: #0d1b3d;
        }
        .ib {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid transparent;
          background: transparent;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: #0d1b3d;
          transition: background .2s, transform .2s;
        }
        @media (min-width: 640px) {
          .ib {
            width: 40px;
            height: 40px;
            border-radius: 12px;
          }
        }
        .ib:hover:not(:disabled) {
          background: #e7e3d8;
          transform: translateY(-1px);
        }
        .ib:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
      `}</style>

      {/* Left: Back Arrow + Document Title + Saved/Edited Badge */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <button
          onClick={closeDocument}
          className="ib"
          title="Back to Dashboard"
          aria-label="Back to dashboard"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <span
          className="serif text-xl sm:text-[28px] text-[#0d1b3d] leading-none truncate max-w-[120px] xs:max-w-[180px] sm:max-w-xs md:max-w-md"
          title={documentName || "Service-agreement.pdf"}
        >
          {documentName || "Service-agreement.pdf"}
        </span>

        {/* Pulse indicator on mobile */}
        <span
          className={`flex sm:hidden w-2 h-2 rounded-full ${
            operations.length > 0 ? "bg-[#ffd84d]" : "bg-[#2447f5]"
          } animate-pulse shrink-0`}
          title={operations.length > 0 ? "Edited" : "Saved"}
        />

        {/* Full badge on larger screens */}
        <span className="hidden sm:inline-flex items-center gap-2 text-xs font-bold bg-[#e7e3d8] rounded-full px-3 py-1 text-[#0d1b3d] shrink-0">
          <i
            className={`w-2 h-2 rounded-full ${
              operations.length > 0 ? "bg-[#ffd84d]" : "bg-[#2447f5]"
            } animate-pulse`}
          />
          {operations.length > 0 ? "Edited" : "Saved"}
        </span>
      </div>

      {/* Right: History Undo/Redo + Toggle Panels + Organize + Download */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Undo / Redo */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            onClick={() => undo()}
            disabled={!historyState.canUndo}
            className="ib"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => redo()}
            disabled={!historyState.canRedo}
            className="ib"
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Panel Toggles for Thumbnails and Analysis */}
        <button
          onClick={toggleThumbnails}
          className={`ib ${showThumbnails ? "!bg-[#0d1b3d] !text-[#ffd84d]" : ""}`}
          title="Toggle Thumbnails Panel"
          aria-label="Toggle Thumbnails Panel"
        >
          <LayoutList className="w-4 h-4" />
        </button>

        <button
          onClick={toggleAnalysisPanel}
          className={`ib ${showAnalysisPanel ? "!bg-[#0d1b3d] !text-[#ffd84d]" : ""}`}
          title="Toggle Properties / Analysis Panel"
          aria-label="Toggle Properties Panel"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* Organize Pages Button */}
        <button
          onClick={openPageManager}
          className="btn hidden md:inline-flex"
          title="Reorder, Rotate, or Extract Pages"
        >
          <Layers className="w-4 h-4" />
          <span>Organize</span>
        </button>

        {/* Download / Export Primary Button */}
        <button
          onClick={openExportModal}
          className="btn pri shadow-md shadow-blue-600/20 active:scale-95"
          title="Download or Export Modified PDF"
        >
          <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden xs:inline">Download</span>
        </button>
      </div>
    </header>
  );
};
