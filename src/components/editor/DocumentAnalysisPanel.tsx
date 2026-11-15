"use client";

import React, { useState, useEffect } from "react";
import {
  Type,
  Palette,
  Image as ImageIcon,
  Link as LinkIcon,
  Sparkles,
  RotateCw,
  RotateCcw,
  Trash2,
  Copy,
  Plus,
  Layers,
  X,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import { ImageInfo, HyperlinkInfo } from "@/core/models/style-profile";
import { AddImageOperation } from "@/core/models/operations";

interface ImagePreviewCardProps {
  img: ImageInfo;
  index: number;
  pageNumber: number;
  onInsert: (dataUrl: string) => Promise<void>;
  showToast: (msg: string) => void;
}

const ImagePreviewCard: React.FC<ImagePreviewCardProps> = ({
  img,
  index,
  pageNumber,
  onInsert,
  showToast,
}) => {
  const adapter = useEditorStore((s) => s.adapter);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInserting, setIsInserting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    if (adapter && adapter.extractPageRegionAsImage) {
      adapter
        .extractPageRegionAsImage(pageNumber, img.rect)
        .then((url) => {
          if (isMounted) {
            setPreviewUrl(url);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          console.warn("Failed to extract image region:", err);
          if (isMounted) setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [adapter, pageNumber, img.rect]);

  const handleInsert = async () => {
    if (!previewUrl || isInserting) return;
    setIsInserting(true);
    try {
      await onInsert(previewUrl);
      showToast("Inserted image copy onto current page");
    } finally {
      setIsInserting(false);
    }
  };

  return (
    <div className="p-3 bg-[#f4f1ea] rounded-xl border border-[#d8d4c8] space-y-2 hover:border-[#2447f5] transition">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-[#0d1b3d] text-xs">
          Image #{index + 1} ({img.format})
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#e7e3d8] text-[#0d1b3d] font-mono">
          {img.aspectRatio}:1
        </span>
      </div>

      <div className="w-full h-24 rounded-lg border border-[#d8d4c8] overflow-hidden flex items-center justify-center bg-white relative">
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-[#2447f5]" />
        ) : previewUrl ? (
          <img
            src={previewUrl}
            alt={`Extracted element ${index + 1}`}
            className="w-full h-full object-contain p-1"
          />
        ) : (
          <span className="text-[10px] text-[#4a5168]">Preview unavailable</span>
        )}
      </div>

      <button
        onClick={handleInsert}
        disabled={!previewUrl || isInserting}
        className="w-full py-1 text-xs font-semibold rounded-lg bg-[#2447f5] hover:bg-[#0d1b3d] text-white transition disabled:opacity-50"
      >
        Insert Copy
      </button>
    </div>
  );
};

export const DocumentAnalysisPanel: React.FC = () => {
  const {
    currentStyleProfile,
    currentPageNumber,
    toggleAnalysisPanel,
    executeAddOperation,
    showToast,
    selectedElementId,
    selectedTokenId,
    operations,
    activeFormatting,
    setActiveFormatting,
    deleteSelected,
    duplicateSelected,
    rotatePageInDocument,
    deletePageFromDocument,
    openPageManager,
    executeUpdateElement,
    pageInfos,
  } = useEditorStore();

  const [panelTab, setPanelTab] = useState<"edit" | "pages" | "inspect">("edit");
  const [inspectSubTab, setInspectSubTab] = useState<"fonts" | "colors" | "media" | "links">("fonts");

  // Determine currently selected element details if any
  const selectedOp = selectedElementId
    ? operations.find((op) => op.id === selectedElementId)
    : null;

  const fontOptions = [
    "Inter Tight",
    "Helvetica",
    "Arial",
    "Times New Roman",
    "Courier",
    "Instrument Serif",
  ];

  return (
    <aside className="w-[310px] bg-[#fbf9f4] border-l border-[#d8d4c8] p-5 flex flex-col gap-5 overflow-y-auto z-10 shrink-0 select-none">
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
          gap: 8px;
          height: 44px;
          padding: 0 16px;
          border-radius: 99px;
          font: 600 13px 'Inter Tight', sans-serif;
          border: 1px solid #d8d4c8;
          background: transparent;
          color: #0d1b3d;
          cursor: pointer;
          transition: transform .2s, background .2s, color .2s;
        }
        .btn:hover {
          background: #e7e3d8;
        }
        .btn.danger {
          color: #e11d48;
          border-color: #fecdd3;
        }
        .btn.danger:hover {
          background: #ffe4e6;
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
        .ib:hover {
          background: #e7e3d8;
          transform: translateY(-1px);
        }
        .ib.on {
          background: #0d1b3d;
          color: #ffd84d;
        }
        .sw {
          width: 28px;
          height: 28px;
          border-radius: 14px;
          display: inline-block;
          cursor: pointer;
          transition: transform .2s, box-shadow .2s;
          border: 2px solid transparent;
        }
        .sw:hover {
          transform: scale(1.2);
        }
        .sw.active {
          border-color: #0d1b3d;
          box-shadow: 0 0 0 2px #ffd84d;
        }
      `}</style>

      {/* Close button for inspector header */}
      <div className="flex items-center justify-between pb-1">
        <span className="text-xs font-semibold text-[#4a5168] uppercase tracking-wider">
          Properties & Tools
        </span>
        <button
          onClick={toggleAnalysisPanel}
          className="ib !w-7 !h-7 text-[#4a5168] hover:text-[#0d1b3d]"
          title="Close Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Top 3-Way Mode Switcher Pill */}
      <div className="grid grid-cols-3 bg-[#e7e3d8] rounded-full p-1 text-center font-bold text-sm">
        <button
          onClick={() => setPanelTab("edit")}
          className={`py-2 rounded-full transition ${
            panelTab === "edit"
              ? "bg-[#0d1b3d] text-[#f4f1ea] shadow-sm"
              : "text-[#4a5168] hover:text-[#0d1b3d]"
          }`}
        >
          Edit
        </button>
        <button
          onClick={() => setPanelTab("pages")}
          className={`py-2 rounded-full transition ${
            panelTab === "pages"
              ? "bg-[#0d1b3d] text-[#f4f1ea] shadow-sm"
              : "text-[#4a5168] hover:text-[#0d1b3d]"
          }`}
        >
          Pages
        </button>
        <button
          onClick={() => setPanelTab("inspect")}
          className={`py-2 rounded-full transition ${
            panelTab === "inspect"
              ? "bg-[#0d1b3d] text-[#f4f1ea] shadow-sm"
              : "text-[#4a5168] hover:text-[#0d1b3d]"
          }`}
        >
          Inspect
        </button>
      </div>

      {/* TAB 1: EDIT / ELEMENT PROPERTIES */}
      {panelTab === "edit" && (
        <div className="flex flex-col gap-5 flex-1">
          {selectedOp && selectedOp.type === "add_image" ? (
            <div className="flex flex-col gap-4">
              <div className="serif text-[28px] leading-none text-[#0d1b3d]">
                Image & Logo
              </div>
              <div className="bg-white border border-[#d8d4c8] rounded-2xl p-3 flex flex-col items-center gap-2 shadow-xs">
                <img
                  src={selectedOp.imageDataUrl}
                  alt="Selected Logo / Image"
                  className="max-h-36 max-w-full object-contain rounded-lg"
                />
                <div className="flex items-center justify-between w-full text-xs font-mono text-[#4a5168] pt-2 border-t border-[#e7e3d8]">
                  <span>{Math.round(selectedOp.rect.width)} × {Math.round(selectedOp.rect.height)} pt</span>
                  <span className="uppercase text-[10px] bg-[#e7e3d8] px-1.5 py-0.5 rounded text-[#0d1b3d] font-semibold">
                    {selectedOp.mimeType.replace("image/", "")}
                  </span>
                </div>
              </div>

              {/* Opacity Slider */}
              <label className="flex flex-col gap-2 font-bold text-sm text-[#0d1b3d]">
                <div className="flex justify-between items-center">
                  <span>Opacity</span>
                  <span className="text-xs font-mono text-[#4a5168]">
                    {Math.round((selectedOp.opacity ?? 1) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={selectedOp.opacity ?? 1}
                  onChange={(e) =>
                    executeUpdateElement(selectedOp.id, { opacity: Number(e.target.value) })
                  }
                  className="accent-[#2447f5] h-1.5 rounded-full bg-[#d8d4c8] cursor-pointer"
                />
              </label>

              {/* Replace Image Button */}
              <label className="btn w-full cursor-pointer bg-[#2447f5] text-white hover:bg-[#0d1b3d] border-none shadow-sm flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 text-[#ffd84d]" />
                <span>Replace Image / Logo</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      executeUpdateElement(selectedOp.id, {
                        imageDataUrl: reader.result as string,
                        mimeType: file.type.includes("jpeg") ? "image/jpeg" : "image/png",
                      });
                      showToast("Image / Logo replaced successfully");
                    };
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <>
              <div className="serif text-[28px] leading-none text-[#0d1b3d]">
                {selectedOp
                  ? selectedOp.type === "add_text"
                    ? "Text Element"
                    : selectedOp.type === "add_shape"
                    ? "Vector Shape"
                    : "Element"
                  : selectedTokenId
                  ? "Selected Text"
                  : "Typography & Style"}
              </div>

              {/* Font Family Selector */}
              <label className="flex flex-col gap-2 font-bold text-sm text-[#0d1b3d]">
                <span>Font</span>
                <select
                  value={activeFormatting.fontFamily || "Inter Tight"}
                  onChange={(e) => setActiveFormatting({ fontFamily: e.target.value })}
                  className="h-11 border border-[#d8d4c8] rounded-xl px-3 text-sm font-medium bg-[#f4f1ea] text-[#0d1b3d] outline-none focus:border-[#2447f5]"
                >
                  {fontOptions.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>

              {/* Font Size & Bold/Italic */}
              <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                <label className="flex flex-col gap-2 font-bold text-sm text-[#0d1b3d]">
                  <span>Size</span>
                  <div className="relative">
                    <input
                      type="number"
                      min="6"
                      max="120"
                      value={activeFormatting.fontSize || 14}
                      onChange={(e) =>
                        setActiveFormatting({ fontSize: Number(e.target.value) || 14 })
                      }
                      className="h-11 w-full border border-[#d8d4c8] rounded-xl px-3 pr-8 text-sm font-medium bg-[#f4f1ea] text-[#0d1b3d] outline-none focus:border-[#2447f5]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#4a5168] font-mono">
                      pt
                    </span>
                  </div>
                </label>

                <div className="flex gap-1">
                  <button
                    onClick={() =>
                      setActiveFormatting({
                        fontWeight:
                          activeFormatting.fontWeight === "bold" ? "normal" : "bold",
                      })
                    }
                    className={`ib ${activeFormatting.fontWeight === "bold" ? "on" : ""}`}
                    title="Bold"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setActiveFormatting({
                        fontStyle:
                          activeFormatting.fontStyle === "italic" ? "normal" : "italic",
                      })
                    }
                    className={`ib ${activeFormatting.fontStyle === "italic" ? "on" : ""}`}
                    title="Italic"
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Color Palette Swatches */}
              <div>
                <div className="font-bold text-sm text-[#0d1b3d] mb-2.5">Color</div>
                <div className="flex items-center gap-2.5">
                  {[
                    { hex: "#0d1b3d", title: "Midnight Navy" },
                    { hex: "#2447f5", title: "Electric Cobalt" },
                    { hex: "#ffd84d", title: "Golden Yellow" },
                    { hex: "#f3c9c0", title: "Soft Coral" },
                    { hex: "#ffffff", title: "White" },
                  ].map((c) => (
                    <button
                      key={c.hex}
                      onClick={() =>
                        setActiveFormatting({
                          fontColorHex: c.hex,
                          strokeColorHex: c.hex,
                          fillColorHex: c.hex,
                        })
                      }
                      title={c.title}
                      className={`sw ${activeFormatting.fontColorHex === c.hex ? "active" : ""}`}
                      style={{
                        backgroundColor: c.hex,
                        border: c.hex === "#ffffff" ? "1px solid #d8d4c8" : "none",
                      }}
                    />
                  ))}

                  {/* Native Color Picker */}
                  <label
                    className="w-7 h-7 rounded-full border border-[#d8d4c8] grid place-items-center cursor-pointer hover:scale-110 transition bg-white"
                    title="Custom color"
                  >
                    <span className="text-[11px] font-bold text-[#4a5168]">+</span>
                    <input
                      type="color"
                      value={activeFormatting.fontColorHex || "#0d1b3d"}
                      onChange={(e) =>
                        setActiveFormatting({
                          fontColorHex: e.target.value,
                          strokeColorHex: e.target.value,
                          fillColorHex: e.target.value,
                        })
                      }
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Opacity Slider */}
              <label className="flex flex-col gap-2 font-bold text-sm text-[#0d1b3d]">
                <div className="flex justify-between items-center">
                  <span>Opacity</span>
                  <span className="text-xs font-mono text-[#4a5168]">
                    {Math.round((activeFormatting.opacity ?? 1) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={activeFormatting.opacity ?? 1}
                  onChange={(e) =>
                    setActiveFormatting({ opacity: Number(e.target.value) })
                  }
                  className="accent-[#2447f5] h-1.5 rounded-full bg-[#d8d4c8] cursor-pointer"
                />
              </label>
            </>
          )}

          {/* Delete Element Button */}
          {selectedElementId ? (
            <button
              onClick={() => deleteSelected()}
              className="btn danger mt-auto w-full"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
              <span>Delete Element</span>
            </button>
          ) : (
            <div className="mt-auto p-3.5 rounded-xl bg-[#f4f1ea] border border-[#d8d4c8] text-xs text-[#4a5168] text-center">
              Click any element or text on the page to adjust properties.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PAGE MANAGEMENT */}
      {panelTab === "pages" && (
        <div className="flex flex-col gap-4 flex-1">
          <div className="serif text-[28px] leading-none text-[#0d1b3d]">
            Page {currentPageNumber} of {pageInfos.length}
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => rotatePageInDocument(currentPageNumber, 90)}
              className="btn justify-start"
            >
              <RotateCw className="w-4 h-4 text-[#2447f5]" />
              <span>Rotate 90° Clockwise</span>
            </button>

            <button
              onClick={() => rotatePageInDocument(currentPageNumber, 270)}
              className="btn justify-start"
            >
              <RotateCcw className="w-4 h-4 text-[#2447f5]" />
              <span>Rotate 90° Counter-Clockwise</span>
            </button>

            <button
              onClick={openPageManager}
              className="btn justify-start"
            >
              <Layers className="w-4 h-4 text-[#0d1b3d]" />
              <span>Page Organizer Grid</span>
            </button>

            {pageInfos.length > 1 && (
              <button
                onClick={() => deletePageFromDocument(currentPageNumber)}
                className="btn danger justify-start mt-2"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
                <span>Delete This Page</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DOCUMENT ANALYSIS & DETECTED STYLES */}
      {panelTab === "inspect" && (
        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          <div className="serif text-[28px] leading-none text-[#0d1b3d]">
            Document Profile
          </div>

          {currentStyleProfile ? (
            <div className="flex flex-col gap-3 overflow-y-auto pr-1">
              {/* Sub-tabs */}
              <div className="flex gap-1 border-b border-[#d8d4c8] pb-1 text-xs">
                <button
                  onClick={() => setInspectSubTab("fonts")}
                  className={`px-2 py-1 rounded font-semibold transition ${
                    inspectSubTab === "fonts"
                      ? "bg-[#0d1b3d] text-white"
                      : "text-[#4a5168] hover:text-[#0d1b3d]"
                  }`}
                >
                  Fonts ({currentStyleProfile.detectedFonts.size})
                </button>
                <button
                  onClick={() => setInspectSubTab("colors")}
                  className={`px-2 py-1 rounded font-semibold transition ${
                    inspectSubTab === "colors"
                      ? "bg-[#0d1b3d] text-white"
                      : "text-[#4a5168] hover:text-[#0d1b3d]"
                  }`}
                >
                  Colors
                </button>
                <button
                  onClick={() => setInspectSubTab("media")}
                  className={`px-2 py-1 rounded font-semibold transition ${
                    inspectSubTab === "media"
                      ? "bg-[#0d1b3d] text-white"
                      : "text-[#4a5168] hover:text-[#0d1b3d]"
                  }`}
                >
                  Media ({currentStyleProfile.images.length})
                </button>
              </div>

              {/* Sub-tab content */}
              {inspectSubTab === "fonts" && (
                <div className="space-y-2">
                  {Array.from(currentStyleProfile.detectedFonts.values()).map((f, i) => (
                    <div
                      key={i}
                      className="p-2.5 bg-[#f4f1ea] rounded-xl border border-[#d8d4c8] text-xs"
                    >
                      <div className="font-bold text-[#0d1b3d] truncate">{f.family || f.postScriptName}</div>
                      <div className="text-[11px] text-[#4a5168] mt-0.5">
                        {f.isBold ? "Bold" : "Regular"} • {f.isEmbedded ? "Embedded" : "Standard 14"}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {inspectSubTab === "colors" && (
                <div className="grid grid-cols-2 gap-2">
                  {currentStyleProfile.frequentlyUsedColors.map((col, i) => (
                    <button
                      key={i}
                      onClick={() =>
                        setActiveFormatting({
                          fontColorHex: col.colorHex,
                          strokeColorHex: col.colorHex,
                          fillColorHex: col.colorHex,
                        })
                      }
                      className="p-2 rounded-xl bg-[#f4f1ea] border border-[#d8d4c8] flex items-center gap-2 hover:scale-[1.02] transition"
                    >
                      <span
                        className="w-5 h-5 rounded-md border border-[#d8d4c8]"
                        style={{ backgroundColor: col.colorHex }}
                      />
                      <span className="text-xs font-mono font-bold text-[#0d1b3d]">
                        {col.colorHex}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {inspectSubTab === "media" && (
                <div className="space-y-2.5">
                  {currentStyleProfile.images.map((img, i) => (
                    <ImagePreviewCard
                      key={i}
                      img={img}
                      index={i}
                      pageNumber={currentPageNumber}
                      onInsert={async (url) => {
                        const op: AddImageOperation = {
                          id: `img_${Date.now()}`,
                          type: "add_image",
                          pageNumber: currentPageNumber,
                          imageDataUrl: url,
                          mimeType: "image/png",
                          rect: { x: 50, y: 50, width: 200, height: 150 },
                          opacity: 1,
                          rotation: 0,
                          timestamp: Date.now(),
                        };
                        await executeAddOperation(op);
                      }}
                      showToast={showToast}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-[#4a5168]">Analyzing document structure...</div>
          )}
        </div>
      )}
    </aside>
  );
};
