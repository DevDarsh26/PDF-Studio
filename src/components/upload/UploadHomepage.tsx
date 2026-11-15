"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
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
  Command,
  ArrowUpRight,
  ArrowLeft,
  CheckCircle2,
  Share2,
  PenTool,
  Database,
  Trash2,
} from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import {
  createSinglePageSamplePdf,
  createMultiPageSamplePdf,
  createRotatedPageSamplePdf,
} from "@/core/utils/sample-pdfs";
import { ToolCategory, ToolId, ToolDefinition } from "@/core/tools/types";
import { PdfToolsRunnerModal } from "../tools/PdfToolsRunnerModal";
import {
  loadDocumentSession,
  clearDocumentSession,
} from "@/core/persistence/document-persistence";

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
    color: "blue",
    gradient: "from-blue-700 to-indigo-800",
    keywords: ["word", "docx", "doc", "microsoft", "convert"],
  },
  {
    id: "pdf-to-excel",
    title: "PDF to Excel (.xlsx)",
    shortDesc: "Detect tabular row columns and export numerical figures into clean spreadsheets.",
    category: "convert-from-pdf",
    badge: "Tabular Parser",
    popular: true,
    acceptedFormats: ".pdf",
    color: "emerald",
    gradient: "from-emerald-700 to-green-800",
    keywords: ["excel", "xlsx", "csv", "sheets", "spreadsheet", "tables"],
  },
  {
    id: "pdf-to-ppt",
    title: "PDF to PowerPoint (.pptx)",
    shortDesc: "Convert presentation slides into editable slides with retained geometries.",
    category: "convert-from-pdf",
    acceptedFormats: ".pdf",
    color: "orange",
    gradient: "from-orange-600 to-amber-700",
    keywords: ["powerpoint", "ppt", "pptx", "slides", "presentation"],
  },
  {
    id: "word-to-pdf",
    title: "Word (.docx) to PDF",
    shortDesc: "Compile DOCX documents into universal vector PDF files with preserved formatting.",
    category: "convert-to-pdf",
    acceptedFormats: ".docx,.doc",
    color: "blue",
    gradient: "from-sky-600 to-blue-700",
    keywords: ["doc", "docx", "word", "convert to pdf"],
  },

  // ROW 3: IMAGE SUITE
  {
    id: "pdf-to-jpg",
    title: "PDF to JPG",
    shortDesc: "Rasterize pages into high-resolution JPG images with selectable DPI quality.",
    category: "convert-from-pdf",
    popular: true,
    acceptedFormats: ".pdf",
    color: "amber",
    gradient: "from-amber-600 to-orange-600",
    keywords: ["jpg", "jpeg", "image", "export pages", "raster"],
  },
  {
    id: "pdf-to-png",
    title: "PDF to PNG (Lossless)",
    shortDesc: "Export crisp pages with transparent alpha background support.",
    category: "convert-from-pdf",
    acceptedFormats: ".pdf",
    color: "violet",
    gradient: "from-violet-600 to-purple-700",
    keywords: ["png", "lossless", "transparent", "alpha"],
  },
  {
    id: "jpg-to-pdf",
    title: "JPG to PDF",
    shortDesc: "Collate multiple JPEG photos into a single paginated PDF portfolio.",
    category: "convert-to-pdf",
    acceptedFormats: ".jpg,.jpeg",
    color: "yellow",
    gradient: "from-yellow-600 to-amber-600",
    keywords: ["jpg to pdf", "photos", "portfolio"],
  },
  {
    id: "png-to-pdf",
    title: "PNG to PDF",
    shortDesc: "Package lossless illustrations and diagrams into a print-ready document.",
    category: "convert-to-pdf",
    acceptedFormats: ".png",
    color: "indigo",
    gradient: "from-indigo-600 to-blue-700",
    keywords: ["png to pdf", "diagrams", "vector-like"],
  },

  // ROW 4: ADVANCED SECURITY & WORKFLOWS
  {
    id: "protect-pdf",
    title: "Protect with Password",
    shortDesc: "Apply military-grade AES-256 encryption and configure read/edit permissions.",
    category: "security",
    badge: "AES-256",
    popular: true,
    acceptedFormats: ".pdf",
    color: "rose",
    gradient: "from-rose-600 to-red-700",
    keywords: ["protect", "encrypt", "password", "security", "aes", "lock"],
  },
  {
    id: "unlock-pdf",
    title: "Unlock Password PDF",
    shortDesc: "Permanently remove owner restrictions and decryption barriers locally.",
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
  const [showAllTools, setShowAllTools] = useState(false);
  const [activeRunnerTool, setActiveRunnerTool] = useState<ToolId | null>(null);

  // Dynamic time greeting & date
  const [greeting, setGreeting] = useState("morning");
  const [formattedDate, setFormattedDate] = useState("Sunday, 15 November");

  // Resume session check
  const [recentSession, setRecentSession] = useState<{
    documentName: string;
    timestamp: number;
    currentPageNumber: number;
    byteSize?: number;
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
    const now = new Date();
    const hour = now.getHours();
    if (hour < 12) setGreeting("morning");
    else if (hour < 17) setGreeting("afternoon");
    else setGreeting("evening");

    try {
      const dateStr = now.toLocaleDateString("en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      setFormattedDate(dateStr);
    } catch {
      setFormattedDate("Sunday, 15 November");
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    loadDocumentSession().then((session) => {
      if (!isCancelled && session && session.rawBytes && session.rawBytes.byteLength > 0) {
        setRecentSession({
          documentName: session.documentName,
          timestamp: session.timestamp,
          currentPageNumber: session.currentPageNumber || 1,
          byteSize: session.rawBytes.byteLength,
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
        name = "Service-agreement.pdf";
      } else if (type === "multi") {
        buffer = await createMultiPageSamplePdf();
        name = "Annual-Report-2026.pdf";
      } else {
        buffer = await createRotatedPageSamplePdf();
        name = "Pitch-Deck-Landscape.pdf";
      }
      await loadDocumentBytes(buffer, name);
    } catch {
      // Handled in store
    }
  };

  const handleClearStorage = async () => {
    try {
      await clearDocumentSession();
      setRecentSession(null);
      showToast("Local memory vault cleared");
    } catch {
      showToast("Storage cleared");
    }
  };

  const handleToolClick = (toolId: ToolId | "edit-pdf" | "sign" | "to-image") => {
    if (toolId === "edit-pdf") {
      fileInputRef.current?.click();
    } else if (toolId === "sign") {
      loadSample("single");
    } else if (toolId === "to-image") {
      setActiveRunnerTool("pdf-to-jpg");
    } else {
      setActiveRunnerTool(toolId as ToolId);
    }
  };

  // Filter tools by category and search query
  const query = searchQuery.trim().toLowerCase();
  const filteredTools = useMemo(() => {
    return ALL_TOOLS.filter((tool) => {
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
  }, [activeCategory, query]);



  return (
    <div className="pdf-dashboard-shell min-h-screen w-full flex flex-col bg-[#f4f1ea] text-[#0d1b3d] antialiased selection:bg-[#ffd84d] selection:text-[#0d1b3d] overflow-x-hidden">
      <style jsx global>{`
        .serif {
          font-family: 'Instrument Serif', Georgia, serif;
          font-weight: 400;
          letter-spacing: -0.02em;
        }
        .muted {
          color: #4a5168;
        }
        .bar {
          height: 9px;
          border-radius: 5px;
          background: #d9d6cc;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 48px;
          padding: 0 24px;
          border-radius: 99px;
          font: 600 15px 'Inter Tight', sans-serif;
          border: 1px solid #0d1b3d;
          background: transparent;
          color: #0d1b3d;
          cursor: pointer;
          transition: transform .3s cubic-bezier(.2,.8,.2,1), background .3s, color .3s;
          text-decoration: none;
        }
        .btn:hover {
          transform: translateY(-2px);
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
        .nv {
          display: flex;
          align-items: center;
          gap: 12px;
          height: 48px;
          padding: 0 16px;
          border-radius: 99px;
          font-weight: 600;
          color: #4a5168;
          transition: background .25s, color .25s, padding .3s;
          cursor: pointer;
          text-decoration: none;
        }
        .nv:hover {
          background: #e7e3d8;
          color: #0d1b3d;
          padding-left: 22px;
        }
        .nv.on {
          background: #0d1b3d;
          color: #f4f1ea;
        }
        .nv.on i {
          background: #ffd84d;
        }
        .nv i {
          width: 8px;
          height: 8px;
          border-radius: 4px;
          margin-left: auto;
          background: transparent;
          display: inline-block;
        }
        .tl {
          border-radius: 24px;
          padding: 20px;
          height: 132px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border: 1px solid #d8d4c8;
          cursor: pointer;
          transition: transform .45s cubic-bezier(.2,.8,.2,1), box-shadow .45s;
          text-decoration: none;
        }
        .tl:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 40px -16px rgba(13,27,61,.3);
        }
        .tl .ar {
          opacity: 0;
          transform: translateX(-10px);
          transition: all .35s;
        }
        .tl:hover .ar {
          opacity: 1;
          transform: none;
        }
        .rw {
          display: grid;
          grid-template-columns: 56px 2fr 1fr 1fr 110px 40px;
          align-items: center;
          padding: 12px 24px;
          border-top: 1px solid #d8d4c8;
          transition: background .25s;
        }
        .rw:hover {
          background: #f4f1ea;
        }
        .ch {
          font-size: 13px;
          font-weight: 700;
          padding: 5px 12px;
          border-radius: 99px;
          width: max-content;
        }
        .ib {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          border: 1px solid transparent;
          background: transparent;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: #0d1b3d;
          transition: background .25s, transform .25s;
        }
        .ib:hover {
          background: #e7e3d8;
          transform: translateY(-2px);
        }
        .ib.on {
          background: #0d1b3d;
          color: #ffd84d;
        }
        @keyframes bob {
          50% { transform: translateY(-8px); }
        }
        @keyframes grow {
          from { width: 0; }
        }
        @keyframes fin {
          from { opacity: 0; transform: translateY(16px); }
        }
        .in {
          animation: fin .7s cubic-bezier(.2,.8,.2,1) both;
        }
        .pdf-dashboard-shell {
          background-color: #f4f1ea;
          background-image: radial-gradient(#d8d4c8 1.2px, transparent 1.2px);
          background-size: 24px 24px;
        }
      `}</style>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,application/pdf"
        className="hidden"
      />

      {/* Interactive Tool Runner Modal */}
      <PdfToolsRunnerModal
        toolId={activeRunnerTool}
        onClose={() => setActiveRunnerTool(null)}
      />

      {/* Top Navigation Bar (Uniform with rest of application) */}
      <header className="sticky top-0 z-30 bg-[#fbf9f4]/95 backdrop-blur-md border-b border-[#d8d4c8] px-6 sm:px-10 lg:px-14 py-3.5 flex items-center justify-between">
        <button
          onClick={() => (onBackToLanding ? onBackToLanding() : null)}
          className="serif text-3xl font-normal tracking-tight text-[#0d1b3d] hover:opacity-80 transition select-none flex items-center gap-2"
        >
          <span>PDF Studio</span>
        </button>

        <div className="flex items-center gap-3">
          {/* Quick Search */}
          <label className="hidden sm:flex items-center gap-2.5 h-11 w-[260px] lg:w-[320px] rounded-full bg-[#f4f1ea] border border-[#d8d4c8] px-4 text-[#4a5168] transition focus-within:border-[#2447f5] focus-within:ring-2 focus-within:ring-[#2447f5]/15">
            <Search className="w-4 h-4 shrink-0 text-[#4a5168]" />
            <input
              ref={searchInputRef}
              aria-label="Search tools"
              placeholder="Search tools & features"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 outline-none bg-transparent text-[14px] font-medium text-[#0d1b3d] flex-1 placeholder:text-[#4a5168]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-[#4a5168] hover:text-[#0d1b3d] p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </label>

          {/* Upload PDF Primary Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn pri !h-11 shadow-sm shadow-blue-600/15 active:scale-95"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>Upload PDF</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="w-full max-w-[1240px] mx-auto px-6 sm:px-10 py-8 lg:py-10 flex flex-col gap-7 flex-1 transition-all duration-300">
        {/* Error Alert Notice */}
        {errorMessage && (
          <div className="w-full bg-red-100 border border-red-300 rounded-2xl p-4 flex items-center justify-between text-red-900 shadow-sm animate-fade-in">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <div className="text-xs">
                <span className="font-bold text-sm">Failed to open document: </span>
                <span>{errorMessage}</span>
              </div>
            </div>
            <button
              onClick={clearError}
              className="text-red-700 hover:text-red-950 font-bold px-2 py-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header: Date + Greeting */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="muted font-semibold text-sm">{formattedDate}</div>
            <h1 className="serif in text-[44px] sm:text-[56px] lg:text-[62px] leading-[1.05] capitalize">
              Good {greeting}.
            </h1>
          </div>

          {/* Mobile search bar (< sm screens) */}
          <div className="sm:hidden w-full">
            <label className="flex items-center gap-2.5 h-11 w-full rounded-full bg-[#fbf9f4] border border-[#d8d4c8] px-4 text-[#4a5168]">
              <Search className="w-4 h-4 shrink-0" />
              <input
                aria-label="Search tools"
                placeholder="Search tools & features"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 outline-none bg-transparent text-[14px] font-medium text-[#0d1b3d] flex-1 placeholder:text-[#4a5168]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-[#4a5168] p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </label>
          </div>
        </div>

        {/* Hero 2-Column Action Cards */}
        {/* Hero Dropzone Action Card */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`in w-full border-2 border-dashed rounded-[28px] min-h-[160px] flex flex-col sm:flex-row items-center justify-between gap-6 px-6 sm:px-10 py-7 cursor-pointer transition-all duration-300 ${
            isDragging
              ? "border-[#2447f5] bg-[#eef3ff] scale-[1.005] shadow-xl"
              : "border-[#2447f5] bg-[#fbf9f4] hover:bg-[#f6f3eb]"
          }`}
          style={{ animationDelay: "0.05s" }}
        >
          <div className="flex items-center gap-6 w-full sm:w-auto">
            <span
              className="w-[72px] h-[72px] rounded-full bg-[#2447f5] text-[#f4f1ea] grid place-items-center shrink-0 shadow-lg shadow-blue-600/25"
              style={{ animation: "bob 2.4s ease-in-out infinite" }}
            >
              <UploadCloud className="w-8 h-8" />
            </span>
            <div className="min-w-0">
              <div className="serif text-[32px] sm:text-[38px] leading-tight text-[#0d1b3d]">
                Drop a PDF to begin
              </div>
              <div className="muted text-sm sm:text-base mt-1">
                or browse your device to open instantly. Fast, private, and 100% offline. Up to 100MB.
              </div>

              {isLoading && (
                <div className="mt-3 max-w-sm">
                  <div className="flex justify-between text-xs text-[#2447f5] font-semibold mb-1">
                    <span>Parsing structure...</span>
                    <span>{loadingProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#d8d4c8] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2447f5] transition-all duration-300"
                      style={{ width: `${loadingProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-6 py-3 rounded-full bg-[#0d1b3d] text-[#f4f1ea] font-semibold text-sm shrink-0 hover:bg-[#2447f5] transition shadow-sm">
            <span>Browse files</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* Tools Section */}
        <div>
          <div className="flex justify-between items-baseline mb-3.5">
            <h2 className="serif text-[30px] sm:text-[34px]">Tools</h2>
            <button
              onClick={() => setShowAllTools(!showAllTools)}
              className="font-semibold text-[#2447f5] hover:underline text-sm sm:text-base cursor-pointer"
            >
              {showAllTools ? "Show essentials" : "See all (24 tools)"}
            </button>
          </div>

          {/* 8 Primary Signature Tool Tiles (Matching Mockup) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Edit PDF */}
            <div
              onClick={() => handleToolClick("edit-pdf")}
              className="tl in"
              style={{
                background: "#2447f5",
                color: "#f4f1ea",
                borderColor: "#2447f5",
                animationDelay: "0.10s",
              }}
            >
              <div className="flex justify-between items-center">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
                </svg>
                <span className="ar">
                  <ArrowRight className="w-5 h-5" />
                </span>
              </div>
              <div>
                <div className="serif text-[30px] leading-tight">Edit PDF</div>
                <div className="text-sm opacity-80 mt-1">Change text and images</div>
              </div>
            </div>

            {/* 2. Sign */}
            <div
              onClick={() => handleToolClick("sign")}
              className="tl in"
              style={{
                background: "#ffd84d",
                color: "#0d1b3d",
                borderColor: "#d8d4c8",
                animationDelay: "0.15s",
              }}
            >
              <div className="flex justify-between items-center">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 17c3-6 5-6 6-2s3 2 5-3 3 0 7 0" />
                </svg>
                <span className="ar">
                  <ArrowRight className="w-5 h-5" />
                </span>
              </div>
              <div>
                <div className="serif text-[30px] leading-tight">Sign</div>
                <div className="text-sm opacity-80 mt-1">Add your signature</div>
              </div>
            </div>

            {/* 3. Merge */}
            <div
              onClick={() => handleToolClick("merge-pdf")}
              className="tl in"
              style={{
                background: "#f3c9c0",
                color: "#0d1b3d",
                borderColor: "#d8d4c8",
                animationDelay: "0.20s",
              }}
            >
              <div className="flex justify-between items-center">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                </svg>
                <span className="ar">
                  <ArrowRight className="w-5 h-5" />
                </span>
              </div>
              <div>
                <div className="serif text-[30px] leading-tight">Merge</div>
                <div className="text-sm opacity-80 mt-1">Combine files</div>
              </div>
            </div>

            {/* 4. Split */}
            <div
              onClick={() => handleToolClick("split-pdf")}
              className="tl in"
              style={{
                background: "#fbf9f4",
                color: "#0d1b3d",
                borderColor: "#d8d4c8",
                animationDelay: "0.25s",
              }}
            >
              <div className="flex justify-between items-center">
                <Scissors className="w-6 h-6" />
                <span className="ar">
                  <ArrowRight className="w-5 h-5" />
                </span>
              </div>
              <div>
                <div className="serif text-[30px] leading-tight">Split</div>
                <div className="text-sm opacity-80 mt-1">Extract pages</div>
              </div>
            </div>

            {/* 5. Compress */}
            <div
              onClick={() => handleToolClick("compress-pdf")}
              className="tl in"
              style={{
                background: "#fbf9f4",
                color: "#0d1b3d",
                borderColor: "#d8d4c8",
                animationDelay: "0.30s",
              }}
            >
              <div className="flex justify-between items-center">
                <Minimize2 className="w-6 h-6" />
                <span className="ar">
                  <ArrowRight className="w-5 h-5" />
                </span>
              </div>
              <div>
                <div className="serif text-[30px] leading-tight">Compress</div>
                <div className="text-sm opacity-80 mt-1">Reduce file size</div>
              </div>
            </div>

            {/* 6. Convert */}
            <div
              onClick={() => handleToolClick("pdf-to-word")}
              className="tl in"
              style={{
                background: "#fbf9f4",
                color: "#0d1b3d",
                borderColor: "#d8d4c8",
                animationDelay: "0.35s",
              }}
            >
              <div className="flex justify-between items-center">
                <FileText className="w-6 h-6" />
                <span className="ar">
                  <ArrowRight className="w-5 h-5" />
                </span>
              </div>
              <div>
                <div className="serif text-[30px] leading-tight">Convert</div>
                <div className="text-sm opacity-80 mt-1">PDF to Word or image</div>
              </div>
            </div>

            {/* 7. Protect */}
            <div
              onClick={() => handleToolClick("protect-pdf")}
              className="tl in"
              style={{
                background: "#0d1b3d",
                color: "#f4f1ea",
                borderColor: "#0d1b3d",
                animationDelay: "0.40s",
              }}
            >
              <div className="flex justify-between items-center">
                <Lock className="w-6 h-6" />
                <span className="ar">
                  <ArrowRight className="w-5 h-5" />
                </span>
              </div>
              <div>
                <div className="serif text-[30px] leading-tight">Protect</div>
                <div className="text-sm opacity-80 mt-1">Password and redact</div>
              </div>
            </div>

            {/* 8. To image */}
            <div
              onClick={() => handleToolClick("to-image")}
              className="tl in"
              style={{
                background: "#fbf9f4",
                color: "#0d1b3d",
                borderColor: "#d8d4c8",
                animationDelay: "0.45s",
              }}
            >
              <div className="flex justify-between items-center">
                <ImageIcon className="w-6 h-6" />
                <span className="ar">
                  <ArrowRight className="w-5 h-5" />
                </span>
              </div>
              <div>
                <div className="serif text-[30px] leading-tight">To image</div>
                <div className="text-sm opacity-80 mt-1">Export pages</div>
              </div>
            </div>
          </div>

          {/* Expanded Full Tools View (When Toggled or Searching) */}
          {(showAllTools || query.length > 0) && (
            <div className="mt-6 pt-6 border-t border-[#d8d4c8] space-y-4 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-[#0d1b3d]">
                  Showing {filteredTools.length} tools
                </div>
                <div className="flex flex-wrap gap-1.5 p-1 bg-[#fbf9f4] rounded-full border border-[#d8d4c8] text-xs">
                  <button
                    onClick={() => setActiveCategory("all")}
                    className={`px-3 py-1 rounded-full font-semibold transition ${
                      activeCategory === "all" ? "bg-[#0d1b3d] text-white" : "text-[#4a5168] hover:text-[#0d1b3d]"
                    }`}
                  >
                    All ({ALL_TOOLS.length})
                  </button>
                  <button
                    onClick={() => setActiveCategory("convert-from-pdf")}
                    className={`px-3 py-1 rounded-full font-semibold transition ${
                      activeCategory === "convert-from-pdf" ? "bg-[#0d1b3d] text-white" : "text-[#4a5168] hover:text-[#0d1b3d]"
                    }`}
                  >
                    From PDF
                  </button>
                  <button
                    onClick={() => setActiveCategory("convert-to-pdf")}
                    className={`px-3 py-1 rounded-full font-semibold transition ${
                      activeCategory === "convert-to-pdf" ? "bg-[#0d1b3d] text-white" : "text-[#4a5168] hover:text-[#0d1b3d]"
                    }`}
                  >
                    To PDF
                  </button>
                  <button
                    onClick={() => setActiveCategory("organize")}
                    className={`px-3 py-1 rounded-full font-semibold transition ${
                      activeCategory === "organize" ? "bg-[#0d1b3d] text-white" : "text-[#4a5168] hover:text-[#0d1b3d]"
                    }`}
                  >
                    Organize
                  </button>
                  <button
                    onClick={() => setActiveCategory("security")}
                    className={`px-3 py-1 rounded-full font-semibold transition ${
                      activeCategory === "security" ? "bg-[#0d1b3d] text-white" : "text-[#4a5168] hover:text-[#0d1b3d]"
                    }`}
                  >
                    Security
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {filteredTools.map((tool) => (
                  <div
                    key={tool.id}
                    onClick={() => {
                      if (tool.id === "edit-pdf") fileInputRef.current?.click();
                      else setActiveRunnerTool(tool.id);
                    }}
                    className="p-4 rounded-2xl bg-[#fbf9f4] border border-[#d8d4c8] hover:border-[#2447f5] hover:-translate-y-1 hover:shadow-lg transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-[#0d1b3d]">{tool.title}</span>
                        {tool.badge && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#eef3ff] text-[#2447f5] border border-blue-200">
                            {tool.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#4a5168] leading-relaxed">{tool.shortDesc}</p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-[#d8d4c8]/60 flex items-center justify-between text-xs font-semibold text-[#2447f5]">
                      <span>Open tool</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>



        {/* Global Keyboard Shortcuts Pill Strip */}
        <div className="mt-2 bg-[#fbf9f4] border border-[#d8d4c8] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#4a5168]">
          <div className="flex items-center gap-2 font-semibold text-[#0d1b3d]">
            <Command className="w-4 h-4 text-[#2447f5]" />
            <span>Editor Shortcuts:</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[#f4f1ea] text-[#0d1b3d] border border-[#d8d4c8]">
                ⌘O
              </kbd>
              <span className="text-[#4a5168] font-sans">Open PDF</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[#f4f1ea] text-[#0d1b3d] border border-[#d8d4c8]">
                /
              </kbd>
              <span className="text-[#4a5168] font-sans">Search</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[#f4f1ea] text-[#0d1b3d] border border-[#d8d4c8]">
                V
              </kbd>
              <span className="text-[#4a5168] font-sans">Select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[#f4f1ea] text-[#0d1b3d] border border-[#d8d4c8]">
                T
              </kbd>
              <span className="text-[#4a5168] font-sans">Add Text</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[#f4f1ea] text-[#0d1b3d] border border-[#d8d4c8]">
                Space
              </kbd>
              <span className="text-[#4a5168] font-sans">Hand Tool</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-[#f4f1ea] text-[#0d1b3d] border border-[#d8d4c8]">
                ⌘Z
              </kbd>
              <span className="text-[#4a5168] font-sans">Undo</span>
            </span>
          </div>
        </div>

        {/* Footer with Creator Links */}
        <footer className="mt-8 pt-6 border-t border-[#d8d4c8] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#4a5168]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>PDF Studio Engine • 100% Client-Side WebAssembly</span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://darshmodii.in"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#0d1b3d] hover:text-[#2447f5] transition underline"
            >
              Darsh Modii
            </a>
            <span>•</span>
            <a
              href="https://github.com/DevDarsh26"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#0d1b3d] transition underline"
            >
              GitHub
            </a>
          </div>

          <div className="text-center sm:text-right">
            Crafted with precision by{" "}
            <a
              href="https://darshmodii.in"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#0d1b3d] hover:underline"
            >
              Darsh Modii
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
};
