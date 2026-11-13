"use client";

import React, { useState, useRef } from "react";
import {
  X,
  Layers,
  RotateCw,
  Trash2,
  ArrowUp,
  ArrowDown,
  Plus,
  Combine,
  FileOutput,
  Scissors,
  Check,
  Upload,
  Loader2,
} from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import {
  reorderPages,
  extractPages,
  mergePdfs,
  splitPdf,
} from "@/core/page-manager/page-manager";
import { downloadBytes, downloadBlob } from "@/core/utils/download";
import { ZipArchive } from "@/core/utils/zip-archive";

export const PageManagerModal: React.FC = () => {
  const {
    isPageManagerOpen,
    closePageManager,
    pageInfos,
    currentPageNumber,
    setCurrentPage,
    documentName,
    rawBytes,
    loadDocumentBytes,
    executeAddOperation,
  } = useEditorStore();

  const [activeTab, setActiveTab] = useState<"organize" | "merge" | "extract" | "split">("organize");

  // Extract State
  const [extractRangeStr, setExtractRangeStr] = useState("1");
  const [isExtracting, setIsExtracting] = useState(false);

  // Split State
  const [splitRangesStr, setSplitRangesStr] = useState("1-2, 3-5");
  const [isSplitting, setIsSplitting] = useState(false);

  // Merge State
  const [mergeFile, setMergeFile] = useState<File | null>(null);
  const [mergeInsertPosition, setMergeInsertPosition] = useState<"end" | "current">("end");
  const [isMerging, setIsMerging] = useState(false);
  const mergeInputRef = useRef<HTMLInputElement>(null);

  if (!isPageManagerOpen) return null;

  // Handle Page Rotate
  const handleRotatePage = async (pageNumber: number) => {
    await executeAddOperation({
      id: `rotate-${Date.now()}`,
      pageNumber,
      timestamp: Date.now(),
      type: "page_rotate",
      rotationDegrees: 90,
    });
  };

  // Handle Page Delete
  const handleDeletePage = async (pageNumber: number) => {
    if (pageInfos.length <= 1) {
      alert("Cannot delete the only page in the document.");
      return;
    }
    await executeAddOperation({
      id: `delete-${Date.now()}`,
      pageNumber,
      timestamp: Date.now(),
      type: "page_delete",
    });
  };

  // Handle Add Blank Page
  const handleAddBlankPage = async () => {
    await executeAddOperation({
      id: `add-page-${Date.now()}`,
      type: "add_page",
      timestamp: Date.now(),
      insertAtIndex: pageInfos.length,
      dimensions: { width: 595.28, height: 841.89 },
    });
  };

  // Handle Extract Pages
  const handleExtractPages = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawBytes) return;

    setIsExtracting(true);
    try {
      // Parse range string (e.g. "1, 3-5")
      const pagesToExtract: number[] = [];
      const parts = extractRangeStr.split(",");
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes("-")) {
          const [startStr, endStr] = trimmed.split("-");
          const start = parseInt(startStr, 10);
          const end = parseInt(endStr, 10);
          for (let p = start; p <= end; p++) {
            if (p >= 1 && p <= pageInfos.length && !pagesToExtract.includes(p)) {
              pagesToExtract.push(p);
            }
          }
        } else {
          const p = parseInt(trimmed, 10);
          if (p >= 1 && p <= pageInfos.length && !pagesToExtract.includes(p)) {
            pagesToExtract.push(p);
          }
        }
      }

      if (pagesToExtract.length === 0) {
        alert("Please enter valid page numbers.");
        return;
      }

      const extractedBytes = await extractPages(rawBytes, pagesToExtract);
      const base = (documentName || "document").replace(/\.pdf$/i, "");
      downloadBytes(extractedBytes, `${base}-extracted.pdf`);
    } catch (err: any) {
      alert(`Page extraction failed: ${err?.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Handle Merge PDFs
  const handleMergePdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawBytes || !mergeFile) return;

    setIsMerging(true);
    try {
      const otherBuffer = await mergeFile.arrayBuffer();
      const insertIdx =
        mergeInsertPosition === "current" ? currentPageNumber : undefined;
      const mergedBytes = await mergePdfs(rawBytes, otherBuffer, insertIdx);

      // Reload merged document directly into workspace
      await loadDocumentBytes(mergedBytes.buffer as ArrayBuffer, documentName || "document.pdf");
      closePageManager();
    } catch (err: any) {
      alert(`Merge failed: ${err?.message}`);
    } finally {
      setIsMerging(false);
    }
  };

  // Handle Split PDF
  const handleSplitPdf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawBytes) return;

    setIsSplitting(true);
    try {
      // Parse split ranges (e.g. "1-2, 3-5")
      const ranges: { startPage: number; endPage: number }[] = [];
      const parts = splitRangesStr.split(",");
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes("-")) {
          const [s, end] = trimmed.split("-").map((n) => parseInt(n.trim(), 10));
          if (!isNaN(s) && !isNaN(end) && s <= end) {
            ranges.push({ startPage: s, endPage: end });
          }
        } else {
          const p = parseInt(trimmed, 10);
          if (!isNaN(p)) {
            ranges.push({ startPage: p, endPage: p });
          }
        }
      }

      if (ranges.length === 0) {
        alert("Please enter valid split page ranges.");
        return;
      }

      const splitResults = await splitPdf(rawBytes, ranges);
      const zip = new ZipArchive();
      const base = (documentName || "document").replace(/\.pdf$/i, "");

      for (const item of splitResults) {
        zip.addFile(`${base}-${item.range}.pdf`, item.bytes);
      }

      const zipBlob = await zip.buildBlob();
      downloadBlob(zipBlob, `${base}-split-parts.zip`);
    } catch (err: any) {
      alert(`Split failed: ${err?.message}`);
    } finally {
      setIsSplitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Document Page Management
              </h3>
              <p className="text-xs text-slate-500">
                Reorder, rotate, delete, extract, merge, and split PDF pages
              </p>
            </div>
          </div>
          <button
            onClick={closePageManager}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-md transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/50">
          <button
            onClick={() => setActiveTab("organize")}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition ${
              activeTab === "organize"
                ? "border-blue-600 text-blue-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Organize ({pageInfos.length} Pages)</span>
          </button>
          <button
            onClick={() => setActiveTab("merge")}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition ${
              activeTab === "merge"
                ? "border-blue-600 text-blue-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Combine className="w-3.5 h-3.5" />
            <span>Merge Documents</span>
          </button>
          <button
            onClick={() => setActiveTab("extract")}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition ${
              activeTab === "extract"
                ? "border-blue-600 text-blue-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <FileOutput className="w-3.5 h-3.5" />
            <span>Extract Pages</span>
          </button>
          <button
            onClick={() => setActiveTab("split")}
            className={`py-2.5 px-4 text-xs font-semibold border-b-2 flex items-center space-x-1.5 transition ${
              activeTab === "split"
                ? "border-blue-600 text-blue-600 bg-white"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Split Document</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {activeTab === "organize" && (
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-slate-700">
                  Page Layout & Structure
                </span>
                <button
                  type="button"
                  onClick={handleAddBlankPage}
                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center space-x-1 shadow-xs transition font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Blank Page</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto p-1">
                {pageInfos.map((page) => (
                  <div
                    key={page.pageNumber}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">
                        Page {page.pageNumber}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {Math.round(page.dimensions.width)} × {Math.round(page.dimensions.height)} pt · {page.rotation}°
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => handleRotatePage(page.pageNumber)}
                        title="Rotate 90° Clockwise"
                        className="p-1.5 text-slate-600 hover:bg-slate-200 rounded transition"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePage(page.pageNumber)}
                        disabled={pageInfos.length <= 1}
                        title="Delete Page"
                        className="p-1.5 text-red-600 hover:bg-red-100 rounded disabled:opacity-30 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "merge" && (
            <form onSubmit={handleMergePdf} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Secondary PDF Document
                </label>
                <div
                  onClick={() => mergeInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer bg-slate-50 hover:bg-blue-50/30 transition"
                >
                  <Upload className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="font-medium text-slate-700">
                    {mergeFile ? mergeFile.name : "Click to select a PDF file to merge"}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    {mergeFile ? `${Math.round(mergeFile.size / 1024)} KB` : "Supports standard PDF files"}
                  </span>
                </div>
                <input
                  type="file"
                  ref={mergeInputRef}
                  accept="application/pdf"
                  onChange={(e) => setMergeFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Merge Position
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMergeInsertPosition("end")}
                    className={`p-2.5 rounded-lg border text-left transition ${
                      mergeInsertPosition === "end"
                        ? "border-blue-600 bg-blue-50 text-blue-800 font-semibold"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    Append to End of Document
                  </button>
                  <button
                    type="button"
                    onClick={() => setMergeInsertPosition("current")}
                    className={`p-2.5 rounded-lg border text-left transition ${
                      mergeInsertPosition === "current"
                        ? "border-blue-600 bg-blue-50 text-blue-800 font-semibold"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    Insert after Current Page ({currentPageNumber})
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={!mergeFile || isMerging}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium shadow-xs transition flex items-center justify-center space-x-1.5"
              >
                {isMerging ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Merging PDF Documents...</span>
                  </>
                ) : (
                  <>
                    <Combine className="w-4 h-4" />
                    <span>Merge and Load into Editor</span>
                  </>
                )}
              </button>
            </form>
          )}

          {activeTab === "extract" && (
            <form onSubmit={handleExtractPages} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Page Selection to Extract
                </label>
                <input
                  type="text"
                  value={extractRangeStr}
                  onChange={(e) => setExtractRangeStr(e.target.value)}
                  placeholder="e.g. 1, 3-5"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Enter comma-separated page numbers or ranges (Total pages: {pageInfos.length})
                </span>
              </div>

              <button
                type="submit"
                disabled={isExtracting}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium shadow-xs transition flex items-center justify-center space-x-1.5"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Extracting Selected Pages...</span>
                  </>
                ) : (
                  <>
                    <FileOutput className="w-4 h-4" />
                    <span>Extract to New PDF Download</span>
                  </>
                )}
              </button>
            </form>
          )}

          {activeTab === "split" && (
            <form onSubmit={handleSplitPdf} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Split Document by Page Ranges
                </label>
                <input
                  type="text"
                  value={splitRangesStr}
                  onChange={(e) => setSplitRangesStr(e.target.value)}
                  placeholder="e.g. 1-2, 3-5"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Define discrete page groups separated by commas. Each group compiles into an individual PDF inside a ZIP archive.
                </span>
              </div>

              <button
                type="submit"
                disabled={isSplitting}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium shadow-xs transition flex items-center justify-center space-x-1.5"
              >
                {isSplitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Splitting and Compressing...</span>
                  </>
                ) : (
                  <>
                    <Scissors className="w-4 h-4" />
                    <span>Split and Download ZIP Archive</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={closePageManager}
            className="px-4 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg transition font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
