"use client";

import React, { useRef, useState, useEffect } from "react";
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
  Sparkles,
  FilePlus2,
  Search,
  X,
  Clock,
  CheckCircle2,
  FileCode2,
  Command,
  HelpCircle,
  FolderOpen,
  ArrowUpRight,
  ArrowLeft,
} from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import {
  createSinglePageSamplePdf,
  createMultiPageSamplePdf,
  createRotatedPageSamplePdf,
} from "@/core/utils/sample-pdfs";
import { ToolCategory, ToolId, ToolDefinition } from "@/core/tools/types";
import { PdfToolsRunnerModal } from "../tools/PdfToolsRunnerModal";
import { loadDocumentSession } from "@/core/persistence/document-persistence";

const ALL_TOOLS: (ToolDefinition & { keywords?: string[] })[] = [
  // ROW 1: PRIMARY ESSENTIALS
  {
    id: "edit-pdf",
    title: "Edit PDF Text",
    shortDesc: "Directly modify original text, add shapes, whiteout, annotations, and signatures.",
    category: "organize",
    badge: "Native Engine",
    popular: true,
    acceptedFormats: ".pdf",
    color: "blue",
    gradient: "from-blue-600 to-indigo-600",
    keywords: ["edit", "text", "modify", "write", "change", "annotate", "type"],
  },
  {
    id: "merge-pdf",
    title: "Merge PDFs",
    shortDesc: "Combine multiple PDF files into one unified, perfectly ordered document.",
    category: "organize",
    badge: "Fast Combine",
    popular: true,
    acceptedFormats: ".pdf",
    color: "indigo",
    gradient: "from-indigo-600 to-violet-600",
    keywords: ["merge", "combine", "join", "unite", "append"],
  },
  {
    id: "split-pdf",
    title: "Split / Extract PDF",
    shortDesc: "Extract custom page ranges or separate all pages into individual PDF files.",
    category: "organize",
    badge: "Page Ranges",
    popular: true,
    acceptedFormats: ".pdf",
    color: "purple",
    gradient: "from-purple-600 to-pink-600",
    keywords: ["split", "extract", "separate", "pages", "divide", "range"],
  },
  {
    id: "compress-pdf",
    title: "Compress PDF",
    shortDesc: "Reduce file size up to 70% while preserving sharp typography and vector assets.",
    category: "security",
    badge: "-60% Avg",
    popular: true,
    acceptedFormats: ".pdf",
    color: "emerald",
    gradient: "from-emerald-600 to-teal-600",
    keywords: ["compress", "reduce", "size", "shrink", "optimize", "minify"],
  },

  // ROW 2: OFFICE & DOCUMENT CONVERSIONS
  {
    id: "pdf-to-word",
    title: "PDF to Word (.docx)",
    shortDesc: "Extract continuous paragraphs, tables, and typography into editable Microsoft Word format.",
    category: "convert-from-pdf",
    badge: "OOXML Standard",
    popular: true,
    acceptedFormats: ".pdf",
    color: "sky",
    gradient: "from-sky-600 to-blue-700",
    keywords: ["word", "docx", "doc", "microsoft", "office", "editable"],
  },
  {
    id: "pdf-to-excel",
    title: "PDF to Excel (.xlsx)",
    shortDesc: "Detect and extract data tables into Excel workbooks or clean structured CSVs.",
    category: "convert-from-pdf",
    badge: "Table Extract",
    acceptedFormats: ".pdf",
    color: "emerald",
    gradient: "from-emerald-500 to-green-700",
    keywords: ["excel", "xlsx", "csv", "spreadsheet", "table", "data", "sheets"],
  },
  {
    id: "pdf-to-ppt",
    title: "PDF to PowerPoint",
    shortDesc: "Transform pages into editable presentation slides ready to present or share.",
    category: "convert-from-pdf",
    acceptedFormats: ".pdf",
    color: "red",
    gradient: "from-red-500 to-amber-600",
    keywords: ["powerpoint", "ppt", "pptx", "slides", "presentation", "keynote"],
  },
  {
    id: "word-to-pdf",
    title: "Word & Text to PDF",
    shortDesc: "Convert rich text, markdown, or Office documents directly into standard PDF format.",
    category: "convert-to-pdf",
    acceptedFormats: ".txt,.docx,.md",
    color: "blue",
    gradient: "from-blue-500 to-cyan-600",
    keywords: ["convert", "text", "markdown", "word", "create"],
  },

  // ROW 3: IMAGE CONVERSIONS
  {
    id: "pdf-to-jpg",
    title: "PDF to JPG",
    shortDesc: "Convert each PDF page into high-resolution JPG images with custom DPI settings.",
    category: "convert-from-pdf",
    acceptedFormats: ".pdf",
    color: "amber",
    gradient: "from-amber-500 to-orange-600",
    keywords: ["jpg", "jpeg", "image", "photo", "convert"],
  },
  {
    id: "pdf-to-png",
    title: "PDF to PNG",
    shortDesc: "Render pages into crisp, lossless PNG images with pixel-perfect vector clarity.",
    category: "convert-from-pdf",
    badge: "Lossless",
    acceptedFormats: ".pdf",
    color: "orange",
    gradient: "from-orange-500 to-red-600",
    keywords: ["png", "lossless", "image", "transparent", "photo"],
  },
  {
    id: "jpg-to-pdf",
    title: "JPG to PDF",
    shortDesc: "Transform photos, receipts, and scans into a clean, formatted PDF document.",
    category: "convert-to-pdf",
    acceptedFormats: "image/jpeg,image/jpg",
    color: "amber",
    gradient: "from-amber-600 to-yellow-600",
    keywords: ["photo", "scan", "receipt", "jpg", "jpeg"],
  },
  {
    id: "images-to-pdf",
    title: "PNG & Images to PDF",
    shortDesc: "Combine multiple PNG, WebP, or SVG graphics into a multi-page PDF.",
    category: "convert-to-pdf",
    acceptedFormats: "image/*",
    color: "rose",
    gradient: "from-rose-500 to-pink-600",
    keywords: ["images", "gallery", "portfolio", "webp", "combine"],
  },

  // ROW 4: SECURITY & STRUCTURAL
  {
    id: "protect-pdf",
    title: "Protect with Password",
    shortDesc: "Encrypt your PDF document with AES-256 client-side cryptographic security.",
    category: "security",
    badge: "AES-256",
    acceptedFormats: ".pdf",
    color: "violet",
    gradient: "from-violet-600 to-purple-800",
    keywords: ["password", "lock", "encrypt", "protect", "security", "aes"],
  },
  {
    id: "unlock-pdf",
    title: "Unlock PDF",
    shortDesc: "Remove password security restrictions and export an open document.",
    category: "security",
    acceptedFormats: ".pdf",
    color: "teal",
    gradient: "from-teal-600 to-emerald-700",
    keywords: ["unlock", "decrypt", "remove password", "open"],
  },
  {
    id: "excel-to-pdf",
    title: "Excel / CSV to PDF",
    shortDesc: "Format tables, financial figures, and CSV datasets into styled PDF reports.",
    category: "convert-to-pdf",
    acceptedFormats: ".csv,.xlsx",
    color: "green",
    gradient: "from-green-600 to-teal-700",
    keywords: ["table", "csv", "excel", "sheets", "accounting"],
  },
];

interface UploadHomepageProps {
  onBackToLanding?: () => void;
}

export const UploadHomepage: React.FC<UploadHomepageProps> = ({ onBackToLanding }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeCategory, setActiveCategory] = useState<ToolCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRunnerTool, setActiveRunnerTool] = useState<ToolId | null>(null);

  // Resume session check
  const [recentSession, setRecentSession] = useState<{
    documentName: string;
    timestamp: number;
    currentPageNumber: number;
  } | null>(null);

  const {
    loadDocumentBytes,
    isLoading,
    loadingProgress,
    errorMessage,
    clearError,
    restoreSession,
    showToast,
  } = useEditorStore();

  useEffect(() => {
    let isCancelled = false;
    loadDocumentSession().then((session) => {
      if (!isCancelled && session && session.rawBytes && session.rawBytes.byteLength > 0) {
        setRecentSession({
          documentName: session.documentName,
          timestamp: session.timestamp,
          currentPageNumber: session.currentPageNumber || 1,
        });
      }
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  // Keyboard shortcut Ctrl+O / Cmd+O to open file dialog and / to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        fileInputRef.current?.click();
      } else if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
      alert("Please upload a valid PDF document to open in PDF Studio.");
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
        name = "Sample-InvoiceContract.pdf";
      } else if (type === "multi") {
        buffer = await createMultiPageSamplePdf();
        name = "Sample-AnnualReport.pdf";
      } else {
        buffer = await createRotatedPageSamplePdf();
        name = "Sample-RotatedPresentation.pdf";
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

  // Filter tools by category and search query
  const query = searchQuery.trim().toLowerCase();
  const filteredTools = ALL_TOOLS.filter((tool) => {
    const matchesCategory = activeCategory === "all" || tool.category === activeCategory;
    if (!matchesCategory) return false;
    if (!query) return true;

    return (
      tool.title.toLowerCase().includes(query) ||
      tool.shortDesc.toLowerCase().includes(query) ||
      tool.category.toLowerCase().includes(query) ||
      tool.badge?.toLowerCase().includes(query) ||
      tool.keywords?.some((k) => k.toLowerCase().includes(query))
    );
  });

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
    <div className="flex-1 flex flex-col bg-[#0B0F17] text-slate-100 min-h-screen relative overflow-y-auto selection:bg-blue-500/30 selection:text-blue-200">
      {/* Ambient background glow accents */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-blue-600/15 via-indigo-600/10 to-transparent blur-[140px] rounded-full" />
        <div className="absolute top-1/3 -left-40 w-[600px] h-[600px] bg-blue-500/5 blur-[160px] rounded-full" />
        <div className="absolute top-2/3 -right-40 w-[600px] h-[600px] bg-indigo-500/5 blur-[160px] rounded-full" />
      </div>

      {/* Interactive Tool Runner Modal */}
      <PdfToolsRunnerModal
        toolId={activeRunnerTool}
        onClose={() => setActiveRunnerTool(null)}
      />

      {/* Top Application Navbar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0B0F17]/85 border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between transition-all">
        <div className="flex items-center space-x-3.5">
          {onBackToLanding && (
            <button
              onClick={onBackToLanding}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700/80 transition flex items-center space-x-1.5 cursor-pointer mr-1"
              title="Return to Overview / Landing Page"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Overview</span>
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 border border-white/20">
            <span className="font-black text-sm tracking-tight">PS</span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-white text-base tracking-tight">
                PDF Studio
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                PRO SUITE
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium hidden sm:block">
              Client-Side WebAssembly Workspace
            </span>
          </div>
        </div>

        {/* Center Live Privacy Status Badge */}
        <div className="hidden md:inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>100% In-Browser Sandbox • Zero Data Uploads</span>
        </div>

        {/* Right CTA */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all flex items-center space-x-2 border border-white/10 active:scale-95 cursor-pointer"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>Open Document</span>
            <span className="hidden sm:inline-block ml-1 px-1.5 py-0.2 rounded bg-black/30 text-[10px] text-blue-200 font-mono">
              ⌘O
            </span>
          </button>
        </div>
      </header>

      {/* Error Alert Notice */}
      {errorMessage && (
        <div className="max-w-3xl mx-auto mt-6 px-4 w-full relative z-10 animate-fade-in">
          <div className="bg-red-950/60 border border-red-800/80 rounded-2xl p-4 shadow-xl flex items-start space-x-3.5 text-red-200 backdrop-blur-md">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-bold text-red-100 text-sm mb-1">Failed to open document</p>
              <p className="text-red-300 leading-relaxed">{errorMessage}</p>
            </div>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-white font-bold text-base px-2 py-1 rounded-lg hover:bg-red-900/50 transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14 flex flex-col items-center relative z-10">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-slate-300 text-xs font-medium mb-5 shadow-inner backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Complete PDF Studio • Native Text Editing • 15+ Free Converters</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight mb-4 leading-[1.12]">
            Professional PDF Tools. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-400">
              100% Private in Your Browser.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Directly edit original text, convert to Word, Excel, JPG, compress, split, merge, and protect PDFs without uploading your files anywhere.
          </p>
        </div>

        {/* Resume Session Banner (If Previous Document Exists in Local Storage) */}
        {recentSession && (
          <div className="w-full max-w-3xl mb-8 animate-fade-in">
            <div className="bg-gradient-to-r from-blue-950/40 via-slate-900/70 to-indigo-950/40 border border-blue-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-xl shadow-xl">
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                      Previous Session
                    </span>
                    <span className="text-xs text-slate-400">
                      Page {recentSession.currentPageNumber}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white truncate max-w-md mt-0.5">
                    {recentSession.documentName}
                  </h4>
                </div>
              </div>

              <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
                <button
                  onClick={() => setRecentSession(null)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800"
                >
                  Dismiss
                </button>
                <button
                  onClick={async () => {
                    await restoreSession();
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition flex items-center space-x-1.5 active:scale-95 cursor-pointer"
                >
                  <span>Resume Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Master Dropzone & Document Command Hub */}
        <div className="w-full max-w-3xl mb-14">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full bg-slate-900/60 backdrop-blur-xl rounded-3xl border-2 border-dashed p-8 sm:p-12 cursor-pointer transition-all duration-300 shadow-2xl relative overflow-hidden group ${
              isDragging
                ? "border-blue-400 bg-blue-600/15 scale-[1.01] shadow-blue-500/25 ring-4 ring-blue-500/20"
                : "border-slate-700/80 hover:border-blue-500/80 hover:bg-slate-900/80"
            }`}
          >
            {/* Ambient inner glow */}
            <div className="absolute inset-0 bg-radial from-blue-600/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,application/pdf"
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center relative z-10">
              <div
                className={`w-18 h-18 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300 shadow-xl ${
                  isDragging
                    ? "bg-blue-600 text-white scale-110 shadow-blue-500/40"
                    : "bg-gradient-to-tr from-slate-800 to-slate-700/80 text-blue-400 border border-slate-700 group-hover:scale-105 group-hover:text-blue-300 group-hover:border-blue-500/40"
                }`}
              >
                <UploadCloud className="w-9 h-9 sm:w-10 sm:h-10 transition-transform group-hover:-translate-y-0.5" />
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-white mb-2 text-center tracking-tight">
                Select PDF file or drop it anywhere
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mb-6 text-center max-w-md leading-relaxed">
                Opens instantly in the high-fidelity PDF Studio Editor. Vector glyphs, interactive links, and embedded styles preserved.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-xl shadow-blue-600/30 transition-all flex items-center space-x-2 border border-white/10 group-hover:shadow-blue-500/40"
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>Choose Local PDF</span>
                </button>
              </div>

              {/* Supported format badges */}
              <div className="flex items-center space-x-2 mt-6 text-[11px] text-slate-500">
                <span className="font-mono bg-slate-800/80 px-2 py-0.5 rounded text-slate-400 border border-slate-700/60">
                  .pdf (All Standards 1.4 - 2.0)
                </span>
                <span>•</span>
                <span>Encrypted & Scanned PDFs supported</span>
              </div>

              {/* Loading Bar Indicator */}
              {isLoading && (
                <div className="w-full max-w-sm mt-6 animate-fade-in">
                  <div className="flex justify-between text-xs text-slate-300 mb-2 font-medium">
                    <span className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                      <span>Parsing & analyzing document structure...</span>
                    </span>
                    <span className="font-mono text-blue-400 font-bold">{loadingProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/80">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-300 shadow-md shadow-blue-500/50"
                      style={{ width: `${loadingProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Interactive Sample Document Launchers */}
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-3 px-4 backdrop-blur-md">
            <span className="text-xs text-slate-400 font-medium flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Or explore with instant sample templates:</span>
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => loadSample("single")}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl text-slate-200 text-xs font-medium transition flex items-center space-x-1.5 active:scale-95 cursor-pointer"
              >
                <FileText aria-hidden="true" className="w-3.5 h-3.5 text-blue-300" />
                <span>Contract & Terms (1 Pg)</span>
              </button>
              <button
                onClick={() => loadSample("multi")}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl text-slate-200 text-xs font-medium transition flex items-center space-x-1.5 active:scale-95 cursor-pointer"
              >
                <Layers aria-hidden="true" className="w-3.5 h-3.5 text-violet-300" />
                <span>Annual Report (5 Pgs)</span>
              </button>
              <button
                onClick={() => loadSample("rotated")}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl text-slate-200 text-xs font-medium transition flex items-center space-x-1.5 active:scale-95 cursor-pointer"
              >
                <Presentation aria-hidden="true" className="w-3.5 h-3.5 text-cyan-300" />
                <span>Landscape Slides</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tools Suite Section with Live Search & Category Filtering */}
        <section className="w-full space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  All PDF Tools & Converters
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  {filteredTools.length}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Run any tool directly inside your browser. No registration, no queues, no file limits.
              </p>
            </div>

            {/* Search Input Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative min-w-[240px] sm:min-w-[280px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tools (e.g. compress, word, merge...)"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1 p-1 bg-slate-900/90 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setActiveCategory("all")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                    activeCategory === "all"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  All ({ALL_TOOLS.length})
                </button>
                <button
                  onClick={() => setActiveCategory("convert-from-pdf")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                    activeCategory === "convert-from-pdf"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  From PDF
                </button>
                <button
                  onClick={() => setActiveCategory("convert-to-pdf")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                    activeCategory === "convert-to-pdf"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  To PDF
                </button>
                <button
                  onClick={() => setActiveCategory("organize")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                    activeCategory === "organize"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Organize
                </button>
                <button
                  onClick={() => setActiveCategory("security")}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                    activeCategory === "security"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Security
                </button>
              </div>
            </div>
          </div>

          {/* Tools Grid Display */}
          {filteredTools.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800/80">
              <Search className="w-8 h-8 text-slate-500 mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-slate-300 mb-1">
                No tools found matching &quot;{searchQuery}&quot;
              </h4>
              <p className="text-xs text-slate-500 mb-4">
                Try searching for words like &quot;merge&quot;, &quot;compress&quot;, &quot;word&quot;, or &quot;excel&quot;.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("all");
                }}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
              >
                Reset Search & Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredTools.map((tool) => {
                const Icon = getToolIcon(tool.id);
                return (
                  <div
                    key={tool.id}
                    onClick={() => handleToolClick(tool)}
                    className="group bg-slate-900/70 hover:bg-slate-850 rounded-2xl border border-slate-800 hover:border-blue-500/60 p-5 cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-200 flex flex-col justify-between relative overflow-hidden backdrop-blur-md hover:-translate-y-1"
                  >
                    {/* Top ambient hover gradient */}
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div
                          className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${tool.gradient} text-white flex items-center justify-center shadow-lg shadow-black/40 transition-transform group-hover:scale-105 border border-white/20`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        {tool.badge && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30 uppercase tracking-wider">
                            {tool.badge}
                          </span>
                        )}
                      </div>

                      <div>
                        <h3 className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors flex items-center justify-between">
                          <span>{tool.title}</span>
                          <ArrowUpRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-blue-400 transition-opacity" />
                        </h3>
                        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                          {tool.shortDesc}
                        </p>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-blue-400">
                      <span className="group-hover:translate-x-0.5 transition-transform">Launch Tool</span>
                      <ArrowRight className="w-3.5 h-3.5 text-blue-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Enterprise Architecture & Security Pillar Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 text-left w-full pt-12 border-t border-slate-800/80">
          <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 space-y-3 shadow-xl backdrop-blur-md hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Lock className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white">100% In-Browser Confidential</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your confidential contracts, financials, and legal files never leave your computer. All WebAssembly parsing, rendering, and conversion run inside your isolated browser sandbox.
            </p>
          </div>

          <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 space-y-3 shadow-xl backdrop-blur-md hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white">True Vector & Font Preservation</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Unlike web tools that degrade PDFs into blurry flattened raster images, PDF Studio maintains exact vector glyphs, embedded OpenType fonts, form fields, and clickable URLs.
            </p>
          </div>

          <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 space-y-3 shadow-xl backdrop-blur-md hover:border-slate-700 transition">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white">Zero Limits & Multi-Threaded</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              No uploading or downloading over slow connections. Process massive documents up to 250MB instantly with multi-threaded Web Workers and zero rate limits.
            </p>
          </div>
        </section>

        {/* Global Keyboard Shortcuts Strip */}
        <section className="w-full mt-10 bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 backdrop-blur-md">
          <div className="flex items-center space-x-2 font-medium text-slate-300">
            <Command className="w-4 h-4 text-blue-400" />
            <span>Editor Shortcuts:</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">V</kbd>
              <span className="text-slate-400 font-sans">Select</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">H</kbd>
              <span className="text-slate-400 font-sans">Grab & Position</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Space</kbd>
              <span className="text-slate-400 font-sans">Quick Grab</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">T</kbd>
              <span className="text-slate-400 font-sans">Add Text</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Ctrl+D</kbd>
              <span className="text-slate-400 font-sans">Duplicate</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Ctrl+Z</kbd>
              <span className="text-slate-400 font-sans">Undo</span>
            </span>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-[#0B0F17]/95 py-6 px-4 text-center text-xs text-slate-500 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>PDF Studio Engine v2.4 • Client-Side Operational</span>
          </div>
          <p>© 2026 PDF Studio Platform • 100% Client-Side Privacy Guaranteed</p>
        </div>
      </footer>
    </div>
  );
};
