"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Lock,
  Layers,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  Scissors,
  Minimize2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MousePointer,
  Hand,
  Pencil,
  Type,
  Eraser,
  Square,
  Circle,
  Eye,
  Sliders,
  Cpu,
  Database,
  ArrowUpRight,
  Search,
  Check,
  ExternalLink,
  FolderOpen,
  HelpCircle,
  RefreshCw,
  Copy,
} from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import {
  createSinglePageSamplePdf,
  createMultiPageSamplePdf,
  createRotatedPageSamplePdf,
} from "@/core/utils/sample-pdfs";

interface ScrollytellingLandingPageProps {
  onGoToDashboard: () => void;
}

export const ScrollytellingLandingPage: React.FC<ScrollytellingLandingPageProps> = ({
  onGoToDashboard,
}) => {
  const { loadDocumentBytes } = useEditorStore();

  // Scroll Progress Tracking
  const [scrollProgress, setScrollProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Before/After Comparison Slider Position (0 to 100%)
  const [sliderPos, setSliderPos] = useState(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const sliderContainerRef = useRef<HTMLDivElement>(null);

  // Interactive Live Token Editor Demo in Chapter 3
  const [activeTokenDemo, setActiveTokenDemo] = useState(0);
  const [demoCustomText, setDemoCustomText] = useState("CONFIDENTIAL & PROPRIETARY");

  // Feature Suite Category Tab
  const [activeFeatureTab, setActiveFeatureTab] = useState<"edit" | "office" | "images" | "security">("edit");

  // FAQ Accordion Active Item
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [faqSearch, setFaqSearch] = useState("");

  // Update scroll progress
  useEffect(() => {
    const handleScroll = () => {
      const el = containerRef.current;
      if (!el) return;
      const totalHeight = el.scrollHeight - el.clientHeight;
      if (totalHeight <= 0) return;
      const progress = (el.scrollTop / totalHeight) * 100;
      setScrollProgress(Math.min(100, Math.max(0, progress)));
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true });
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, []);

  // Comparison slider drag handler
  const handleSliderMove = (clientX: number) => {
    if (!sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setSliderPos(pct);
  };

  useEffect(() => {
    if (!isDraggingSlider) return;

    const onPointerMove = (e: PointerEvent) => {
      handleSliderMove(e.clientX);
    };

    const onPointerUp = () => {
      setIsDraggingSlider(false);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [isDraggingSlider]);

  // Quick launch sample from landing page
  const handleLaunchSample = async (type: "single" | "multi" | "rotated") => {
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

  // FAQ Items Data
  const FAQ_ITEMS = [
    {
      q: "How does PDF Studio edit text without converting pages into blurry images?",
      a: "Unlike common online PDF tools that render pages into flattened low-res raster bitmaps, PDF Studio inspects the raw PDF content stream in WebAssembly. We extract text tokens with exact vector baselines, CapHeight metrics, and font encodings. When you modify text, the underlying stream is updated natively with matching Type1 or embedded TrueType font metrics, keeping every character crisp and vector-sharp at 1000% zoom.",
    },
    {
      q: "Are my uploaded documents safe? Does anything get uploaded to a cloud server?",
      a: "Zero bytes leave your computer. 100% of parsing, editing, image conversion, password encryption, and file generation executes locally in your browser memory via Web Workers and WebAssembly. You can disconnect your Wi-Fi entirely and PDF Studio will continue working without interruption.",
    },
    {
      q: "How does the Grab / Pan Tool and zooming work?",
      a: "PDF Studio features both an active Grab Tool (accessible by pressing 'H' or clicking the Hand icon in the toolbar) and universal quick-pan. Holding the Spacebar at any time switches your cursor to a grab hand, allowing you to pan around zoomed pages with silky 60fps performance without altering your active tool.",
    },
    {
      q: "What is the difference between Blackout and Permanent Redaction?",
      a: "A Blackout simply draws an opaque rectangle over an area — useful for presentations or visual masking, but underlying text may still exist in the PDF stream. Permanent Redaction completely purges and sanitizes the underlying text tokens, vector glyphs, and image coordinates from the raw PDF binary stream before applying the redaction box, ensuring sensitive data can never be copied, inspected, or recovered.",
    },
    {
      q: "How do Office conversions (Word .docx and Excel .xlsx) work inside the browser?",
      a: "PDF Studio features built-in client-side OOXML (Open Packaging Convention) generators. When exporting to Word, it reconstructs continuous paragraph flow, headings, and font weights into standard .docx packages. When exporting to Excel, our table detection engine parses grid coordinates and outputs structured .xlsx sheets and CSVs with zero server calls.",
    },
    {
      q: "What happens if I accidentally refresh the page while editing?",
      a: "Progress is protected. PDF Studio automatically caches active document sessions, operations ledger, page position, and view rotation in browser IndexedDB. Upon refreshing, you are immediately prompted to resume your previous workspace with all edits intact.",
    },
    {
      q: "What is the maximum file size PDF Studio can handle?",
      a: "Because operations run locally in 64-bit WebAssembly workers rather than over slow HTTP upload connections, PDF Studio easily processes large documents up to 250MB and documents with hundreds of pages without upload timeouts.",
    },
    {
      q: "Can I add passwords or unlock secured PDFs?",
      a: "Yes. PDF Studio includes client-side AES-256 cryptographic tools. You can apply user and owner passwords to protect documents, or enter the password once to remove restrictions and export an open document.",
    },
  ];

  const filteredFaqs = FAQ_ITEMS.filter(
    (item) =>
      !faqSearch ||
      item.q.toLowerCase().includes(faqSearch.toLowerCase()) ||
      item.a.toLowerCase().includes(faqSearch.toLowerCase())
  );

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col bg-[#07090E] text-slate-100 min-h-screen relative overflow-y-auto selection:bg-blue-500/30 selection:text-blue-200 scroll-smooth"
    >
      {/* Top 2px Scroll Progress Meter */}
      <div
        className="fixed top-0 left-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 z-50 transition-all duration-75 shadow-lg shadow-blue-500/50"
        style={{ width: `${scrollProgress}%` }}
      />

      {/* Atmospheric Ambient Lighting Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[1100px] h-[600px] bg-gradient-to-b from-blue-600/18 via-indigo-600/10 to-transparent blur-[160px] rounded-full" />
        <div className="absolute top-[35%] -left-48 w-[650px] h-[650px] bg-cyan-500/6 blur-[180px] rounded-full" />
        <div className="absolute top-[65%] -right-48 w-[650px] h-[650px] bg-indigo-500/8 blur-[180px] rounded-full" />
      </div>

      {/* Sticky Global Top Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#07090E]/85 border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between transition-all">
        {/* Brandmark */}
        <div className="flex items-center space-x-3.5">
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

        {/* Center Navigation Anchors (Desktop) */}
        <nav className="hidden lg:flex items-center space-x-6 text-xs font-medium text-slate-400">
          <a href="#fidelity" className="hover:text-white transition">
            Vector Fidelity
          </a>
          <a href="#text-engine" className="hover:text-white transition">
            Text Engine
          </a>
          <a href="#all-features" className="hover:text-white transition">
            All 15+ Tools
          </a>
          <a href="#architecture" className="hover:text-white transition">
            Architecture
          </a>
          <a href="#faq" className="hover:text-white transition">
            FAQ
          </a>
        </nav>

        {/* Right Action: Go To Dashboard */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onGoToDashboard}
            className="group relative px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold shadow-xl shadow-blue-600/30 transition-all flex items-center space-x-2 border border-white/20 active:scale-95 cursor-pointer overflow-hidden"
          >
            <span className="relative z-10 flex items-center space-x-1.5">
              <span>Go To Dashboard</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
          </button>
        </div>
      </header>

      {/* Main Scrollytelling Journey */}
      <main className="flex flex-col items-center w-full relative z-10">
        {/* ========================================================================= */}
        {/* CHAPTER 1: HERO & SPATIAL INTERACTIVE WORKSPACE REVEAL */}
        {/* ========================================================================= */}
        <section className="min-h-[85vh] sm:min-h-[92vh] max-w-6xl mx-auto w-full px-4 sm:px-6 pt-12 sm:pt-20 pb-16 flex flex-col items-center text-center justify-center">
          {/* Status Capsule */}
          <div className="inline-flex items-center space-x-2.5 px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-slate-300 text-xs font-medium mb-6 shadow-xl backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>100% In-Browser Engine • Zero File Uploads • 15+ Native Tools</span>
          </div>

          {/* Monumental Hero Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight mb-6 leading-[1.08] max-w-4xl">
            The PDF Editor & Studio Built Without Compromise.
          </h1>

          <p className="text-base sm:text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto mb-9 font-normal">
            Directly edit original text, convert to Word & Excel, compress, protect, and reorganize documents in your browser. Complete privacy with WebAssembly speed.
          </p>

          {/* Dual Primary Call-to-Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-md mb-14">
            <button
              onClick={onGoToDashboard}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm sm:text-base shadow-2xl shadow-blue-600/40 transition-all flex items-center justify-center space-x-2.5 border border-white/20 active:scale-95 cursor-pointer"
            >
              <span>Go To Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href="#fidelity"
              className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs sm:text-sm border border-slate-700/80 transition flex items-center justify-center space-x-2"
            >
              <span>Explore Scrollytelling Tour</span>
              <ChevronDown className="w-4 h-4" />
            </a>
          </div>

          {/* Spatial 3D Perspective Workspace Preview Card */}
          <div className="w-full max-w-5xl rounded-3xl p-1 bg-gradient-to-b from-blue-500/30 via-slate-800/40 to-transparent shadow-2xl shadow-blue-500/10">
            <div className="bg-[#0B0F19] rounded-[22px] border border-slate-800/90 overflow-hidden text-left relative shadow-2xl">
              {/* Simulated Editor Window Chrome */}
              <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-3 text-xs font-mono text-slate-400">
                    Non-Disclosure-Agreement.pdf (24.8 KB) — PDF Studio
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Interactive Overlay Active
                  </span>
                </div>
              </div>

              {/* Simulated Editor Workspace Body */}
              <div className="grid grid-cols-1 md:grid-cols-12 min-h-[380px] bg-[#121622]/90">
                {/* Left Mini Thumbnails */}
                <div className="hidden md:flex md:col-span-2 border-r border-slate-800/80 p-3 flex-col space-y-3 bg-slate-950/60">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Pages (3)
                  </div>
                  <div className="w-full aspect-[3/4] bg-white rounded-lg p-2 shadow-md border-2 border-blue-500 ring-2 ring-blue-500/20 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="h-1.5 bg-slate-800 rounded w-3/4" />
                      <div className="h-1 bg-slate-400 rounded w-full" />
                      <div className="h-1 bg-slate-400 rounded w-5/6" />
                    </div>
                    <div className="text-[9px] text-slate-400 text-center font-mono">Pg 1</div>
                  </div>
                  <div className="w-full aspect-[3/4] bg-white/90 rounded-lg p-2 opacity-60 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="h-1 bg-slate-400 rounded w-full" />
                      <div className="h-1 bg-slate-400 rounded w-4/5" />
                    </div>
                    <div className="text-[9px] text-slate-400 text-center font-mono">Pg 2</div>
                  </div>
                </div>

                {/* Center Canvas with Interactive Simulated Page */}
                <div className="col-span-12 md:col-span-7 p-6 flex flex-col items-center justify-center relative overflow-hidden bg-slate-900/40">
                  <div className="w-full max-w-md bg-white text-slate-900 rounded-sm shadow-2xl p-6 sm:p-8 space-y-4 border border-slate-300 relative select-none">
                    {/* Page Content */}
                    <div className="flex items-center justify-between border-b pb-3 border-slate-200">
                      <div>
                        <h3 className="font-black text-sm text-slate-900 tracking-tight">
                          MUTUAL NON-DISCLOSURE AGREEMENT
                        </h3>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                          CONTRACT REF: #NDA-2026-X89
                        </p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                        EXECUTABLE
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      This Agreement is entered into on this 14th day of November, 2026, by and between the undersigned parties.
                    </p>

                    {/* Active In-Place Text Selection Bounding Box Mockup */}
                    <div className="relative p-2 rounded bg-blue-50/80 border-2 border-blue-500 ring-2 ring-blue-500/20 shadow-sm">
                      <div className="absolute -top-3 -right-2 px-1.5 py-0.2 rounded bg-blue-600 text-[9px] font-bold text-white tracking-wider">
                        EDITING: HELVETICA 11PT
                      </div>
                      <p className="text-[11px] text-blue-950 font-semibold leading-relaxed">
                        &quot;All confidential proprietary intellectual assets shall remain strictly encrypted client-side with zero cloud exposure.&quot;
                      </p>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      In witness whereof, each party has caused this Agreement to be executed by its duly authorized representative.
                    </p>

                    <div className="pt-4 border-t border-slate-200 flex justify-between text-[10px] text-slate-500">
                      <div>Signature: <span className="font-mono text-slate-800 font-bold underline">Verified In-Browser</span></div>
                      <div>Date: 14-Nov-2026</div>
                    </div>
                  </div>
                </div>

                {/* Right Inspector Drawer */}
                <div className="hidden md:flex md:col-span-3 border-l border-slate-800/80 p-4 flex-col space-y-4 bg-slate-950/60 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                      Detected Font Metrics
                    </span>
                    <div className="bg-slate-900 rounded-xl p-2.5 border border-slate-800 space-y-1.5 font-mono text-[11px]">
                      <div className="flex justify-between text-slate-300">
                        <span>Family:</span>
                        <span className="text-blue-400 font-bold">Helvetica</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Size / Weight:</span>
                        <span>11.0 pt / Bold</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>Baseline Snapping:</span>
                        <span className="text-emerald-400 font-bold">Vector Snap</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                      Preservation Guarantees
                    </span>
                    <div className="space-y-1.5 text-[11px] text-slate-400">
                      <div className="flex items-center space-x-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Hyperlinks Intact</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>TrueType Tables Preserved</span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Zero JPEG Raster Artifacts</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-2">
                    <button
                      onClick={onGoToDashboard}
                      className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center justify-center space-x-1.5"
                    >
                      <span>Open in Dashboard</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* CHAPTER 2: VECTOR FIDELITY VS RASTER RUIN (INTERACTIVE SPLIT SLIDER) */}
        {/* ========================================================================= */}
        <section
          id="fidelity"
          className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-20 sm:py-28 border-t border-slate-800/80"
        >
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
              Chapter 02 • True Vector Architecture
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-4 mb-4">
              Why Other PDF Tools Ruin Your Documents.
            </h2>
            <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
              Standard web PDF tools flatten your pages into fuzzy, low-resolution JPEG images to fake editing. Drag the interactive comparison slider below to see how PDF Studio maintains 100% original vector typography.
            </p>
          </div>

          {/* Draggable Interactive Before / After Split View Slider */}
          <div
            ref={sliderContainerRef}
            onMouseDown={() => setIsDraggingSlider(true)}
            onTouchStart={() => setIsDraggingSlider(true)}
            className="w-full max-w-4xl mx-auto h-[360px] sm:h-[440px] rounded-3xl overflow-hidden relative cursor-ew-resize select-none border border-slate-700/80 shadow-2xl bg-slate-950"
          >
            {/* Left Side: Legacy Web PDF Tools (Fuzzy, Rasterized, Degraded) */}
            <div className="absolute inset-0 bg-[#f8fafc] flex flex-col justify-center items-center p-8 sm:p-14 text-slate-900 overflow-hidden filter blur-[1.8px] scale-[1.01]">
              <div className="w-full max-w-xl space-y-4">
                <div className="inline-block px-3 py-1 rounded bg-red-100 text-red-800 font-bold text-xs">
                  ❌ Conventional Tools: 72 DPI Flattened Raster
                </div>
                <h3 className="text-xl sm:text-3xl font-bold text-slate-800 tracking-tight">
                  Commercial Lease & Indemnity Terms
                </h3>
                <p className="text-sm sm:text-base text-slate-700 leading-relaxed font-serif">
                  The Lessee covenants and agrees with the Lessor that during the lease term, all structural maintenance and indemnity covenants shall remain binding upon subsequent assignees.
                </p>
                <div className="pt-2 text-xs text-red-600 font-mono">
                  [!] Text flattened into blurry pixels • Cannot select or copy original font • File bloated by 400%
                </div>
              </div>
            </div>

            {/* Right Side: PDF Studio Engine (100% Crisp Vector, TrueType Intact) */}
            <div
              className="absolute inset-0 bg-white flex flex-col justify-center items-center p-8 sm:p-14 text-slate-900 overflow-hidden"
              style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
            >
              <div className="w-full max-w-xl space-y-4">
                <div className="inline-block px-3 py-1 rounded bg-emerald-100 text-emerald-800 font-bold text-xs">
                  ✓ PDF Studio: 100% Crisp Vector Typography
                </div>
                <h3 className="text-xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  Commercial Lease & Indemnity Terms
                </h3>
                <p className="text-sm sm:text-base text-slate-800 leading-relaxed font-serif">
                  The Lessee covenants and agrees with the Lessor that during the lease term, all structural maintenance and indemnity covenants shall remain binding upon subsequent assignees.
                </p>
                <div className="pt-2 text-xs text-emerald-700 font-mono">
                  [✓] 100% Vector clarity at any zoom • Embedded OpenType fonts preserved • Clickable hyperlinks intact
                </div>
              </div>
            </div>

            {/* Draggable Divider Line & Handle */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-2xl cursor-ew-resize z-20 flex items-center justify-center -translate-x-1/2"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white shadow-xl flex items-center justify-center text-xs font-bold border-2 border-white">
                ↔
              </div>
            </div>

            {/* Float Labels */}
            <div className="absolute top-4 left-4 z-10 px-3 py-1 rounded-full bg-slate-900/90 text-white text-xs font-mono backdrop-blur-md pointer-events-none border border-slate-700">
              Other Web Tools (Rasterized)
            </div>
            <div className="absolute top-4 right-4 z-10 px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-mono shadow-md pointer-events-none">
              PDF Studio (Vector Engine)
            </div>
          </div>

          <div className="text-center mt-6 text-xs text-slate-400 font-mono">
            Drag the handle left or right to inspect text edge sharpness and vector preservation.
          </div>
        </section>

        {/* ========================================================================= */}
        {/* CHAPTER 3: IN-PLACE TEXT MODIFICATION ENGINE */}
        {/* ========================================================================= */}
        <section
          id="text-engine"
          className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-20 sm:py-28 border-t border-slate-800/80"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 space-y-6">
              <span className="text-xs font-bold uppercase tracking-widest text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                Chapter 03 • Native Text Engine
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                Edit Text Inside Existing PDFs. Really.
              </h2>
              <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
                Click on any text line in your document. PDF Studio detects the exact font size, CapHeight, baseline orientation, and text color, allowing you to edit strings in-place without misaligning the page flow.
              </p>

              {/* Engine Highlights List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 border border-blue-500/30">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs sm:text-sm">
                    <span className="font-bold text-white">Baseline Angle Snapping</span>
                    <p className="text-slate-400 text-xs mt-0.5">Calculates exact matrix transforms so angled text aligns perfectly.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 border border-blue-500/30">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs sm:text-sm">
                    <span className="font-bold text-white">Automatic Font Inheritance</span>
                    <p className="text-slate-400 text-xs mt-0.5">Inherits font family, weight, and tracking from neighboring words.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5 border border-blue-500/30">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs sm:text-sm">
                    <span className="font-bold text-white">Full Keyboard Nudging</span>
                    <p className="text-slate-400 text-xs mt-0.5">Nudge any text or shape by 1pt (or 10pt with Shift) via arrow keys.</p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={onGoToDashboard}
                  className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/25 transition flex items-center space-x-2"
                >
                  <span>Test In Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Interactive Live Token Playground Simulator */}
            <div className="lg:col-span-7 bg-slate-900/80 rounded-3xl border border-slate-800 p-6 sm:p-8 backdrop-blur-xl shadow-2xl relative">
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800 text-xs">
                <span className="text-slate-400 font-mono">Live Interactive Token Simulator</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[11px] border border-emerald-500/20">
                  Ready to test
                </span>
              </div>

              {/* Sample Selector Tabs */}
              <div className="flex gap-2 mb-6">
                {["Legal Clause", "Invoice Total", "NDA Header"].map((name, i) => (
                  <button
                    key={name}
                    onClick={() => {
                      setActiveTokenDemo(i);
                      if (i === 0) setDemoCustomText("All intellectual property rights remain strictly confidential.");
                      if (i === 1) setDemoCustomText("TOTAL DUE: $14,850.00 (NET 30)");
                      if (i === 2) setDemoCustomText("MUTUAL NON-DISCLOSURE AND DATA SANITIZATION");
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                      activeTokenDemo === i
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-800/80 text-slate-400 hover:text-white"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>

              {/* Live Interactive Input Box */}
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                    Type below to preview live in-memory replacement:
                  </label>
                  <input
                    type="text"
                    value={demoCustomText}
                    onChange={(e) => setDemoCustomText(e.target.value)}
                    className="w-full bg-slate-950 border-2 border-blue-500/60 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-hidden focus:border-blue-400 shadow-inner"
                  />
                </div>

                {/* Real-Time Metrics Breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 font-mono text-left">
                    <span className="text-[10px] text-slate-500 uppercase block">Font Match</span>
                    <span className="text-xs font-bold text-white">Helvetica-Bold</span>
                  </div>
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 font-mono text-left">
                    <span className="text-[10px] text-slate-500 uppercase block">Character Width</span>
                    <span className="text-xs font-bold text-blue-400">{demoCustomText.length * 8.4} pt</span>
                  </div>
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 font-mono text-left">
                    <span className="text-[10px] text-slate-500 uppercase block">Baseline Angle</span>
                    <span className="text-xs font-bold text-emerald-400">0.00° Horizontal</span>
                  </div>
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 font-mono text-left">
                    <span className="text-[10px] text-slate-500 uppercase block">Stream Action</span>
                    <span className="text-xs font-bold text-cyan-400">Tj Glyph Inject</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* CHAPTER 4: COMPLETE 15+ INDUSTRIAL TOOLS SUITE */}
        {/* ========================================================================= */}
        <section
          id="all-features"
          className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-20 sm:py-28 border-t border-slate-800/80"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                Chapter 04 • The Complete Ecosystem
              </span>
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-3">
                15+ Tools. One Client-Side Suite.
              </h2>
              <p className="text-sm text-slate-400 mt-2 max-w-xl">
                Every converter, organizer, and security utility operates inside browser memory with zero upload lag.
              </p>
            </div>

            {/* Category Filter Switcher */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-2xl text-xs self-start sm:self-auto">
              {[
                { id: "edit", label: "Edit & Annotate" },
                { id: "office", label: "Office & Converters" },
                { id: "images", label: "Images" },
                { id: "security", label: "Security & Organize" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFeatureTab(tab.id as any)}
                  className={`px-3.5 py-2 rounded-xl font-semibold transition ${
                    activeFeatureTab === tab.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Feature Grid based on Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeFeatureTab === "edit" && (
              <>
                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3 hover:border-blue-500/50 transition backdrop-blur-md">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                    <Pencil className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-base">In-Place Text Modification</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Edit existing paragraphs, headers, and numbers with automatic font family and baseline matching.
                  </p>
                </div>

                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3 hover:border-blue-500/50 transition backdrop-blur-md">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                    <Hand className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-base">Grab & Pan Document Tool</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Navigate large zoomed documents effortlessly with the dedicated Hand Tool or universal Spacebar hold.
                  </p>
                </div>

                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3 hover:border-blue-500/50 transition backdrop-blur-md">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <Eraser className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-base">Precision Whiteout & Blackout</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Cover unwanted content with pixel-perfect color matching or create opaque redaction blocks.
                  </p>
                </div>
              </>
            )}

            {activeFeatureTab === "office" && (
              <>
                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3 hover:border-blue-500/50 transition backdrop-blur-md">
                  <div className="w-10 h-10 rounded-xl bg-sky-600/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
                    <FileText className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-base">PDF to Word (.docx)</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Convert PDF pages into editable Microsoft Word documents following official OOXML specifications.
                  </p>
                </div>

                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3 hover:border-blue-500/50 transition backdrop-blur-md">
                  <div className="w-10 h-10 rounded-xl bg-green-600/20 text-green-400 flex items-center justify-center border border-green-500/30">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-base">PDF to Excel (.xlsx) & CSV</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Extract tabular figures and financial data directly into structured Excel spreadsheets.
                  </p>
                </div>

                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3 hover:border-blue-500/50 transition backdrop-blur-md">
                  <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center border border-red-500/30">
                    <Presentation className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-base">PDF to PowerPoint (.pptx)</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Transform PDF report pages into standalone presentation slide decks ready for executive meetings.
                  </p>
                </div>
              </>
            )}

            {activeFeatureTab === "images" && (
              <>
                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3 hover:border-blue-500/50 transition backdrop-blur-md">
                  <div className="w-10 h-10 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-base">PDF to High-DPI JPG</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Export every page as high-resolution JPG images packaged in a convenient .zip archive.
                  </p>
                </div>

                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3 hover:border-blue-500/50 transition backdrop-blur-md">
                  <div className="w-10 h-10 rounded-xl bg-orange-600/20 text-orange-400 flex items-center justify-center border border-orange-500/30">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-base">Lossless PDF to PNG</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Render pixel-perfect, lossless PNG graphics suitable for digital publishing and high-res print.
                  </p>
                </div>

                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3 hover:border-blue-500/50 transition backdrop-blur-md">
                  <div className="w-10 h-10 rounded-xl bg-rose-600/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-base">Images to PDF Compiler</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Combine collections of JPG, PNG, WebP, and photos into a formatted, unified PDF document.
                  </p>
                </div>
              </>
            )}

            {activeFeatureTab === "security" && (
              <>
                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3 hover:border-blue-500/50 transition backdrop-blur-md">
                  <div className="w-10 h-10 rounded-xl bg-violet-600/20 text-violet-400 flex items-center justify-center border border-violet-500/30">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-base">AES-256 Document Encryption</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Lock sensitive files with military-grade client-side encryption. Passwords are never transmitted.
                  </p>
                </div>

                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3 hover:border-blue-500/50 transition backdrop-blur-md">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <Minimize2 className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-base">Intelligent PDF Compressor</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Reduce file sizes up to 70% by optimizing embedded object streams without compromising text legibility.
                  </p>
                </div>

                <div className="bg-slate-900/60 p-6 rounded-2xl border border-slate-800 space-y-3 hover:border-blue-500/50 transition backdrop-blur-md">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                    <Scissors className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-white text-base">Split & Merge Engine</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Split page ranges into separate files or join dozens of documents in custom sequence.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="mt-10 text-center">
            <button
              onClick={onGoToDashboard}
              className="px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-xl shadow-blue-600/25 transition inline-flex items-center space-x-2"
            >
              <span>View All Tools In Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* CHAPTER 5: PERFORMANCE ARCHITECTURE (THE NUMBERS) */}
        {/* ========================================================================= */}
        <section
          id="architecture"
          className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-20 sm:py-28 border-t border-slate-800/80"
        >
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              Chapter 05 • Architectural Excellence
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-3">
              Built for Enterprise Security & Raw Speed.
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Performance metrics measured across real-world enterprise PDF workloads.
            </p>
          </div>

          {/* 4 Massive Metric Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
            <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 text-center space-y-2 backdrop-blur-md">
              <span className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-tr from-emerald-400 to-teal-200 font-mono">
                0 KB
              </span>
              <p className="text-xs sm:text-sm font-bold text-white">Cloud Data Transferred</p>
              <p className="text-[11px] text-slate-400">100% In-Browser Memory Isolation</p>
            </div>

            <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 text-center space-y-2 backdrop-blur-md">
              <span className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-tr from-blue-400 to-cyan-200 font-mono">
                60 FPS
              </span>
              <p className="text-xs sm:text-sm font-bold text-white">Grab & Pan Canvas Speed</p>
              <p className="text-[11px] text-slate-400">Hardware-accelerated viewport</p>
            </div>

            <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 text-center space-y-2 backdrop-blur-md">
              <span className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-tr from-indigo-400 to-purple-200 font-mono">
                250 MB
              </span>
              <p className="text-xs sm:text-sm font-bold text-white">Max Document Capacity</p>
              <p className="text-[11px] text-slate-400">Multi-threaded Web Worker workers</p>
            </div>

            <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 text-center space-y-2 backdrop-blur-md">
              <span className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-tr from-rose-400 to-amber-200 font-mono">
                100%
              </span>
              <p className="text-xs sm:text-sm font-bold text-white">Vector Quality Preserved</p>
              <p className="text-[11px] text-slate-400">Zero raster image flattening</p>
            </div>
          </div>

          {/* Architectural Execution Flow Diagram */}
          <div className="w-full bg-slate-900/40 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-md">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-6 font-mono text-center">
              LOCAL EXECUTION PIPELINE ARCHITECTURE
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center text-center">
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                <FileText className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                <span className="text-xs font-bold text-white block">Local File</span>
                <span className="text-[10px] text-slate-400">Direct disk load</span>
              </div>

              <div className="hidden sm:block text-slate-600 font-mono text-xs">→</div>

              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                <Cpu className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
                <span className="text-xs font-bold text-white block">WASM Sandbox</span>
                <span className="text-[10px] text-slate-400">Token discovery</span>
              </div>

              <div className="hidden sm:block text-slate-600 font-mono text-xs">→</div>

              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                <Layers className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
                <span className="text-xs font-bold text-white block">Vector Overlay</span>
                <span className="text-[10px] text-slate-400">In-place manipulation</span>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* CHAPTER 6: DEEP COMPREHENSIVE TECHNICAL FAQ ACCORDION */}
        {/* ========================================================================= */}
        <section
          id="faq"
          className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-20 sm:py-28 border-t border-slate-800/80"
        >
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
              Chapter 06 • Frequently Asked Questions
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-3">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Everything you need to know about PDF Studio&apos;s client-side architecture.
            </p>

            {/* Quick FAQ Search */}
            <div className="mt-6 max-w-md mx-auto relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={faqSearch}
                onChange={(e) => setFaqSearch(e.target.value)}
                placeholder="Search FAQ keywords (e.g. privacy, word, grab, font)..."
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>

          {/* Accordion List */}
          <div className="space-y-3.5">
            {filteredFaqs.map((faq, idx) => {
              const isOpen = expandedFaq === idx;
              return (
                <div
                  key={faq.q}
                  className="bg-slate-900/60 rounded-2xl border border-slate-800/80 overflow-hidden backdrop-blur-md transition-all"
                >
                  <button
                    onClick={() => setExpandedFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between text-sm sm:text-base font-bold text-white hover:text-blue-400 transition cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <span className="ml-4 p-1 rounded-lg bg-slate-800 text-slate-400 shrink-0">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-slate-400 leading-relaxed border-t border-slate-800/50 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* CHAPTER 7: GRAND FINALE CALL TO ACTION */}
        {/* ========================================================================= */}
        <section className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-20 sm:py-28 text-center">
          <div className="bg-gradient-to-b from-blue-950/40 via-slate-900/70 to-indigo-950/40 border border-blue-500/30 rounded-3xl p-8 sm:p-14 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                Ready to Experience True PDF Freedom?
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Open any PDF document now or explore our complete 15+ tool suite in the dashboard. Zero setup, zero accounts, 100% private.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={onGoToDashboard}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold text-sm sm:text-base shadow-2xl shadow-blue-600/40 transition flex items-center justify-center space-x-2.5 active:scale-95 cursor-pointer"
                >
                  <span>Go To Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Instant sample template links */}
              <div className="pt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
                <span className="text-[11px] font-medium text-slate-500">Test sample right now:</span>
                <button
                  onClick={() => handleLaunchSample("single")}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                >
                  Contract Template (1 Pg)
                </button>
                <button
                  onClick={() => handleLaunchSample("multi")}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                >
                  Annual Report (5 Pgs)
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Global Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-[#07090E]/95 py-8 px-4 text-xs text-slate-500 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-slate-400 font-medium">PDF Studio Platform • Client-Side Operational</span>
          </div>
          <div className="flex items-center space-x-6 text-slate-400">
            <a href="#fidelity" className="hover:text-white transition">Vector Fidelity</a>
            <a href="#all-features" className="hover:text-white transition">Features</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
            <button onClick={onGoToDashboard} className="hover:text-blue-400 transition font-bold">
              Go To Dashboard →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
