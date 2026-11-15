"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  FileText,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
  Shield,
  ArrowRight,
  Upload,
  Sparkles,
  Lock,
  Layers,
  Scissors,
  Minimize2,
  Check,
  ChevronDown,
} from "lucide-react";
import { useEditorStore } from "@/store/editor-store";
import {
  createSinglePageSamplePdf,
  createMultiPageSamplePdf,
  createRotatedPageSamplePdf,
} from "@/core/utils/sample-pdfs";
import { preloadPdfjs } from "@/core/utils/pdfjs-loader";

interface ScrollytellingLandingPageProps {
  onGoToDashboard: () => void;
}

export const ScrollytellingLandingPage: React.FC<ScrollytellingLandingPageProps> = ({
  onGoToDashboard,
}) => {
  const { loadDocumentBytes } = useEditorStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  // Preload PDF.js worker and core bundle in the background for zero-latency sample & file loading
  useEffect(() => {
    preloadPdfjs();
  }, []);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (containerRef.current) {
      const el = containerRef.current.querySelector(`#${id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const scrollToTop = (e: React.MouseEvent) => {
    e.preventDefault();
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      await loadDocumentBytes(buffer, file.name);
    } catch (err) {
      console.error("Failed to load PDF:", err);
    }
  };

  const handleLaunchSample = async (type: "single" | "multi" | "rotated") => {
    setIsLoadingSample(true);
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
    } catch (err) {
      console.error("Failed to load sample:", err);
    } finally {
      setIsLoadingSample(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="paperly-landing-root min-h-screen h-full w-full relative overflow-y-auto selection:bg-[#ffd84d] selection:text-[#0d1b3d] scroll-smooth"
    >
      <style jsx global>{`
        .paperly-landing-root {
          scroll-behavior: smooth;
          background-color: #f4f1ea;
          background-image: radial-gradient(#d8d4c8 1.2px, transparent 1.2px);
          background-size: 28px 28px;
          font-family: 'Inter Tight', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #0d1b3d;
        }

        .serif {
          font-family: 'Instrument Serif', Georgia, 'Times New Roman', serif;
          font-weight: 400;
          letter-spacing: -0.02em;
        }

        .pillnav {
          position: sticky;
          top: 16px;
          z-index: 40;
          margin: 16px auto 0;
          width: calc(100% - 32px);
          max-width: 1312px;
          height: 64px;
          border-radius: 32px;
          background: rgba(244, 241, 234, 0.88);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid #d8d4c8;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px 0 28px;
          box-shadow: 0 4px 20px -4px rgba(13, 27, 61, 0.06);
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 52px;
          padding: 0 28px;
          border-radius: 99px;
          font: 600 16px 'Inter Tight', sans-serif;
          background: #0d1b3d;
          color: #f4f1ea;
          border: 1px solid #0d1b3d;
          transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.3s, color 0.3s, border-color 0.3s;
          cursor: pointer;
          text-decoration: none;
        }
        .btn:hover {
          transform: translateY(-3px);
          background: #ffd84d;
          border-color: #ffd84d;
          color: #0d1b3d;
        }
        .btn.ghost {
          background: transparent;
          color: #0d1b3d;
        }
        .btn.ghost:hover {
          background: #0d1b3d;
          border-color: #0d1b3d;
          color: #f4f1ea;
        }
        .btn:active {
          transform: scale(0.96);
        }

        .nav-link {
          position: relative;
          color: #4a5168;
          font-weight: 500;
          font-size: 15px;
          transition: color 0.2s;
          text-decoration: none;
        }
        .nav-link:hover {
          color: #0d1b3d;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          left: 0;
          bottom: -4px;
          height: 2px;
          width: 100%;
          background: #2447f5;
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .nav-link:hover::after {
          transform: scaleX(1);
        }

        .pp {
          position: absolute;
          background: #fbf9f4;
          border: 1px solid #d8d4c8;
          border-radius: 10px;
          box-shadow: 0 30px 60px -20px rgba(13, 27, 61, 0.22);
        }

        .bar {
          height: 10px;
          border-radius: 5px;
          background: #d9d6cc;
        }

        .tile {
          border-radius: 32px;
          padding: 36px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          position: relative;
          transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.3s;
        }
        .tile:hover {
          transform: translateY(-8px);
          box-shadow: 0 24px 48px -12px rgba(13, 27, 61, 0.16);
        }
        .tn {
          font-weight: 600;
          letter-spacing: 0.12em;
          font-size: 13px;
        }

        .pg3 {
          position: absolute;
          width: 150px;
          height: 190px;
          border-radius: 8px;
          background: #f4f1ea;
          border: 1px solid #d8d4c8;
          transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
          box-shadow: 0 8px 24px rgba(13, 27, 61, 0.08);
        }
        .tile:hover .pg3.a {
          transform: translate(-70px, -12px) rotate(-10deg);
        }
        .tile:hover .pg3.c {
          transform: translate(70px, -12px) rotate(10deg);
        }

        .roll {
          display: block;
          height: 110px;
          overflow: hidden;
        }
        .rl {
          display: flex;
          flex-direction: column;
          animation: roll 10s cubic-bezier(0.7, 0, 0.2, 1) infinite;
        }
        .rl i {
          display: block;
          height: 110px;
          font-style: italic;
          color: #2447f5;
        }
        @keyframes roll {
          0%, 18% { transform: none; }
          25%, 43% { transform: translateY(-110px); }
          50%, 68% { transform: translateY(-220px); }
          75%, 93% { transform: translateY(-330px); }
          100% { transform: translateY(-440px); }
        }

        @keyframes fl2 {
          50% { transform: translateY(-12px) rotate(1deg); }
        }
        .fl2 {
          animation: fl2 6s ease-in-out infinite;
        }

        @keyframes hw {
          0%, 20% { width: 0; }
          45%, 85% { width: 100%; }
          100% { width: 0; }
        }
        @keyframes hd {
          0%, 30% { stroke-dashoffset: 340; }
          60%, 88% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 340; }
        }
        @keyframes hc {
          0% { transform: translate(240px, 310px); }
          25%, 40% { transform: translate(70px, 150px); }
          55%, 70% { transform: translate(110px, 330px); }
          100% { transform: translate(240px, 310px); }
        }
        @keyframes pop {
          0%, 55% { opacity: 0; transform: rotate(-14deg) scale(1.6); }
          62%, 90% { opacity: 1; transform: rotate(-14deg) scale(1); }
          100% { opacity: 0; }
        }
        @keyframes pu {
          50% { box-shadow: 0 0 0 8px rgba(36, 71, 245, 0.18); }
        }
        @keyframes shr {
          0%, 15% { width: 96%; }
          55%, 85% { width: 28%; }
          100% { width: 96%; }
        }

        .mq {
          display: flex;
          width: max-content;
          animation: mq 32s linear infinite;
        }
        .mq:hover {
          animation-play-state: paused;
        }
        @keyframes mq {
          to { transform: translateX(-50%); }
        }

        details {
          border-top: 1px solid #0d1b3d;
        }
        details:last-child {
          border-bottom: 1px solid #0d1b3d;
        }
        summary {
          list-style: none;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          padding: 28px 0;
          font: 400 40px 'Instrument Serif', Georgia, serif;
          letter-spacing: -0.01em;
          transition: padding 0.35s cubic-bezier(0.2, 0.8, 0.2, 1), color 0.3s;
        }
        summary::-webkit-details-marker {
          display: none;
        }
        summary:hover {
          color: #2447f5;
          padding-left: 14px;
        }
        .pl {
          width: 48px;
          height: 48px;
          border-radius: 24px;
          border: 1px solid #0d1b3d;
          display: grid;
          place-items: center;
          flex: none;
          color: #0d1b3d;
          transition: transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.3s, border-color 0.3s;
        }
        details[open] .pl {
          transform: rotate(135deg);
          background: #ffd84d;
          border-color: #ffd84d;
        }
        .ans {
          padding: 0 88px 32px 0;
          max-width: 820px;
          font-size: 19px;
          line-height: 1.6;
          color: #4a5168;
        }

        .ft {
          background: #0d1b3d;
          color: #f4f1ea;
          margin-top: 40px;
          padding: 96px 64px 40px;
          border-radius: 40px 40px 0 0;
          overflow: hidden;
        }
        .fl {
          display: flex;
          flex-direction: column;
          gap: 12px;
          font-size: 18px;
        }
        .fl a {
          color: #aeb3c4;
          transition: color 0.25s, transform 0.25s;
          width: max-content;
          text-decoration: none;
        }
        .fl a:hover {
          color: #ffd84d;
          transform: translateX(6px);
        }
        .fb {
          font: 400 56px/1 'Instrument Serif', Georgia, serif;
          color: #f4f1ea;
          display: inline-flex;
          align-items: center;
          gap: 20px;
          transition: color 0.3s, gap 0.35s;
          text-decoration: none;
        }
        .fb:hover {
          color: #ffd84d;
          gap: 34px;
        }
        .wm {
          font: 400 240px / 0.8 'Instrument Serif', Georgia, serif;
          letter-spacing: -0.04em;
          color: transparent;
          background: repeating-linear-gradient(100deg, #ffd84d 0 140px, #2447f5 140px 280px, #f4f1ea 280px 420px);
          background-size: 840px 100%;
          -webkit-background-clip: text;
          background-clip: text;
          margin: 64px 0 0;
          white-space: nowrap;
          text-align: center;
          padding-bottom: 24px;
          user-select: none;
        }
        .up {
          width: 56px;
          height: 56px;
          border-radius: 28px;
          border: 1px solid #2a3a66;
          display: grid;
          place-items: center;
          color: #f4f1ea;
          transition: background 0.3s, color 0.3s, transform 0.3s;
          text-decoration: none;
        }
        .up:hover {
          background: #ffd84d;
          color: #0d1b3d;
          transform: translateY(-4px);
        }

        @media (max-width: 1024px) {
          .pillnav {
            width: calc(100% - 24px);
            padding: 0 16px;
          }
          .wm {
            font-size: 130px;
          }
          summary {
            font-size: 32px;
          }
        }
      `}</style>

      {/* Hidden PDF Upload Input for instantaneous file drag/click */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="application/pdf"
        className="hidden"
      />

      <div className="w-full max-w-[1440px] mx-auto overflow-clip">
        {/* ========================================================================= */}
        {/* FLOATING PILL NAVIGATION */}
        {/* ========================================================================= */}
        <header className="pillnav">
          <div className="flex items-center space-x-3">
            <span className="serif text-3xl font-normal text-[#0d1b3d]">
              PDF Suite
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-9">
            <a
              href="#s"
              onClick={(e) => scrollToSection(e, "s")}
              className="nav-link"
            >
              How it works
            </a>
            <a
              href="#f"
              onClick={(e) => scrollToSection(e, "f")}
              className="nav-link"
            >
              Features
            </a>
            <a
              href="#converters"
              onClick={(e) => scrollToSection(e, "converters")}
              className="nav-link"
            >
              Converters
            </a>
            <a
              href="#faq"
              onClick={(e) => scrollToSection(e, "faq")}
              className="nav-link"
            >
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={onGoToDashboard}
              className="btn ghost !h-11 !px-5 text-sm"
            >
              Dashboard
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn !h-11 !px-6 text-sm !bg-[#ffd84d] !border-[#ffd84d] !text-[#0d1b3d] hover:!bg-[#0d1b3d] hover:!text-[#f4f1ea]"
            >
              Upload PDF
            </button>
          </div>
        </header>

        {/* ========================================================================= */}
        {/* HERO SECTION */}
        {/* ========================================================================= */}
        <section className="px-6 sm:px-12 lg:px-16 pt-14 pb-28 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7">
            {/* Status Pill */}
            <div className="inline-flex items-center gap-3 font-semibold text-sm sm:text-base text-[#4a5168] mb-7">
              <i
                style={{ animation: "pu 2s ease-in-out infinite" }}
                className="w-3 h-3 rounded-full bg-[#2447f5] block shrink-0"
              />
              <span>The PDF editor for people with deadlines</span>
            </div>

            {/* Monumental Serif Headline with Animated Roller */}
            <h1 className="serif text-6xl sm:text-8xl lg:text-[104px] leading-[0.98] text-[#0d1b3d]">
              Edit every
              <span className="roll">
                <span className="rl">
                  <i>contract</i>
                  <i>invoice</i>
                  <i>résumé</i>
                  <i>report</i>
                  <i>contract</i>
                </span>
              </span>
              like a doc.
            </h1>

            <p className="text-[#4a5168] text-lg sm:text-xl leading-relaxed max-w-[500px] my-8 font-normal">
              Click any line and type. Sign in a tap, merge in a drag. Everything runs locally in your browser with zero cloud uploads.
            </p>

            {/* Hero CTAs */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn !bg-[#2447f5] !border-[#2447f5] !text-[#f4f1ea] hover:!bg-[#ffd84d] hover:!border-[#ffd84d] hover:!text-[#0d1b3d]"
              >
                <Upload className="w-4 h-4 mr-2" />
                <span>Upload a PDF</span>
              </button>

              <button
                onClick={() => handleLaunchSample("single")}
                disabled={isLoadingSample}
                className="btn ghost"
              >
                <span>{isLoadingSample ? "Loading Sample..." : "Try Sample Invoice"}</span>
              </button>

              <a
                href="#s"
                onClick={(e) => scrollToSection(e, "s")}
                className="btn ghost !border-transparent text-sm"
              >
                <span>See how it works &darr;</span>
              </a>
            </div>

            {/* Quick Sample Links */}
            <div className="mt-8 flex items-center gap-2 text-xs text-[#4a5168]">
              <span className="font-semibold text-[#0d1b3d]">Or launch sample:</span>
              <button
                onClick={() => handleLaunchSample("single")}
                className="underline hover:text-[#2447f5] cursor-pointer"
              >
                Contract
              </button>
              <span>•</span>
              <button
                onClick={() => handleLaunchSample("multi")}
                className="underline hover:text-[#2447f5] cursor-pointer"
              >
                Annual Report
              </button>
              <span>•</span>
              <button
                onClick={() => handleLaunchSample("rotated")}
                className="underline hover:text-[#2447f5] cursor-pointer"
              >
                Presentation Deck
              </button>
            </div>
          </div>

          {/* Interactive 3D Floating Paper Mockup Stack */}
          <div className="lg:col-span-5 relative h-[580px] sm:h-[680px] w-full select-none">
            {/* Background Paper 1: Invoice (Left Tilt -9deg) */}
            <div
              className="pp fl2"
              style={{
                left: "4%",
                top: "110px",
                width: "250px",
                height: "340px",
                transform: "rotate(-9deg)",
                padding: "26px",
              }}
            >
              <div className="font-extrabold tracking-widest text-xs text-[#2447f5]">
                INVOICE
              </div>
              <div className="flex flex-col gap-3 mt-5">
                <div className="bar" />
                <div className="bar" style={{ width: "70%" }} />
                <div className="bar" />
                <div className="bar" style={{ width: "55%" }} />
              </div>
              <div className="mt-10 h-16 rounded-xl bg-[#f3c9c0]" />
            </div>

            {/* Background Paper 2: Checklist (Right Tilt +7deg) */}
            <div
              className="pp fl2"
              style={{
                right: "4%",
                top: "40px",
                width: "240px",
                height: "320px",
                transform: "rotate(7deg)",
                padding: "24px",
                animationDelay: "-2s",
              }}
            >
              <div className="flex flex-col gap-4">
                <div className="flex gap-3 items-center">
                  <i className="w-5 h-5 rounded-md bg-[#2447f5] block shrink-0" />
                  <div className="bar flex-1" />
                </div>
                <div className="flex gap-3 items-center">
                  <i className="w-5 h-5 rounded-md border-2 border-[#aeb3c4] block shrink-0" />
                  <div className="bar flex-1" />
                </div>
                <div className="flex gap-3 items-center">
                  <i className="w-5 h-5 rounded-md bg-[#2447f5] block shrink-0" />
                  <div className="bar" style={{ flex: 1, width: "70%" }} />
                </div>
              </div>
            </div>

            {/* Center Front Paper: Service Agreement with Live Interactive Overlay Mockup */}
            <div
              className="pp fl2"
              style={{
                left: "14%",
                top: "100px",
                width: "330px",
                height: "460px",
                transform: "rotate(-2deg)",
                padding: "32px",
                background: "#ffffff",
                boxShadow: "0 50px 90px -24px rgba(13,27,61,0.35)",
                animationDelay: "-4s",
              }}
            >
              <div className="serif text-3xl text-[#0d1b3d]">Service Agreement</div>
              <div className="bar mt-4" style={{ width: "90%" }} />

              {/* In-Place Active Text Selection Box */}
              <div className="relative my-5 p-3 outline-2 outline-[#2447f5] bg-blue-50/20">
                <span className="absolute -left-0.5 -top-6 bg-[#2447f5] text-white font-bold text-xs px-2 py-0.5">
                  Text
                </span>
                {/* 4 Corner Resize Handles */}
                <i className="absolute -left-1.5 -top-1.5 w-2.5 h-2.5 bg-white border-2 border-[#2447f5]" />
                <i className="absolute -right-1.5 -top-1.5 w-2.5 h-2.5 bg-white border-2 border-[#2447f5]" />
                <i className="absolute -left-1.5 -bottom-1.5 w-2.5 h-2.5 bg-white border-2 border-[#2447f5]" />
                <i className="absolute -right-1.5 -bottom-1.5 w-2.5 h-2.5 bg-white border-2 border-[#2447f5]" />

                {/* Animated Yellow Highlight Wipe */}
                <div className="relative">
                  <div
                    style={{ animation: "hw 7s ease-in-out infinite" }}
                    className="absolute inset-0 bg-[#ffd84d]"
                  />
                  <div className="bar relative bg-transparent border-b-2 border-[#cfcbbf] rounded-none" />
                </div>
                <div className="bar mt-2" style={{ width: "65%" }} />
              </div>

              <div className="bar" style={{ width: "80%" }} />
              <div className="bar mt-3" style={{ width: "55%" }} />

              {/* Animated Live Signature Stroke */}
              <svg
                width="200"
                height="75"
                viewBox="0 0 240 90"
                className="absolute left-8 bottom-8"
                aria-hidden="true"
              >
                <path
                  d="M8 60c24-50 40-50 44-14s18 14 36-20 28 8 52 4 30-16 60-8"
                  fill="none"
                  stroke="#2447f5"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="340"
                  style={{ animation: "hd 7s ease-in-out infinite" }}
                />
              </svg>

              {/* Animated Cursor Tooltip "You" */}
              <div
                style={{ animation: "hc 7s ease-in-out infinite" }}
                className="absolute left-0 top-0 pointer-events-none"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M5 3l14 9-6 1-3 6z"
                    fill="#0d1b3d"
                    stroke="#fff"
                    strokeWidth="1.5"
                  />
                </svg>
                <span className="bg-[#0d1b3d] text-[#f4f1ea] font-bold text-xs px-2.5 py-1 rounded-full ml-3 inline-block shadow-md">
                  You
                </span>
              </div>
            </div>

            {/* Rotating Circular Stamp Badge "SIGNED" */}
            <div
              style={{ animation: "pop 7s ease-in-out infinite" }}
              className="absolute right-4 bottom-10 w-28 h-28 rounded-full border-4 border-[#2447f5] text-[#2447f5] bg-[#f4f1ea] grid place-items-center font-black tracking-widest text-sm shadow-xl"
            >
              SIGNED
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* TICKER MARQUEE RIBBON */}
        {/* ========================================================================= */}
        <section className="border-y border-[#0d1b3d] py-6 overflow-hidden bg-white/40">
          <div className="mq serif text-4xl sm:text-5xl whitespace-nowrap text-[#0d1b3d]">
            <span>
              Edit &nbsp;·&nbsp; Sign &nbsp;·&nbsp; Merge &nbsp;·&nbsp; Split &nbsp;·&nbsp; Compress &nbsp;·&nbsp; Convert &nbsp;·&nbsp; Protect &nbsp;·&nbsp; Redact &nbsp;·&nbsp; Word &nbsp;·&nbsp; Excel &nbsp;·&nbsp;&nbsp;
            </span>
            <span>
              Edit &nbsp;·&nbsp; Sign &nbsp;·&nbsp; Merge &nbsp;·&nbsp; Split &nbsp;·&nbsp; Compress &nbsp;·&nbsp; Convert &nbsp;·&nbsp; Protect &nbsp;·&nbsp; Redact &nbsp;·&nbsp; Word &nbsp;·&nbsp; Excel &nbsp;·&nbsp;&nbsp;
            </span>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* HOW IT WORKS: 3 STAGES */}
        {/* ========================================================================= */}
        <section id="s" className="px-6 sm:px-12 lg:px-16 py-28 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left Steps Controls */}
            <div className="space-y-10">
              <div className="space-y-3">
                <div className="text-xs font-bold tracking-widest text-[#4a5168] uppercase">
                  {activeStep === 0
                    ? "01 — DROP"
                    : activeStep === 1
                    ? "02 — EDIT"
                    : "03 — SIGN & CONVERT"}
                </div>

                <h2 className="serif text-6xl sm:text-7xl lg:text-8xl leading-none text-[#0d1b3d]">
                  {activeStep === 0
                    ? "Bring your file."
                    : activeStep === 1
                    ? "Change anything."
                    : "Sign. Send. Done."}
                </h2>

                <p className="text-[#4a5168] text-lg sm:text-xl leading-relaxed max-w-md pt-2">
                  {activeStep === 0
                    ? "Drag it in. It opens instantly in browser memory, every page vector-crisp and ready to touch."
                    : activeStep === 1
                    ? "Click any text line and type. Swap an image, add shapes, fix figures, and reorganize pages."
                    : "Draw your signature, place it with sub-pixel precision, and export a clean PDF or Word document."}
                </p>
              </div>

              {/* Step Navigation Switcher */}
              <div className="flex items-center gap-3 pt-4">
                {[0, 1, 2].map((idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveStep(idx)}
                    className={`h-2.5 rounded-full transition-all duration-300 ${
                      activeStep === idx
                        ? "w-12 bg-[#2447f5]"
                        : "w-5 bg-[#aeb3c4] hover:bg-[#4a5168]"
                    }`}
                    title={`Step 0${idx + 1}`}
                  />
                ))}
              </div>

              <div className="pt-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn !bg-[#0d1b3d] !text-white text-sm"
                >
                  <span>Open PDF in Studio</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              </div>
            </div>

            {/* Right Interactive Visual Card */}
            <div className="bg-[#f3c9c0] rounded-[36px] p-8 sm:p-14 flex items-center justify-center min-h-[460px] shadow-lg">
              <div className="w-[340px] sm:w-[380px] bg-[#f4f1ea] rounded-xl p-8 sm:p-10 shadow-2xl flex flex-col gap-4 border border-[#d8d4c8] relative">
                <div className="serif text-3xl text-[#0d1b3d]">Service Agreement</div>
                <div className="bar" />
                <div className="bar" style={{ width: "80%" }} />

                {activeStep === 1 ? (
                  <div className="p-2 border-2 border-[#2447f5] rounded bg-white my-1">
                    <span className="text-[10px] font-bold text-[#2447f5] uppercase block">
                      Direct Vector Edit
                    </span>
                    <span className="text-xs font-mono font-semibold text-[#0d1b3d]">
                      Helvetica-Bold 12pt: Verified Terms
                    </span>
                  </div>
                ) : (
                  <div
                    className="bar"
                    style={{
                      width: "60%",
                      backgroundColor: activeStep === 2 ? "#ffe99a" : "#d9d6cc",
                    }}
                  />
                )}

                <div className="bar" />
                <div className="bar" style={{ width: "55%" }} />

                <svg
                  width="220"
                  height="80"
                  viewBox="0 0 240 90"
                  className="mt-4"
                  aria-label="Signature drawing"
                >
                  <path
                    d="M8 60c24-50 40-50 44-14s18 14 36-20 28 8 52 4 30-16 60-8"
                    fill="none"
                    stroke="#2447f5"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="320"
                    strokeDashoffset={activeStep === 2 ? 0 : 200}
                    className="transition-all duration-700"
                  />
                </svg>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* MONUMENTAL STATEMENT */}
        {/* ========================================================================= */}
        <section className="px-6 sm:px-12 lg:px-16 py-24 sm:py-32 max-w-6xl mx-auto">
          <h2 className="serif text-5xl sm:text-7xl lg:text-[88px] leading-[1.08] text-[#0d1b3d] max-w-5xl">
            Built for the paperwork that never ends. Quietly fixing every page, every signature, every deadline.
          </h2>
        </section>

        {/* ========================================================================= */}
        {/* FEATURE TILES GRID ("Every tool, one calm place") */}
        {/* ========================================================================= */}
        <section id="f" className="px-6 sm:px-12 lg:px-16 py-20 max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-6">
            <div>
              <h2 className="serif text-6xl sm:text-7xl lg:text-8xl leading-none text-[#0d1b3d]">
                Every tool,
                <br />
                <i className="text-[#2447f5]">one calm place.</i>
              </h2>
            </div>
            <p className="text-[#4a5168] text-lg sm:text-xl max-w-sm leading-relaxed">
              Pick a tool, drop a file, and it is done. Zero upload lag and zero menus to hunt through.
            </p>
          </div>

          {/* Grid Layout matching the Mockup */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Tile 1 (Span 7, Midnight) */}
            <div className="tile md:col-span-7 min-h-[380px] bg-[#0d1b3d] text-[#f4f1ea]">
              <div className="flex justify-between items-center">
                <span className="tn text-[#ffd84d]">01 — VECTOR TEXT</span>
              </div>

              {/* Mini Document Mockup */}
              <div className="absolute right-8 top-10 w-[220px] bg-[#f4f1ea] rounded-xl p-5 flex flex-col gap-3 shadow-xl text-[#0d1b3d]">
                <div className="bar" />
                <div
                  className="bar"
                  style={{
                    width: "70%",
                    backgroundColor: "#ffd84d",
                    outline: "2px solid #0d1b3d",
                    outlineOffset: "3px",
                  }}
                />
                <div className="bar" />
                <div className="bar" style={{ width: "50%" }} />
              </div>

              <div className="mt-auto pt-24">
                <h3 className="serif text-4xl sm:text-5xl leading-tight">Edit in place</h3>
                <p className="mt-2.5 text-base sm:text-lg opacity-80 max-w-md">
                  Click a line and type. Fonts, baseline angles, and metrics stay native without raster degradation.
                </p>
              </div>
            </div>

            {/* Tile 2 (Span 5, Golden Yellow) */}
            <div className="tile md:col-span-5 min-h-[380px] bg-[#ffd84d] text-[#0d1b3d]">
              <div className="flex justify-between items-center">
                <span className="tn">02 — SIGNATURES</span>
              </div>

              <svg
                width="220"
                height="80"
                viewBox="0 0 240 90"
                className="absolute right-8 top-12"
                aria-hidden="true"
              >
                <path
                  d="M8 60c24-50 40-50 44-14s18 14 36-20 28 8 52 4 30-16 60-8"
                  fill="none"
                  stroke="#0d1b3d"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>

              <div className="mt-auto pt-24">
                <h3 className="serif text-4xl sm:text-5xl leading-tight">Sign in seconds</h3>
                <p className="mt-2.5 text-base sm:text-lg opacity-85 max-w-sm">
                  Draw, type or upload your signature and drop it anywhere with 8-handle scaling.
                </p>
              </div>
            </div>

            {/* Tile 3 (Span 4, Coral Rose with Interactive Fanning Pages) */}
            <div className="tile md:col-span-4 min-h-[380px] bg-[#f3c9c0] text-[#0d1b3d] group">
              <div className="flex justify-between items-center">
                <span className="tn">03 — REORGANIZE</span>
              </div>

              {/* Fanning Page Cards */}
              <div className="absolute right-12 top-14 w-[140px] h-[170px]">
                <div className="pg3 a left-0 top-0" />
                <div className="pg3 b left-0 top-0 translate-x-3 translate-y-2" />
                <div className="pg3 c left-0 top-0 translate-x-6 translate-y-4" />
              </div>

              <div className="mt-auto pt-28">
                <h3 className="serif text-4xl leading-tight">Merge and split</h3>
                <p className="mt-2 text-base opacity-85">
                  Combine files, then drag pages into order. Hover to see them fan out.
                </p>
              </div>
            </div>

            {/* Tile 4 (Span 4, Sand with Shrinking Bar) */}
            <div className="tile md:col-span-4 min-h-[380px] bg-[#e7e3d8] text-[#0d1b3d]">
              <div className="flex justify-between items-center">
                <span className="tn">04 — OPTIMIZATION</span>
              </div>

              <div className="my-auto py-8">
                <div className="h-5 rounded-full bg-[#cfcbbf] overflow-hidden">
                  <div
                    style={{ animation: "shr 6s ease-in-out infinite" }}
                    className="h-full rounded-full bg-[#0d1b3d]"
                  />
                </div>
              </div>

              <div>
                <h3 className="serif text-4xl leading-tight">Compress</h3>
                <p className="mt-2 text-base opacity-85">
                  Shrink files for email attachments without losing vector typography.
                </p>
              </div>
            </div>

            {/* Tile 5 (Span 4, Electric Cobalt) */}
            <div className="tile md:col-span-4 min-h-[380px] bg-[#2447f5] text-[#f4f1ea]">
              <div className="flex justify-between items-center">
                <span className="tn text-[#ffd84d]">05 — PRIVACY</span>
              </div>

              <Shield className="w-16 h-16 text-[#ffd84d] absolute right-8 top-10" />

              <div className="mt-auto pt-24">
                <h3 className="serif text-4xl leading-tight">Private by design</h3>
                <p className="mt-2 text-base opacity-90">
                  100% in-browser WebAssembly. Your files never touch a cloud server.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* OFFICE & CONVERTERS SUITE */}
        {/* ========================================================================= */}
        <section id="converters" className="px-6 sm:px-12 lg:px-16 py-20 max-w-6xl mx-auto">
          <div className="bg-white rounded-3xl p-8 sm:p-14 border border-[#d8d4c8] shadow-sm">
            <div className="max-w-2xl mb-10">
              <span className="tn text-[#2447f5] uppercase">Format Bridges</span>
              <h3 className="serif text-4xl sm:text-6xl text-[#0d1b3d] mt-2">
                Convert across all formats without cloud lag.
              </h3>
              <p className="text-[#4a5168] text-base sm:text-lg mt-3">
                Built-in client-side OOXML compilers convert PDF pages directly into editable Microsoft Word documents, Excel grids, and high-DPI image archives.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-6 rounded-2xl bg-[#f4f1ea] border border-[#d8d4c8] space-y-2">
                <FileText className="w-8 h-8 text-[#2447f5]" />
                <h4 className="font-bold text-base text-[#0d1b3d]">PDF to Word</h4>
                <p className="text-xs text-[#4a5168] leading-relaxed">
                  Converts layout flow and typography into clean Microsoft Word (.docx) packages.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#f4f1ea] border border-[#d8d4c8] space-y-2">
                <FileSpreadsheet className="w-8 h-8 text-[#16a34a]" />
                <h4 className="font-bold text-base text-[#0d1b3d]">PDF to Excel</h4>
                <p className="text-xs text-[#4a5168] leading-relaxed">
                  Extracts tables and numeric coordinates directly into .xlsx sheets and CSVs.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#f4f1ea] border border-[#d8d4c8] space-y-2">
                <ImageIcon className="w-8 h-8 text-[#9333ea]" />
                <h4 className="font-bold text-base text-[#0d1b3d]">PDF to Images</h4>
                <p className="text-xs text-[#4a5168] leading-relaxed">
                  Exports pages to high-DPI JPG or transparent PNG images packaged in a zip.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-[#f4f1ea] border border-[#d8d4c8] space-y-2">
                <Lock className="w-8 h-8 text-[#d97706]" />
                <h4 className="font-bold text-base text-[#0d1b3d]">AES-256 Crypto</h4>
                <p className="text-xs text-[#4a5168] leading-relaxed">
                  Add user and owner passwords or permanently redact targeted content streams.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* INTERACTIVE FAQ ACCORDION */}
        {/* ========================================================================= */}
        <section
          id="faq"
          className="px-6 sm:px-12 lg:px-16 py-20 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12"
        >
          <div className="lg:col-span-4">
            <div className="text-xs font-bold tracking-widest text-[#4a5168] uppercase">
              FAQ
            </div>
            <h2 className="serif text-6xl sm:text-7xl leading-none text-[#0d1b3d] mt-4">
              Questions,
              <br />
              <i className="text-[#2447f5]">answered.</i>
            </h2>
          </div>

          <div className="lg:col-span-8">
            <details open>
              <summary>
                <span>Is PDF Suite really free to use?</span>
                <span className="pl">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p className="ans">
                Yes. PDF Suite is 100% free, open-source under the MIT License, and client-side. You can upload, edit, annotate, convert, and export without creating an account or providing a credit card.
              </p>
            </details>

            <details>
              <summary>
                <span>Do I need to install software or plugins?</span>
                <span className="pl">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p className="ans">
                No. Everything runs directly inside your browser on desktop, tablet, or mobile using WebAssembly and Web Workers. There are zero extensions, binaries, or plugins to download.
              </p>
            </details>

            <details>
              <summary>
                <span>Are my documents private? Does anything upload to the cloud?</span>
                <span className="pl">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p className="ans">
                Zero bytes leave your computer. 100% of parsing, stream surgery, rendering, and file compilation executes in your device memory. You can turn off your Wi-Fi completely and PDF Suite will continue functioning without interruption.
              </p>
            </details>

            <details>
              <summary>
                <span>How does in-place text editing work without making text blurry?</span>
                <span className="pl">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p className="ans">
                Unlike common web tools that convert pages into 72 DPI JPEG raster images, PDF Suite inspects raw PDF content streams. It detects baseline angles, CapHeight, and font metrics to substitute or reconstruct text tokens natively. Your document stays crisp at 1000% zoom.
              </p>
            </details>

            <details>
              <summary>
                <span>What happens if I accidentally refresh my browser?</span>
                <span className="pl">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p className="ans">
                Your workspace is protected. Active documents, operations ledger, zoom settings, and page position automatically sync to local browser IndexedDB. Refreshing will immediately restore your progress.
              </p>
            </details>

            <details>
              <summary>
                <span>What file types can I convert to?</span>
                <span className="pl">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p className="ans">
                You can convert PDF documents to Microsoft Word (.docx), Excel spreadsheets (.xlsx), PowerPoint slides (.pptx), plain text (.txt), and high-DPI image archives (.png / .jpg). You can also convert photos and images into standardized PDFs.
              </p>
            </details>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* CALL TO ACTION CARD */}
        {/* ========================================================================= */}
        <section className="px-6 sm:px-12 lg:px-16 pb-24 max-w-6xl mx-auto">
          <div className="bg-[#2447f5] text-[#f4f1ea] rounded-[40px] px-8 py-20 sm:p-24 text-center flex flex-col items-center gap-8 shadow-2xl">
            <h2 className="serif text-6xl sm:text-8xl lg:text-9xl leading-[0.95]">
              Open your first PDF.
            </h2>
            <p className="text-white/80 text-lg sm:text-xl max-w-lg">
              No account required. Runs 100% locally in your browser with complete privacy.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn !bg-[#ffd84d] !border-[#ffd84d] !text-[#0d1b3d] hover:!bg-white hover:!border-white text-lg !px-10 !h-14"
            >
              Upload a PDF
            </button>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* CURVED FOOTER */}
        {/* ========================================================================= */}
        <footer className="ft">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12 max-w-6xl mx-auto">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="fb"
            >
              <span>Start editing, free</span>
              <svg
                width="44"
                height="44"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>

            <div className="flex flex-wrap gap-16 text-base">
              <div className="fl">
                <b className="text-[#f4f1ea] font-semibold">Features</b>
                <a href="#s" onClick={(e) => scrollToSection(e, "s")}>How it works</a>
                <a href="#f" onClick={(e) => scrollToSection(e, "f")}>Tools</a>
                <a href="#converters" onClick={(e) => scrollToSection(e, "converters")}>Converters</a>
                <a href="#faq" onClick={(e) => scrollToSection(e, "faq")}>FAQ</a>
              </div>
              <div className="fl">
                <b className="text-[#f4f1ea] font-semibold">Creator</b>
                <a href="https://darshmodii.in" target="_blank" rel="noreferrer">
                  Darsh Modi
                </a>
                <a href="https://github.com/DevDarsh26" target="_blank" rel="noreferrer">
                  GitHub Profile
                </a>
                <a href="https://darshmodii.in" target="_blank" rel="noreferrer">
                  Portfolio
                </a>
              </div>
            </div>
          </div>

          {/* Giant Monumental Watermark */}
          <div className="wm serif" aria-hidden="true">
            PDF Suite
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center text-[#aeb3c4] text-sm pt-8 border-t border-[#2a3a66] max-w-6xl mx-auto gap-4">
            <span>© PDF Suite. Crafted with precision by Darsh Modi (darshmodii.in)</span>
            <a
              href="#"
              onClick={scrollToTop}
              className="up"
              aria-label="Back to top"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 19V5M6 11l6-6 6 6" />
              </svg>
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
};
