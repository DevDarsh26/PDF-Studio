"use client";

import React, { useState, useEffect } from "react";
import {
  Type,
  Palette,
  Image as ImageIcon,
  Link as LinkIcon,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Info,
  Download,
  Plus,
  Copy,
  Navigation,
  Edit3,
  Loader2,
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

  const handleCopy = async () => {
    if (!previewUrl) return;
    try {
      const res = await fetch(previewUrl);
      const blob = await res.blob();
      if (typeof window !== "undefined" && navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({ [blob.type]: blob }),
        ]);
        showToast("Image copied to clipboard!");
      } else {
        await navigator.clipboard.writeText(previewUrl);
        showToast("Image data URL copied to clipboard");
      }
    } catch {
      await navigator.clipboard.writeText(previewUrl);
      showToast("Image data copied to clipboard");
    }
  };

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
    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 hover:border-slate-300 transition">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-800 text-xs">
          Image #{index + 1} ({img.format})
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-mono">
          {img.aspectRatio}:1 AR
        </span>
      </div>

      {/* Visual Image Preview */}
      <div className="w-full h-32 rounded-lg border border-slate-200/80 overflow-hidden flex items-center justify-center bg-[repeating-conic-gradient(#f8fafc_0%_25%,#fff_0%_50%)] bg-[length:12px_12px] relative group">
        {isLoading ? (
          <div className="flex flex-col items-center space-y-1.5 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-[10px]">Rendering preview...</span>
          </div>
        ) : previewUrl ? (
          <img
            src={previewUrl}
            alt={`Extracted page element ${index + 1}`}
            className="w-full h-full object-contain p-1"
          />
        ) : (
          <div className="text-slate-400 text-[10px]">Preview unavailable</div>
        )}
      </div>

      {/* Metadata info */}
      <div className="text-[10.5px] text-slate-600 grid grid-cols-2 gap-1 font-mono">
        <span>
          X: {Math.round(img.rect.x)}pt | Y: {Math.round(img.rect.y)}pt
        </span>
        <span className="text-right">
          {Math.round(img.rect.width)} × {Math.round(img.rect.height)} pt
        </span>
      </div>

      <div className="text-[9.5px] text-slate-400 pt-1 border-t border-slate-200">
        Color: {img.colorSpace} | Bits: {img.bitsPerComponent}bpc
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-1.5 pt-1">
        {previewUrl && (
          <a
            href={previewUrl}
            download={`page-${pageNumber}-image-${index + 1}.png`}
            className="flex-1 flex items-center justify-center space-x-1 py-1.5 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10.5px] font-medium transition"
            title="Download PNG to disk"
          >
            <Download className="w-3 h-3 text-slate-500" />
            <span>Download</span>
          </a>
        )}

        <button
          onClick={handleInsert}
          disabled={!previewUrl || isInserting}
          className="flex-1 flex items-center justify-center space-x-1 py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[10.5px] font-medium transition disabled:opacity-50"
          title="Place a copy of this image onto page canvas"
        >
          <Plus className="w-3 h-3 text-blue-600" />
          <span>Insert</span>
        </button>

        <button
          onClick={handleCopy}
          disabled={!previewUrl}
          className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition disabled:opacity-50"
          title="Copy image to clipboard"
        >
          <Copy className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export const DocumentAnalysisPanel: React.FC = () => {
  const {
    currentStyleProfile,
    currentPageNumber,
    setActiveFormatting,
    executeAddOperation,
    openEditLinkModal,
    setCurrentPage,
    showToast,
  } = useEditorStore();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "fonts" | "colors" | "images" | "links" | "accuracy"
  >("fonts");

  if (!currentStyleProfile) {
    return null;
  }

  const {
    detectedFonts,
    frequentlyUsedColors,
    images,
    hyperlinks,
    inferredProperties,
    accuracyReport,
  } = currentStyleProfile;

  const fontList = Array.from(detectedFonts.values());

  const handleInsertExtractedImage = async (
    img: ImageInfo,
    dataUrl: string
  ) => {
    const op: AddImageOperation = {
      id: `op-img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: "add_image",
      pageNumber: currentPageNumber,
      rect: {
        x: Math.max(20, Math.min(img.rect.x + 20, 200)),
        y: Math.max(20, Math.min(img.rect.y + 20, 300)),
        width: Math.max(40, Math.min(img.rect.width, 250)),
        height: Math.max(40, Math.min(img.rect.height, 250)),
      },
      imageDataUrl: dataUrl,
      mimeType: "image/png",
      opacity: 1,
      timestamp: Date.now(),
    };
    await executeAddOperation(op);
  };

  if (isCollapsed) {
    return (
      <div className="w-10 border-l border-slate-200 bg-slate-50 flex flex-col items-center py-3 select-none shrink-0 z-10">
        <button
          onClick={() => setIsCollapsed(false)}
          title="Expand Document Analysis Panel"
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-84 border-l border-slate-200 bg-white flex flex-col shrink-0 select-none z-10 shadow-xs">
      {/* Panel Header */}
      <div className="h-12 border-b border-slate-200 px-4 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <span className="font-semibold text-xs text-slate-800 tracking-tight">
            Document Style Profile
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-mono">
            Pg {currentPageNumber}
          </span>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          title="Collapse Panel"
          className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200/50 transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-slate-50/50 p-1 space-x-1 text-xs">
        <button
          onClick={() => setActiveTab("fonts")}
          className={`flex-1 py-1.5 px-1.5 rounded-md font-medium text-[11px] transition flex items-center justify-center space-x-1 ${
            activeTab === "fonts"
              ? "bg-white text-blue-600 shadow-2xs border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          <span>Fonts ({fontList.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("colors")}
          className={`flex-1 py-1.5 px-1.5 rounded-md font-medium text-[11px] transition flex items-center justify-center space-x-1 ${
            activeTab === "colors"
              ? "bg-white text-blue-600 shadow-2xs border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Colors</span>
        </button>
        <button
          onClick={() => setActiveTab("images")}
          className={`flex-1 py-1.5 px-1.5 rounded-md font-medium text-[11px] transition flex items-center justify-center space-x-1 ${
            activeTab === "images"
              ? "bg-white text-blue-600 shadow-2xs border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Media ({images.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("links")}
          className={`flex-1 py-1.5 px-1.5 rounded-md font-medium text-[11px] transition flex items-center justify-center space-x-1 ${
            activeTab === "links"
              ? "bg-white text-blue-600 shadow-2xs border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5" />
          <span>Links ({hyperlinks.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("accuracy")}
          className={`py-1.5 px-2 rounded-md font-medium text-[11px] transition flex items-center justify-center ${
            activeTab === "accuracy"
              ? "bg-white text-blue-600 shadow-2xs border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900"
          }`}
          title="Analysis Accuracy & Limitations"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-4 text-xs space-y-4">
        {/* FONTS TAB */}
        {activeTab === "fonts" && (
          <div className="space-y-3">
            <div className="text-[11px] text-slate-500 flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Detected Fonts ({fontList.length})
              </span>
              <span className="text-[10px] text-blue-600 font-medium">100% Extracted</span>
            </div>

            {fontList.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No embedded font resources on this page.
              </div>
            ) : (
              fontList.map((font) => (
                <div
                  key={font.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2 hover:border-slate-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs tracking-tight">
                        {font.family}
                      </h4>
                      <p
                        className="text-[10px] font-mono text-slate-500 truncate max-w-[190px]"
                        title={font.postScriptName}
                      >
                        {font.postScriptName}
                      </p>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 font-mono text-slate-700">
                      {font.weight}
                    </span>
                  </div>

                  {/* Reusability status alert */}
                  <div
                    className={`p-2 rounded-lg text-[11px] flex items-start space-x-1.5 border ${
                      font.canBeReusedForEditing
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}
                  >
                    {font.canBeReusedForEditing ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-tight text-[10.5px]">
                      {font.reusabilityReason}
                    </span>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {font.isSubset && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-50 text-purple-700 border border-purple-200 font-mono">
                        Subset Font
                      </span>
                    )}
                    {font.isEmbedded && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                        Embedded
                      </span>
                    )}
                    {font.isStandard14 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 text-slate-800 font-mono">
                        Standard 14
                      </span>
                    )}
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                      Freq: {font.frequency}
                    </span>
                  </div>

                  {/* Character coverage */}
                  {font.characterCoverage.count > 0 && (
                    <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200/50">
                      <span className="font-medium text-slate-700">
                        Coverage ({font.characterCoverage.count} glyphs):{" "}
                      </span>
                      <span className="font-mono text-slate-600">
                        {font.characterCoverage.sampleCharacters.join(" ")}...
                      </span>
                    </div>
                  )}

                  {/* Interactive Buttons */}
                  <div className="flex items-center space-x-1.5 pt-1.5 border-t border-slate-200/60">
                    <button
                      onClick={() => {
                        setActiveFormatting({
                          fontFamily: font.family,
                          fontWeight: font.weight === "bold" ? "bold" : "normal",
                          fontStyle: font.style === "italic" ? "italic" : "normal",
                        });
                        showToast(`Set active font to "${font.family}"`);
                      }}
                      className="flex-1 flex items-center justify-center space-x-1 py-1 px-2 text-[10.5px] font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 rounded-lg transition"
                      title="Use this font in the active text tool"
                    >
                      <Sparkles className="w-3 h-3 text-blue-600" />
                      <span>Use in Editor</span>
                    </button>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(font.family);
                        showToast(`Copied font name: ${font.family}`);
                      }}
                      className="p-1 px-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg transition flex items-center space-x-1 text-[10.5px]"
                      title="Copy font name"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* COLORS TAB */}
        {activeTab === "colors" && (
          <div className="space-y-4">
            <div>
              <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-500 block mb-2">
                Color Palette & Color Spaces
              </span>
              <div className="space-y-2">
                {frequentlyUsedColors.map((color, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div
                          className="w-6 h-6 rounded-md border border-black/10 shadow-2xs"
                          style={{ backgroundColor: color.colorHex }}
                        />
                        <div>
                          <span className="font-mono font-semibold text-slate-800 text-xs block">
                            {color.colorHex}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            Space: {color.colorSpace}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 font-mono text-slate-700 inline-block">
                          Freq: {color.frequency}
                        </span>
                        <div className="text-[9px] text-slate-400 capitalize mt-0.5">
                          {color.contexts.join(", ")}
                        </div>
                      </div>
                    </div>

                    {/* Interactive Color Actions */}
                    <div className="flex items-center space-x-1.5 pt-1.5 border-t border-slate-200/60">
                      <button
                        onClick={() => {
                          setActiveFormatting({ fontColorHex: color.colorHex });
                          showToast(`Applied text color: ${color.colorHex}`);
                        }}
                        className="flex-1 py-1 px-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-medium transition text-center"
                        title="Set as active text color"
                      >
                        Text Color
                      </button>
                      <button
                        onClick={() => {
                          setActiveFormatting({ strokeColorHex: color.colorHex });
                          showToast(`Applied stroke color: ${color.colorHex}`);
                        }}
                        className="flex-1 py-1 px-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-medium transition text-center"
                        title="Set as active stroke color"
                      >
                        Stroke
                      </button>
                      <button
                        onClick={() => {
                          setActiveFormatting({ fillColorHex: color.colorHex });
                          showToast(`Applied fill color: ${color.colorHex}`);
                        }}
                        className="flex-1 py-1 px-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10px] font-medium transition text-center"
                        title="Set as active fill color"
                      >
                        Fill
                      </button>
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(color.colorHex);
                          showToast(`Copied ${color.colorHex} to clipboard`);
                        }}
                        className="p-1 bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 rounded transition"
                        title="Copy Hex"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Inferred Background Color */}
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/80 space-y-2">
              <span className="text-[10px] font-semibold text-blue-900 block uppercase tracking-wider">
                Inferred Page Background
              </span>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-5 h-5 rounded border border-slate-300 shadow-2xs"
                    style={{ backgroundColor: inferredProperties.pageBackgroundHex }}
                  />
                  <span className="font-mono text-xs text-blue-900 font-medium">
                    {inferredProperties.pageBackgroundHex}
                  </span>
                  <span className="text-[10px] text-blue-600">(Heuristic)</span>
                </div>
                <button
                  onClick={() => {
                    setActiveFormatting({ fillColorHex: inferredProperties.pageBackgroundHex });
                    showToast(`Set fill color to background ${inferredProperties.pageBackgroundHex}`);
                  }}
                  className="px-2 py-1 text-[10px] font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                >
                  Use for Whiteout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* IMAGES TAB */}
        {activeTab === "images" && (
          <div className="space-y-3">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-500 block mb-1">
              Embedded Images on Page {currentPageNumber} ({images.length})
            </span>

            {images.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No raster images or XObjects found on this page.
              </div>
            ) : (
              images.map((img, idx) => (
                <ImagePreviewCard
                  key={idx}
                  img={img}
                  index={idx}
                  pageNumber={currentPageNumber}
                  onInsert={(dataUrl) => handleInsertExtractedImage(img, dataUrl)}
                  showToast={showToast}
                />
              ))
            )}
          </div>
        )}

        {/* LINKS TAB */}
        {activeTab === "links" && (
          <div className="space-y-3">
            <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-500 block mb-1">
              Hyperlinks & Internal Destinations ({hyperlinks.length})
            </span>

            {hyperlinks.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No interactive link annotations found on this page.
              </div>
            ) : (
              hyperlinks.map((link, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 hover:border-blue-300 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                      {link.targetType === "external_url" ? "External URL" : "Internal Jump"}
                    </span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono">
                      Preserved
                    </span>
                  </div>

                  {link.targetType === "external_url" ? (
                    <a
                      href={String(link.target)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 font-medium hover:underline text-xs flex items-center space-x-1 truncate block"
                      title={String(link.target)}
                    >
                      <span className="truncate">{String(link.target)}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  ) : (
                    <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-800">
                      <Navigation className="w-3.5 h-3.5 text-blue-600" />
                      <span>Destination Page {link.target}</span>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-400 font-mono">
                    Bounds: {Math.round(link.rect.x)}, {Math.round(link.rect.y)} (
                    {Math.round(link.rect.width)}×{Math.round(link.rect.height)}pt)
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1.5 pt-1 border-t border-slate-200/60">
                    {link.targetType === "internal_page" && (
                      <button
                        onClick={() => {
                          const targetPage = Number(link.target);
                          if (targetPage > 0) {
                            setCurrentPage(targetPage);
                            showToast(`Navigated to page ${targetPage}`);
                          }
                        }}
                        className="flex-1 py-1 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-[10.5px] font-medium transition flex items-center justify-center space-x-1"
                      >
                        <Navigation className="w-3 h-3 text-blue-600" />
                        <span>Jump to Page</span>
                      </button>
                    )}

                    <button
                      onClick={() => openEditLinkModal(link)}
                      className="flex-1 py-1 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-[10.5px] font-medium transition flex items-center justify-center space-x-1"
                      title="Edit link properties"
                    >
                      <Edit3 className="w-3 h-3 text-slate-500" />
                      <span>Edit Link</span>
                    </button>

                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(String(link.target));
                        showToast("Copied link target to clipboard");
                      }}
                      className="p-1 bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 rounded transition"
                      title="Copy target URL/page"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ACCURACY & PROVENANCE TAB */}
        {activeTab === "accuracy" && (
          <div className="space-y-4">
            <div>
              <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-500 block mb-2">
                Extraction Accuracy Summary
              </span>
              <div className="grid grid-cols-2 gap-2 text-center font-mono">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-base font-bold text-slate-900 block">
                    {accuracyReport.totalTokensExtracted}
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans">Text Tokens</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-base font-bold text-slate-900 block">
                    {accuracyReport.fontsDirectlyExtractedCount}
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans">Extracted Fonts</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-base font-bold text-amber-600 block">
                    {accuracyReport.nonReusableSubsetFontCount}
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans">Subset Fonts</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-base font-bold text-slate-900 block">
                    {accuracyReport.imagesDetectedCount}
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans">Images Extracted</span>
                </div>
              </div>
            </div>

            {/* Inferred vs Extracted Distinction Notice */}
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5 text-amber-900">
              <div className="flex items-center space-x-1.5 font-semibold text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Extracted vs. Inferred Data</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800">
                PDF files store absolute coordinate glyph drawing commands. Text coordinates, font
                descriptors, and link dictionaries are <strong>directly extracted</strong>.
                Paragraph flows, column arrangements, and background rectangles are{" "}
                <strong>heuristically inferred</strong>.
              </p>
            </div>

            {/* Known Limitations */}
            <div>
              <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-500 block mb-1.5">
                Known Technical Limitations
              </span>
              <ul className="space-y-1.5 text-[11px] text-slate-600 list-disc list-inside">
                {accuracyReport.knownLimitations.map((lim, i) => (
                  <li key={i} className="leading-snug">
                    {lim}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Panel Status Footer */}
      <div className="h-8 border-t border-slate-200 px-4 bg-slate-50 flex items-center justify-between text-[10px] text-slate-500">
        <span>Analysis: Background Worker</span>
        <span className="text-emerald-700 font-medium flex items-center space-x-1">
          <ShieldCheck className="w-3 h-3" />
          <span>Local Engine</span>
        </span>
      </div>
    </aside>
  );
};
