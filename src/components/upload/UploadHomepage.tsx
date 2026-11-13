"use client";

import React, { useRef, useState } from "react";
import {
  UploadCloud,
  FileCheck2,
  ShieldCheck,
  Zap,
  Lock,
  Layers,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import {
  createSinglePageSamplePdf,
  createMultiPageSamplePdf,
  createRotatedPageSamplePdf,
} from "@/core/utils/sample-pdfs";

export const UploadHomepage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { loadDocumentBytes, isLoading, loadingProgress, errorMessage, clearError } =
    useEditorStore();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      await loadDocumentBytes(buffer, file.name);
    } catch {
      // Handled in store
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      alert("Please upload a valid PDF document.");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      await loadDocumentBytes(buffer, file.name);
    } catch {
      // Handled in store
    }
  };

  const loadSample = async (type: "single" | "multi" | "rotated") => {
    try {
      let buffer: ArrayBuffer;
      let name: string;
      if (type === "single") {
        buffer = await createSinglePageSamplePdf();
        name = "Sample-SinglePage.pdf";
      } else if (type === "multi") {
        buffer = await createMultiPageSamplePdf();
        name = "Sample-MultiPage.pdf";
      } else {
        buffer = await createRotatedPageSamplePdf();
        name = "Sample-RotatedPages.pdf";
      }
      await loadDocumentBytes(buffer, name);
    } catch {
      // Handled in store
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 relative overflow-y-auto">
      {errorMessage && (
        <div className="absolute top-6 max-w-md w-full bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm flex items-start space-x-3 text-red-800 animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs">
            <p className="font-semibold text-red-900 mb-0.5">Failed to open file</p>
            <p className="text-red-700">{errorMessage}</p>
          </div>
          <button
            onClick={clearError}
            className="text-red-500 hover:text-red-700 font-bold text-sm px-1"
          >
            ✕
          </button>
        </div>
      )}

      <div className="max-w-2xl w-full flex flex-col items-center text-center">
        {/* Brand Header */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-700 text-xs font-medium mb-6">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>100% Client-Side Processing • Zero Server Uploads</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
          Professional PDF Studio
        </h1>
        <p className="text-sm text-slate-600 max-w-lg mb-8 leading-relaxed">
          High-accuracy browser-only PDF editor designed to preserve original formatting, fonts,
          vector graphics, and hyperlinks without flattening pages.
        </p>

        {/* Drag-and-drop Card */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full bg-white rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all duration-200 shadow-sm flex flex-col items-center justify-center ${
            isDragging
              ? "border-blue-500 bg-blue-50/50 scale-[1.01] shadow-md"
              : "border-slate-300 hover:border-blue-400 hover:shadow-md"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,application/pdf"
            className="hidden"
          />

          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition ${
              isDragging ? "bg-blue-600 text-white scale-110" : "bg-blue-50 text-blue-600"
            }`}
          >
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-base font-semibold text-slate-800 mb-1">
            Choose a PDF file or drag it here
          </h3>
          <p className="text-xs text-slate-500 mb-6">
            Supports standard PDF documents (v1.0 - v2.0) up to 250MB
          </p>

          <button
            type="button"
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-sm transition flex items-center space-x-2"
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Select Local PDF</span>
          </button>

          {isLoading && (
            <div className="w-full max-w-xs mt-6">
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>Loading & parsing document...</span>
                <span className="font-mono">{loadingProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Instant Test Samples */}
        <div className="mt-8 pt-6 border-t border-slate-200/80 w-full">
          <div className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wider">
            Or test instantly with in-browser sample documents
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => loadSample("single")}
              className="p-3 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 rounded-xl text-left transition flex items-center justify-between group shadow-2xs"
            >
              <div>
                <span className="block text-xs font-semibold text-slate-800 group-hover:text-blue-600">
                  Single-Page PDF
                </span>
                <span className="text-[11px] text-slate-500">Fast baseline test</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
            </button>

            <button
              onClick={() => loadSample("multi")}
              className="p-3 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 rounded-xl text-left transition flex items-center justify-between group shadow-2xs"
            >
              <div>
                <span className="block text-xs font-semibold text-slate-800 group-hover:text-blue-600">
                  Multi-Page PDF (5 pgs)
                </span>
                <span className="text-[11px] text-slate-500">Thumbnails & scrolling</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
            </button>

            <button
              onClick={() => loadSample("rotated")}
              className="p-3 bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 rounded-xl text-left transition flex items-center justify-between group shadow-2xs"
            >
              <div>
                <span className="block text-xs font-semibold text-slate-800 group-hover:text-blue-600">
                  Rotated Pages
                </span>
                <span className="text-[11px] text-slate-500">0°, 90°, 180° rotations</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition" />
            </button>
          </div>
        </div>

        {/* Feature Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-10 text-left w-full">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-800">100% Private</h4>
              <p className="text-[11px] text-slate-500">
                Documents stay inside your browser tab memory. No cloud storage or server transfer.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-800">Format Preservation</h4>
              <p className="text-[11px] text-slate-500">
                Preserves embedded fonts, vector paths, page dimensions, and hyperlinks intact.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-800">High-DPI Rendering</h4>
              <p className="text-[11px] text-slate-500">
                Powered by Mozilla PDF.js with device pixel ratio scaling for crisp typography.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
