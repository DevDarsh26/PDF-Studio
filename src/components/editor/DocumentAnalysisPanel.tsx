"use client";

import React, { useState } from "react";
import {
  Type,
  Palette,
  Image as ImageIcon,
  Link as LinkIcon,
  Layers,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Info,
} from "lucide-react";
import { useEditorStore } from "@/store/editor-store";

export const DocumentAnalysisPanel: React.FC = () => {
  const { currentStyleProfile, currentPageNumber, pageInfos } = useEditorStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "fonts" | "colors" | "images" | "links" | "structure" | "accuracy"
  >("fonts");

  if (!currentStyleProfile) {
    return null;
  }

  const {
    detectedFonts,
    frequentlyUsedColors,
    layoutBlocks,
    textTokens,
    images,
    hyperlinks,
    pageMetadata,
    inferredProperties,
    accuracyReport,
  } = currentStyleProfile;

  const fontList = Array.from(detectedFonts.values());

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
    <aside className="w-80 border-l border-slate-200 bg-white flex flex-col shrink-0 select-none z-10 shadow-xs">
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
          className={`flex-1 py-1.5 px-2 rounded-md font-medium text-[11px] transition flex items-center justify-center space-x-1 ${
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
          className={`flex-1 py-1.5 px-2 rounded-md font-medium text-[11px] transition flex items-center justify-center space-x-1 ${
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
          className={`flex-1 py-1.5 px-2 rounded-md font-medium text-[11px] transition flex items-center justify-center space-x-1 ${
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
          className={`flex-1 py-1.5 px-2 rounded-md font-medium text-[11px] transition flex items-center justify-center space-x-1 ${
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
                      <p className="text-[10px] font-mono text-slate-500 truncate max-w-[190px]" title={font.postScriptName}>
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
                  <div className="flex flex-wrap gap-1.5 pt-1">
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
                    className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between"
                  >
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
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 font-mono text-slate-700 block">
                        Freq: {color.frequency}
                      </span>
                      <span className="text-[9px] text-slate-400 capitalize">
                        {color.contexts.join(", ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Inferred Background Color */}
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/80">
              <span className="text-[10px] font-semibold text-blue-900 block mb-1 uppercase tracking-wider">
                Inferred Page Background
              </span>
              <div className="flex items-center space-x-2">
                <div
                  className="w-5 h-5 rounded border border-slate-300"
                  style={{ backgroundColor: inferredProperties.pageBackgroundHex }}
                />
                <span className="font-mono text-xs text-blue-900 font-medium">
                  {inferredProperties.pageBackgroundHex}
                </span>
                <span className="text-[10px] text-blue-600">(Heuristic Detection)</span>
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
                <div
                  key={idx}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800 text-xs">
                      Image #{idx + 1} ({img.format})
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-mono">
                      {img.aspectRatio}:1 AR
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 grid grid-cols-2 gap-1 font-mono">
                    <span>
                      X: {Math.round(img.rect.x)}pt | Y: {Math.round(img.rect.y)}pt
                    </span>
                    <span>
                      {Math.round(img.rect.width)} × {Math.round(img.rect.height)} pt
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200">
                    Color Space: {img.colorSpace} | Bits: {img.bitsPerComponent}bpc
                  </div>
                </div>
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
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 hover:border-blue-300 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                      {link.targetType === "external_url" ? "External URL" : "Internal Jump"}
                    </span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono">
                      Preserved
                    </span>
                  </div>
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
                  <div className="text-[10px] text-slate-400 font-mono">
                    Bounds: {Math.round(link.rect.x)}, {Math.round(link.rect.y)} ({Math.round(link.rect.width)}×{Math.round(link.rect.height)}pt)
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
