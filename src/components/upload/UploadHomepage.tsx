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
  Scissors,
  Minimize2,
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  Presentation,
  Unlock,
  CheckCircle2,
  Sparkles,
  FilePlus2,
  Smartphone,
} from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import {
  createSinglePageSamplePdf,
  createMultiPageSamplePdf,
  createRotatedPageSamplePdf,
} from "@/core/utils/sample-pdfs";
import { ToolCategory, ToolId, ToolDefinition } from "@/core/tools/types";
import { PdfToolsRunnerModal } from "../tools/PdfToolsRunnerModal";

const ALL_TOOLS: ToolDefinition[] = [
  // ROW 1: PRIMARY ESSENTIALS
  {
    id: "edit-pdf",
    title: "Edit PDF Text",
    shortDesc: "Modify existing text, add shapes, whiteout, and annotations in the browser.",
    category: "organize",
    badge: "Native",
    popular: true,
    acceptedFormats: ".pdf",
    color: "blue",
    gradient: "from-blue-600 to-indigo-600",
  },
  {
    id: "merge-pdf",
    title: "Merge PDFs",
    shortDesc: "Combine multiple PDF documents into one unified, perfectly ordered file.",
    category: "organize",
    popular: true,
    acceptedFormats: ".pdf",
    color: "indigo",
    gradient: "from-indigo-600 to-violet-600",
  },
  {
    id: "split-pdf",
    title: "Split / Separate PDF",
    shortDesc: "Extract specific page ranges or split each page into individual documents.",
    category: "organize",
    popular: true,
    acceptedFormats: ".pdf",
    color: "purple",
    gradient: "from-purple-600 to-pink-600",
  },
  {
    id: "compress-pdf",
    title: "Compress PDF",
    shortDesc: "Reduce file size significantly while preserving vector clarity and sharp text.",
    category: "security",
    badge: "-60%",
    popular: true,
    acceptedFormats: ".pdf",
    color: "emerald",
    gradient: "from-emerald-600 to-teal-600",
  },

  // ROW 2: IMAGE CONVERSIONS
  {
    id: "pdf-to-jpg",
    title: "PDF to JPG",
    shortDesc: "Convert each PDF page into high-resolution JPG images with custom DPI.",
    category: "convert-from-pdf",
    acceptedFormats: ".pdf",
    color: "amber",
    gradient: "from-amber-500 to-orange-600",
  },
  {
    id: "pdf-to-png",
    title: "PDF to PNG",
    shortDesc: "Render pages into crisp, lossless PNG images with high pixel fidelity.",
    category: "convert-from-pdf",
    badge: "Lossless",
    acceptedFormats: ".pdf",
    color: "orange",
    gradient: "from-orange-500 to-red-600",
  },
  {
    id: "jpg-to-pdf",
    title: "JPG to PDF",
    shortDesc: "Transform JPG photos and scans into a clean, formatted PDF document.",
    category: "convert-to-pdf",
    acceptedFormats: "image/jpeg,image/jpg",
    color: "amber",
    gradient: "from-amber-600 to-yellow-600",
  },
  {
    id: "images-to-pdf",
    title: "PNG & Images to PDF",
    shortDesc: "Convert multiple PNG, WebP, or BMP images into a multi-page PDF.",
    category: "convert-to-pdf",
    acceptedFormats: "image/*",
    color: "rose",
    gradient: "from-rose-500 to-pink-600",
  },

  // ROW 3: OFFICE & DOCUMENTS
  {
    id: "pdf-to-word",
    title: "PDF to Word (.docx)",
    shortDesc: "Extract text flow, paragraphs, and headings into editable Microsoft Word format.",
    category: "convert-from-pdf",
    badge: "OOXML",
    popular: true,
    acceptedFormats: ".pdf",
    color: "sky",
    gradient: "from-sky-600 to-blue-700",
  },
  {
    id: "pdf-to-excel",
    title: "PDF to Excel (.xlsx)",
    shortDesc: "Detect and extract data tables into Excel spreadsheets or clean CSV files.",
    category: "convert-from-pdf",
    acceptedFormats: ".pdf",
    color: "emerald",
    gradient: "from-emerald-500 to-green-700",
  },
  {
    id: "pdf-to-ppt",
    title: "PDF to PowerPoint",
    shortDesc: "Convert PDF pages into presentation slides ready to present or share.",
    category: "convert-from-pdf",
    acceptedFormats: ".pdf",
    color: "red",
    gradient: "from-red-500 to-amber-600",
  },
  {
    id: "word-to-pdf",
    title: "Word & Text to PDF",
    shortDesc: "Convert text or Office documents directly into a formatted PDF document.",
    category: "convert-to-pdf",
    acceptedFormats: ".txt,.docx,.md",
    color: "blue",
    gradient: "from-blue-500 to-cyan-600",
  },

  // ROW 4: SECURITY & ACCESS
  {
    id: "protect-pdf",
    title: "Add Password",
    shortDesc: "Secure and encrypt your PDF document with client-side password protection.",
    category: "security",
    badge: "AES-256",
    acceptedFormats: ".pdf",
    color: "violet",
    gradient: "from-violet-600 to-purple-800",
  },
  {
    id: "unlock-pdf",
    title: "Unlock PDF",
    shortDesc: "Remove password security from your document and export an open PDF.",
    category: "security",
    acceptedFormats: ".pdf",
    color: "teal",
    gradient: "from-teal-600 to-emerald-700",
  },
  {
    id: "excel-to-pdf",
    title: "Excel / CSV to PDF",
    shortDesc: "Convert tables and CSV spreadsheets into formatted, styled PDF pages.",
    category: "convert-to-pdf",
    acceptedFormats: ".csv,.xlsx",
    color: "green",
    gradient: "from-green-600 to-teal-700",
  },
];

export const UploadHomepage: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ToolCategory>("all");
  const [activeRunnerTool, setActiveRunnerTool] = useState<ToolId | null>(null);

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
      alert("Please upload a valid PDF document to open in editor.");
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

  const handleToolClick = (tool: ToolDefinition) => {
    if (tool.id === "edit-pdf") {
      fileInputRef.current?.click();
    } else {
      setActiveRunnerTool(tool.id);
    }
  };

  const filteredTools =
    activeCategory === "all"
      ? ALL_TOOLS
      : ALL_TOOLS.filter((t) => t.category === activeCategory);

  const getToolIcon = (id: ToolId) => {
    switch (id) {
      case "edit-pdf":
        return Sparkles;
      case "merge-pdf":
        return Layers;
      case "split-pdf":
        return Scissors;
      case "compress-pdf":
        return Minimize2;
      case "pdf-to-jpg":
      case "pdf-to-png":
      case "jpg-to-pdf":
      case "png-to-pdf":
      case "images-to-pdf":
        return ImageIcon;
      case "pdf-to-word":
      case "word-to-pdf":
        return FileText;
      case "pdf-to-excel":
      case "excel-to-pdf":
        return FileSpreadsheet;
      case "pdf-to-ppt":
        return Presentation;
      case "protect-pdf":
        return Lock;
      case "unlock-pdf":
        return Unlock;
      default:
        return FileText;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 relative overflow-y-auto min-h-screen">
      {/* Interactive Tool Runner Modal */}
      <PdfToolsRunnerModal
        toolId={activeRunnerTool}
        onClose={() => setActiveRunnerTool(null)}
      />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/85 border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between transition-all">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <span className="font-extrabold text-sm tracking-tight">PS</span>
          </div>
          <div>
            <span className="font-bold text-slate-900 text-sm sm:text-base tracking-tight block leading-tight">
              PDF Studio
            </span>
            <span className="text-[10px] text-slate-400 font-medium hidden sm:block">
              Client-Side Suite
            </span>
          </div>
        </div>

        {/* Center Privacy Badge */}
        <div className="hidden md:inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>100% In-Browser • Zero Cloud Uploads</span>
        </div>

        {/* Right Action */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition flex items-center space-x-1.5"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>Open PDF</span>
          </button>
        </div>
      </header>

      {/* Error Alert */}
      {errorMessage && (
        <div className="max-w-2xl mx-auto mt-4 px-4 w-full">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-xs flex items-start space-x-3 text-red-800 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-semibold text-red-900 mb-0.5">Failed to open file</p>
              <p className="text-red-700">{errorMessage}</p>
            </div>
            <button onClick={clearError} className="text-red-500 hover:text-red-700 font-bold text-sm px-1">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12 flex flex-col items-center">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium mb-4 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Complete PDF Editor & Conversion Suite</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight mb-3 sm:mb-4 leading-tight">
            Every PDF Tool You Need. <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              100% Private in Your Browser.
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl mx-auto">
            Directly edit original text, convert to Word, Excel, JPG, compress, split, merge, and protect PDFs without uploading your files anywhere.
          </p>
        </div>

        {/* Dropzone Card */}
        <div className="w-full max-w-2xl mb-12">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full bg-white rounded-2xl border-2 border-dashed p-8 sm:p-10 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md flex flex-col items-center justify-center relative overflow-hidden ${
              isDragging
                ? "border-blue-500 bg-blue-50/50 scale-[1.01] shadow-lg"
                : "border-slate-300 hover:border-blue-400"
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
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mb-4 transition ${
                isDragging
                  ? "bg-blue-600 text-white scale-110 shadow-lg shadow-blue-500/30"
                  : "bg-blue-50 text-blue-600"
              }`}
            >
              <UploadCloud className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>

            <h3 className="text-base sm:text-lg font-bold text-slate-800 mb-1">
              Select PDF file or drop it here
            </h3>
            <p className="text-xs text-slate-500 mb-5 text-center">
              Opens instantly in the high-fidelity PDF Studio Editor
            </p>

            <button
              type="button"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-600/20 transition flex items-center space-x-2"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Choose Local PDF</span>
            </button>

            {isLoading && (
              <div className="w-full max-w-xs mt-6">
                <div className="flex justify-between text-xs text-slate-600 mb-1 font-medium">
                  <span>Loading & analyzing document...</span>
                  <span className="font-mono">{loadingProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-200"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Quick Sample Launchers */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
            <span className="text-[11px] font-medium text-slate-400">Or test right now:</span>
            <button
              onClick={() => loadSample("single")}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-[11px] font-medium transition"
            >
              Single Page
            </button>
            <button
              onClick={() => loadSample("multi")}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-[11px] font-medium transition"
            >
              Multi-Page (5 Pgs)
            </button>
            <button
              onClick={() => loadSample("rotated")}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-[11px] font-medium transition"
            >
              Rotated Document
            </button>
          </div>
        </div>

        {/* Tools Suite Navigation Tabs */}
        <section className="w-full space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                All PDF Tools
              </h2>
              <p className="text-xs text-slate-500">
                Click any tool to convert, optimize, or reorganize your documents.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 text-xs self-start sm:self-auto">
              <button
                onClick={() => setActiveCategory("all")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  activeCategory === "all"
                    ? "bg-white text-blue-600 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Tools
              </button>
              <button
                onClick={() => setActiveCategory("convert-from-pdf")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  activeCategory === "convert-from-pdf"
                    ? "bg-white text-blue-600 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                From PDF
              </button>
              <button
                onClick={() => setActiveCategory("convert-to-pdf")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  activeCategory === "convert-to-pdf"
                    ? "bg-white text-blue-600 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                To PDF
              </button>
              <button
                onClick={() => setActiveCategory("organize")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  activeCategory === "organize"
                    ? "bg-white text-blue-600 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Organize
              </button>
              <button
                onClick={() => setActiveCategory("security")}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  activeCategory === "security"
                    ? "bg-white text-blue-600 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Security & Size
              </button>
            </div>
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredTools.map((tool) => {
              const Icon = getToolIcon(tool.id);
              return (
                <div
                  key={tool.id}
                  onClick={() => handleToolClick(tool)}
                  className="group bg-white rounded-2xl border border-slate-200/90 hover:border-blue-400 p-5 cursor-pointer shadow-xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between relative overflow-hidden"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${tool.gradient} text-white flex items-center justify-center shadow-md transition-transform group-hover:scale-105`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      {tool.badge && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                          {tool.badge}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors flex items-center justify-between">
                        <span>{tool.title}</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {tool.shortDesc}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-blue-600">
                    <span className="group-hover:translate-x-0.5 transition-transform">Use Tool</span>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-500 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Client-Side Advantage Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 text-left w-full pt-12 border-t border-slate-200">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-2.5 shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <Lock className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">100% Confidential</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your sensitive contracts, medical records, and financial statements never leave your computer. All operations execute inside your browser sandbox.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-2.5 shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Layers className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Format Preservation</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Unlike ordinary web tools that flatten pages into low-res bitmaps, PDF Studio preserves original vector glyphs, embedded fonts, and clickable hyperlinks.
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-2.5 shadow-2xs">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <Zap className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Zero Limits & Instant</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              No waiting for file uploads or downloads over slow networks. Process large PDFs up to 250MB instantly with multi-threaded Web Workers.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6 px-4 text-center text-xs text-slate-400">
        <p>PDF Studio • High-Fidelity Client-Side PDF Platform • 100% Free & Open Source</p>
      </footer>
    </div>
  );
};
