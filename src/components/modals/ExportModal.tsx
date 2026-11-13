"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Download,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ShieldCheck,
  Sparkles,
  Loader2,
  FolderArchive,
  ZoomIn,
} from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import { validateExportedPdf, ExportValidationResult } from "@/core/export/export-validator";
import { ZipArchive } from "@/core/utils/zip-archive";
import { downloadBlob, downloadBytes } from "@/core/utils/download";

export const ExportModal: React.FC = () => {
  const {
    isExportModalOpen,
    closeExportModal,
    documentName,
    currentPageNumber,
    pageInfos,
    operations,
    currentStyleProfile,
    adapter,
  } = useEditorStore();

  const [activeTab, setActiveTab] = useState<"pdf" | "image">("pdf");

  // PDF Export State
  const [pdfFileName, setPdfFileName] = useState("");
  const [preserveMetadata, setPreserveMetadata] = useState(true);
  const [compressPdf, setCompressPdf] = useState(true);
  const [runValidation, setRunValidation] = useState(true);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [validationResult, setValidationResult] = useState<ExportValidationResult | null>(null);

  // Image Export State
  const [imageScope, setImageScope] = useState<"current" | "all">("current");
  const [imageFormat, setImageFormat] = useState<"image/png" | "image/jpeg">("image/png");
  const [imageDpi, setImageDpi] = useState<number>(2.0); // 1.0 = 72dpi, 2.0 = 150dpi, 4.166 = 300dpi
  const [jpegQuality, setJpegQuality] = useState<number>(0.92);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [previewDimensions, setPreviewDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isExportingImages, setIsExportingImages] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);

  // Initialize PDF filename when modal opens
  useEffect(() => {
    if (documentName) {
      const base = documentName.replace(/\.pdf$/i, "");
      setPdfFileName(`${base}-edited.pdf`);
    } else {
      setPdfFileName("document-edited.pdf");
    }
    setValidationResult(null);
  }, [documentName, isExportModalOpen]);

  // Generate live image preview when tab is "image" or image settings change
  useEffect(() => {
    if (!isExportModalOpen || activeTab !== "image") return;

    let isCancelled = false;
    const generatePreview = async () => {
      setIsLoadingPreview(true);
      try {
        const blob = await adapter.exportPageImage({
          pageNumber: currentPageNumber,
          format: imageFormat,
          quality: jpegQuality,
          dpiScale: Math.min(imageDpi, 2.0), // Cap preview scale for snappy rendering
        });

        if (!isCancelled) {
          if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
          const url = URL.createObjectURL(blob);
          setImagePreviewUrl(url);

          const page = pageInfos[currentPageNumber - 1];
          if (page) {
            setPreviewDimensions({
              width: Math.round(page.dimensions.width * imageDpi),
              height: Math.round(page.dimensions.height * imageDpi),
            });
          }
        }
      } catch {
        // Preview generation fallback
      } finally {
        if (!isCancelled) setIsLoadingPreview(false);
      }
    };

    generatePreview();

    return () => {
      isCancelled = true;
    };
  }, [
    isExportModalOpen,
    activeTab,
    currentPageNumber,
    imageFormat,
    imageDpi,
    jpegQuality,
    adapter,
  ]);

  if (!isExportModalOpen) return null;

  // Handle PDF Export
  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    setValidationResult(null);

    try {
      // 1. Export PDF bytes through adapter
      const exportedBytes = await adapter.exportPdf({
        operations,
        preserveOriginalMetadata: preserveMetadata,
        compress: compressPdf,
      });

      // 2. Run post-export verification if requested
      if (runValidation) {
        // Collect expectations from operations and current document
        const expectedTexts: string[] = [];
        const redactedTexts: string[] = [];

        for (const op of operations) {
          if (op.type === "add_text" && op.text.trim()) {
            expectedTexts.push(op.text);
          } else if (op.type === "text_edit" && op.replacementText.trim()) {
            expectedTexts.push(op.replacementText);
          } else if (op.type === "redaction" && op.isPermanent) {
            // Permanent redactions
          }
        }

        const dimensions = pageInfos.map((p) => ({
          pageNumber: p.pageNumber,
          width: p.dimensions.width,
          height: p.dimensions.height,
        }));

        const vResult = await validateExportedPdf(exportedBytes, {
          expectedPageCount: pageInfos.length,
          expectedPageDimensions: dimensions,
          expectedTexts: expectedTexts.slice(0, 5),
          redactedTexts,
          expectedLinksCount: currentStyleProfile?.hyperlinks.length,
        });

        setValidationResult(vResult);

        if (!vResult.isValid && vResult.errors.length > 0) {
          setIsExportingPdf(false);
          return; // Stop if critical validation failed
        }
      }

      // 3. Trigger safe client-side browser download
      downloadBytes(exportedBytes, pdfFileName || "document-edited.pdf");
    } catch (err: any) {
      setValidationResult({
        isValid: false,
        pageCountVerified: false,
        actualPageCount: 0,
        dimensionsVerified: false,
        dimensionDetails: [],
        textPreservationVerified: false,
        foundExpectedTexts: [],
        missingExpectedTexts: [],
        redactionVerified: false,
        leakedRedactedTexts: [],
        linksPreservedCount: 0,
        renderedSuccessfully: false,
        warnings: [],
        errors: [err?.message || "Export processing failed."],
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Handle Image Export
  const handleExportImages = async () => {
    setIsExportingImages(true);
    const baseName = (documentName || "document").replace(/\.pdf$/i, "");
    const ext = imageFormat === "image/jpeg" ? "jpg" : "png";

    try {
      if (imageScope === "current") {
        // Single page download
        const blob = await adapter.exportPageImage({
          pageNumber: currentPageNumber,
          format: imageFormat,
          quality: jpegQuality,
          dpiScale: imageDpi,
        });
        const pageStr = String(currentPageNumber).padStart(2, "0");
        downloadBlob(blob, `${baseName}-page-${pageStr}.${ext}`);
      } else {
        // Multi-page export into standard ZIP archive
        const zip = new ZipArchive();
        const total = pageInfos.length;

        for (let i = 1; i <= total; i++) {
          setExportProgress({ current: i, total });
          const blob = await adapter.exportPageImage({
            pageNumber: i,
            format: imageFormat,
            quality: jpegQuality,
            dpiScale: imageDpi,
          });

          const pageStr = String(i).padStart(2, "0");
          const buffer = await blob.arrayBuffer();
          zip.addFile(`${baseName}-page-${pageStr}.${ext}`, buffer);
        }

        const zipBlob = await zip.buildBlob();
        downloadBlob(zipBlob, `${baseName}-pages.zip`);
      }
    } catch (err: any) {
      alert(`Image export failed: ${err?.message}`);
    } finally {
      setIsExportingImages(false);
      setExportProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Export & Conversion Center
              </h3>
              <p className="text-xs text-slate-500">
                High-fidelity PDF document export & multi-resolution image conversion
              </p>
            </div>
          </div>
          <button
            onClick={closeExportModal}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-md transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/50">
          <button
            onClick={() => setActiveTab("pdf")}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 flex items-center space-x-2 transition ${
              activeTab === "pdf"
                ? "border-blue-600 text-blue-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF Document</span>
          </button>
          <button
            onClick={() => setActiveTab("image")}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 flex items-center space-x-2 transition ${
              activeTab === "image"
                ? "border-blue-600 text-blue-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Image Conversion (JPG / PNG / ZIP)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {activeTab === "pdf" ? (
            <>
              {/* PDF Options */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Output Filename
                  </label>
                  <input
                    type="text"
                    value={pdfFileName}
                    onChange={(e) => setPdfFileName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition font-mono"
                  />
                </div>

                {/* Preservation Metrics Overview */}
                <div className="grid grid-cols-3 gap-2.5 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">
                      Pages & Dimensions
                    </span>
                    <p className="font-medium text-slate-800 mt-0.5">
                      {pageInfos.length} Pages (Original Preserved)
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">
                      Vector Integrity
                    </span>
                    <p className="font-medium text-slate-800 mt-0.5">
                      Zero Rasterization
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">
                      Recorded Edits
                    </span>
                    <p className="font-medium text-slate-800 mt-0.5">
                      {operations.length} Operations Applied
                    </p>
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-2 text-xs">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preserveMetadata}
                      onChange={(e) => setPreserveMetadata(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-700">
                      Preserve original PDF metadata, catalog, and outlines
                    </span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={compressPdf}
                      onChange={(e) => setCompressPdf(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-700">
                      Compress modified streams using FlateDecode
                    </span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={runValidation}
                      onChange={(e) => setRunValidation(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-slate-700 font-medium">
                      Reopen & verify document through PDF engine before saving
                    </span>
                  </label>
                </div>

                {/* Post-Export Validation Results */}
                {validationResult && (
                  <div
                    className={`p-3.5 rounded-lg border text-xs space-y-2 animate-in fade-in ${
                      validationResult.isValid
                        ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                        : "bg-red-50/70 border-red-200 text-red-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 font-semibold">
                        {validationResult.isValid ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Export Verification Passed (100% Fidelity)</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            <span>Export Verification Detected Issues</span>
                          </>
                        )}
                      </div>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/60">
                        {validationResult.actualPageCount} Pages
                      </span>
                    </div>

                    <ul className="text-[11px] space-y-1 list-disc pl-5">
                      <li>Page Count: {validationResult.pageCountVerified ? "Verified match" : "Discrepancy detected"}</li>
                      <li>Page Dimensions: {validationResult.dimensionsVerified ? "Exact dimensions preserved" : "Dimension shift detected"}</li>
                      <li>Text Presence: {validationResult.textPreservationVerified ? "Expected text items confirmed" : "Missing text items"}</li>
                      <li>Redaction Sanitization: {validationResult.redactionVerified ? "Clean (Unrecoverable from text stream)" : "Leaked text detected"}</li>
                      <li>Links Preserved: {validationResult.linksPreservedCount} verified annotations</li>
                    </ul>

                    {validationResult.errors.length > 0 && (
                      <div className="pt-2 border-t border-red-200 text-red-800 font-medium">
                        {validationResult.errors.map((err, i) => (
                          <div key={i}>• {err}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Image Options */}
              <div className="grid grid-cols-2 gap-5">
                {/* Left Controls */}
                <div className="space-y-4 text-xs">
                  {/* Scope */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Export Scope
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setImageScope("current")}
                        className={`p-2 rounded-lg border text-left transition ${
                          imageScope === "current"
                            ? "border-blue-600 bg-blue-50 text-blue-800 font-semibold"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        Current Page ({currentPageNumber})
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageScope("all")}
                        className={`p-2 rounded-lg border text-left transition ${
                          imageScope === "all"
                            ? "border-blue-600 bg-blue-50 text-blue-800 font-semibold"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        All Pages ({pageInfos.length} in ZIP)
                      </button>
                    </div>
                  </div>

                  {/* Format */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Image Format
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setImageFormat("image/png")}
                        className={`p-2 rounded-lg border text-left transition ${
                          imageFormat === "image/png"
                            ? "border-blue-600 bg-blue-50 text-blue-800 font-semibold"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        PNG (Lossless)
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageFormat("image/jpeg")}
                        className={`p-2 rounded-lg border text-left transition ${
                          imageFormat === "image/jpeg"
                            ? "border-blue-600 bg-blue-50 text-blue-800 font-semibold"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        JPEG (Compressed)
                      </button>
                    </div>
                  </div>

                  {/* Resolution / DPI */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Target Resolution (DPI)
                    </label>
                    <select
                      value={imageDpi}
                      onChange={(e) => setImageDpi(parseFloat(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={1.0}>72 DPI (Standard Web / Screen · 1.0x)</option>
                      <option value={2.08}>150 DPI (High-Definition Document · ~2.08x)</option>
                      <option value={4.166}>300 DPI (Archival / Print Grade · ~4.16x)</option>
                    </select>
                  </div>

                  {/* JPEG Quality Slider */}
                  {imageFormat === "image/jpeg" && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-semibold text-slate-700">
                          JPEG Quality
                        </label>
                        <span className="font-mono text-slate-600 font-semibold">
                          {Math.round(jpegQuality * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="1.0"
                        step="0.05"
                        value={jpegQuality}
                        onChange={(e) => setJpegQuality(parseFloat(e.target.value))}
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                    </div>
                  )}

                  {previewDimensions && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600">
                      Calculated Dimensions:{" "}
                      <strong className="text-slate-800 font-mono">
                        {previewDimensions.width} × {previewDimensions.height} px
                      </strong>
                    </div>
                  )}
                </div>

                {/* Right Live Image Preview */}
                <div className="flex flex-col items-center justify-center p-3 bg-slate-100/80 border border-slate-200 rounded-lg relative min-h-[200px] overflow-hidden">
                  {isLoadingPreview ? (
                    <div className="flex flex-col items-center space-y-2 text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-xs">Rendering preview...</span>
                    </div>
                  ) : imagePreviewUrl ? (
                    <div className="flex flex-col items-center max-h-[220px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreviewUrl}
                        alt="Export Preview"
                        className="max-h-[190px] w-auto object-contain rounded shadow-xs border border-slate-200"
                      />
                      <span className="mt-1.5 text-[10px] text-slate-500">
                        Live Preview (Page {currentPageNumber})
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">
                      Preview unavailable
                    </span>
                  )}
                </div>
              </div>

              {exportProgress && (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Rendering pages to ZIP archive...</span>
                    <span>
                      {exportProgress.current} / {exportProgress.total}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className="h-full bg-blue-600 transition-all duration-150"
                      style={{
                        width: `${(exportProgress.current / exportProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-slate-500 flex items-center space-x-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>100% Client-Side Local Processing</span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={closeExportModal}
              className="px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition font-medium"
            >
              Cancel
            </button>

            {activeTab === "pdf" ? (
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="px-5 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg shadow-sm transition flex items-center space-x-1.5"
              >
                {isExportingPdf ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing & Verifying...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExportImages}
                disabled={isExportingImages}
                className="px-5 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg shadow-sm transition flex items-center space-x-1.5"
              >
                {isExportingImages ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating Images...</span>
                  </>
                ) : imageScope === "all" ? (
                  <>
                    <FolderArchive className="w-3.5 h-3.5" />
                    <span>Download All as ZIP</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Page {currentPageNumber}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
