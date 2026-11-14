"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  FileUp,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Minimize2,
  Lock,
  Unlock,
  Scissors,
  Layers,
  FileSpreadsheet,
  Presentation,
  ArrowRight,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { ToolId, ConversionProgress } from "@/core/tools/types";
import { pdfAllPagesToImages, imagesToPdf } from "@/core/tools/image-converter";
import { compressPdf, CompressionPreset, CompressResult } from "@/core/tools/pdf-compress";
import { mergePdfs, splitPdfByPages, extractPageRanges } from "@/core/tools/pdf-split-merge";
import { protectPdfWithPassword, removePdfPassword } from "@/core/tools/pdf-password";
import { pdfToWordDocx, pdfToExcel, pdfToPowerPoint, textOrOfficeToPdf } from "@/core/tools/pdf-office-converters";
import { ZipArchive } from "@/core/utils/zip-archive";
import { downloadBlob, downloadBytes } from "@/core/utils/download";
import { useEditorStore } from "@/store/editor-store";

interface PdfToolsRunnerModalProps {
  toolId: ToolId | null;
  onClose: () => void;
}

export const PdfToolsRunnerModal: React.FC<PdfToolsRunnerModalProps> = ({ toolId, onClose }) => {
  const { loadDocumentBytes, rawBytes, documentName, showToast } = useEditorStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // General Tool State
  const [selectedFiles, setSelectedFiles] = useState<{ file: File; name: string; size: number }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    downloadUrl?: string;
    downloadBlob?: Blob;
    downloadBytes?: Uint8Array;
    fileName: string;
    details?: string;
    compressStats?: CompressResult;
    canOpenInEditor?: boolean;
    editorBytes?: Uint8Array;
  } | null>(null);

  // Tool Specific Configurations
  const [imageFormat, setImageFormat] = useState<"image/png" | "image/jpeg">("image/jpeg");
  const [imageDpi, setImageDpi] = useState<number>(2.0);
  const [pageSize, setPageSize] = useState<"fit" | "a4" | "letter">("fit");
  const [compressionPreset, setCompressionPreset] = useState<CompressionPreset>("recommended");
  const [passwordInput, setPasswordInput] = useState("");
  const [splitMode, setSplitMode] = useState<"all" | "range">("all");
  const [splitRange, setSplitRange] = useState("1-3");
  const [excelFormat, setExcelFormat] = useState<"csv" | "xlsx">("csv");

  // Pre-load active PDF from editor if user has one open and tool accepts PDF
  useEffect(() => {
    if (!toolId) return;
    setErrorMsg(null);
    setSuccessResult(null);
    setProgress(null);
    setIsProcessing(false);

    const isPdfInputTool = [
      "pdf-to-jpg",
      "pdf-to-png",
      "compress-pdf",
      "protect-pdf",
      "unlock-pdf",
      "split-pdf",
      "pdf-to-word",
      "pdf-to-excel",
      "pdf-to-ppt",
    ].includes(toolId);

    if (isPdfInputTool && rawBytes && documentName) {
      const file = new File([rawBytes], documentName, { type: "application/pdf" });
      setSelectedFiles([{ file, name: documentName, size: rawBytes.byteLength }]);
    } else {
      setSelectedFiles([]);
    }
  }, [toolId, rawBytes, documentName]);

  if (!toolId) return null;

  const handleFilesAdded = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);
    setSuccessResult(null);

    const newItems = Array.from(files).map((f) => ({
      file: f,
      name: f.name,
      size: f.size,
    }));

    if (toolId === "merge-pdf" || toolId === "images-to-pdf" || toolId === "jpg-to-pdf" || toolId === "png-to-pdf") {
      setSelectedFiles((prev) => [...prev, ...newItems]);
    } else {
      setSelectedFiles([newItems[0]]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setSuccessResult(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Execute Tool Processing
  const handleRunTool = async () => {
    if (selectedFiles.length === 0) {
      setErrorMsg("Please select at least one file to process.");
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    setProgress(null);

    try {
      // 1. PDF TO JPG / PNG
      if (toolId === "pdf-to-jpg" || toolId === "pdf-to-png") {
        const buffer = await selectedFiles[0].file.arrayBuffer();
        const fmt = toolId === "pdf-to-png" ? "image/png" : "image/jpeg";
        const images = await pdfAllPagesToImages(buffer, fmt, imageDpi, 0.92, setProgress);

        if (images.length === 1) {
          const single = images[0];
          setSuccessResult({
            downloadBlob: single.blob,
            fileName: `${selectedFiles[0].name.replace(/\.pdf$/i, "")}-page1.${fmt === "image/png" ? "png" : "jpg"}`,
            details: `Successfully converted 1 page at ${imageDpi * 72} DPI.`,
          });
        } else {
          // Multi-page: Bundle into ZIP archive
          const zip = new ZipArchive();
          for (const img of images) {
            const bytes = await img.blob.arrayBuffer();
            zip.addFile(img.fileName, bytes);
          }
          const zipBlob = await zip.buildBlob();
          setSuccessResult({
            downloadBlob: zipBlob,
            fileName: `${selectedFiles[0].name.replace(/\.pdf$/i, "")}-images.zip`,
            details: `Successfully converted ${images.length} pages into a ZIP archive.`,
          });
        }
      }

      // 2. IMAGES / JPG / PNG TO PDF
      else if (toolId === "images-to-pdf" || toolId === "jpg-to-pdf" || toolId === "png-to-pdf") {
        const imagePayload = selectedFiles.map((f) => ({ file: f.file, name: f.name }));
        const pdfBytes = await imagesToPdf(imagePayload, { pageSize }, setProgress);
        const fileName = `${selectedFiles[0].name.replace(/\.[^/.]+$/, "")}-converted.pdf`;

        setSuccessResult({
          downloadBytes: pdfBytes,
          fileName,
          details: `Successfully created PDF with ${selectedFiles.length} pages.`,
          canOpenInEditor: true,
          editorBytes: pdfBytes,
        });
      }

      // 3. COMPRESS PDF
      else if (toolId === "compress-pdf") {
        const buffer = await selectedFiles[0].file.arrayBuffer();
        const stats = await compressPdf(buffer, compressionPreset, setProgress);
        const fileName = `${selectedFiles[0].name.replace(/\.pdf$/i, "")}-compressed.pdf`;

        setSuccessResult({
          downloadBytes: stats.compressedBytes,
          fileName,
          compressStats: stats,
          details: `Saved ${stats.savedPercentage}% (${formatFileSize(stats.originalSize - stats.compressedSize)} reduction)`,
          canOpenInEditor: true,
          editorBytes: stats.compressedBytes,
        });
      }

      // 4. PROTECT PDF (ADD PASSWORD)
      else if (toolId === "protect-pdf") {
        if (!passwordInput.trim()) {
          throw new Error("Please enter a password to protect the document.");
        }
        const buffer = await selectedFiles[0].file.arrayBuffer();
        const protectedBytes = await protectPdfWithPassword(buffer, passwordInput, setProgress);
        const fileName = `${selectedFiles[0].name.replace(/\.pdf$/i, "")}-protected.pdf`;

        setSuccessResult({
          downloadBytes: protectedBytes,
          fileName,
          details: "Password protection successfully applied.",
          canOpenInEditor: true,
          editorBytes: protectedBytes,
        });
      }

      // 5. UNLOCK PDF (REMOVE PASSWORD)
      else if (toolId === "unlock-pdf") {
        if (!passwordInput.trim()) {
          throw new Error("Please enter the document password to unlock it.");
        }
        const buffer = await selectedFiles[0].file.arrayBuffer();
        const unlockedBytes = await removePdfPassword(buffer, passwordInput, setProgress);
        const fileName = `${selectedFiles[0].name.replace(/\.pdf$/i, "")}-unlocked.pdf`;

        setSuccessResult({
          downloadBytes: unlockedBytes,
          fileName,
          details: "Password removed. PDF is now fully unlocked and accessible.",
          canOpenInEditor: true,
          editorBytes: unlockedBytes,
        });
      }

      // 6. SPLIT / SEPARATE PDF
      else if (toolId === "split-pdf") {
        const buffer = await selectedFiles[0].file.arrayBuffer();
        if (splitMode === "all") {
          const splitPages = await splitPdfByPages(buffer, setProgress);
          const zip = new ZipArchive();
          for (const item of splitPages) {
            zip.addFile(item.fileName, item.bytes);
          }
          const zipBlob = await zip.buildBlob();
          setSuccessResult({
            downloadBlob: zipBlob,
            fileName: `${selectedFiles[0].name.replace(/\.pdf$/i, "")}-split.zip`,
            details: `Extracted ${splitPages.length} individual pages into a ZIP archive.`,
          });
        } else {
          const rangeBytes = await extractPageRanges(buffer, splitRange, setProgress);
          setSuccessResult({
            downloadBytes: rangeBytes,
            fileName: `${selectedFiles[0].name.replace(/\.pdf$/i, "")}-pages-${splitRange.replace(/,/g, "-")}.pdf`,
            details: `Extracted page range "${splitRange}".`,
            canOpenInEditor: true,
            editorBytes: rangeBytes,
          });
        }
      }

      // 7. MERGE PDFS
      else if (toolId === "merge-pdf") {
        const docs = await Promise.all(
          selectedFiles.map(async (f) => ({
            bytes: await f.file.arrayBuffer(),
            name: f.name,
          }))
        );
        const mergedBytes = await mergePdfs(docs, setProgress);
        setSuccessResult({
          downloadBytes: mergedBytes,
          fileName: "merged-document.pdf",
          details: `Successfully merged ${selectedFiles.length} PDF documents into one.`,
          canOpenInEditor: true,
          editorBytes: mergedBytes,
        });
      }

      // 8. PDF TO WORD (.DOCX)
      else if (toolId === "pdf-to-word") {
        const buffer = await selectedFiles[0].file.arrayBuffer();
        const docxBlob = await pdfToWordDocx(buffer, setProgress);
        setSuccessResult({
          downloadBlob: docxBlob,
          fileName: `${selectedFiles[0].name.replace(/\.pdf$/i, "")}.docx`,
          details: "Extracted all pages, text flow, and headings into editable Microsoft Word (.docx) document.",
        });
      }

      // 9. PDF TO EXCEL (.XLSX / .CSV)
      else if (toolId === "pdf-to-excel") {
        const buffer = await selectedFiles[0].file.arrayBuffer();
        const excelBlob = await pdfToExcel(buffer, excelFormat, setProgress);
        setSuccessResult({
          downloadBlob: excelBlob,
          fileName: `${selectedFiles[0].name.replace(/\.pdf$/i, "")}.${excelFormat}`,
          details: `Extracted tables and organized data rows into ${excelFormat.toUpperCase()} spreadsheet.`,
        });
      }

      // 10. PDF TO POWERPOINT (.PPT)
      else if (toolId === "pdf-to-ppt") {
        const buffer = await selectedFiles[0].file.arrayBuffer();
        const pptBlob = await pdfToPowerPoint(buffer, setProgress);
        setSuccessResult({
          downloadBlob: pptBlob,
          fileName: `${selectedFiles[0].name.replace(/\.pdf$/i, "")}-presentation.html`,
          details: "Converted all PDF pages into interactive presentation slides.",
        });
      }

      // 11. WORD / EXCEL / TEXT TO PDF
      else if (toolId === "word-to-pdf" || toolId === "excel-to-pdf") {
        const text = await selectedFiles[0].file.text();
        const pdfBytes = await textOrOfficeToPdf(text, selectedFiles[0].name, setProgress);
        setSuccessResult({
          downloadBytes: pdfBytes,
          fileName: `${selectedFiles[0].name.replace(/\.[^/.]+$/, "")}.pdf`,
          details: "Successfully formatted and rendered into a PDF document.",
          canOpenInEditor: true,
          editorBytes: pdfBytes,
        });
      }
    } catch (err: any) {
      console.error("Tool execution error:", err);
      setErrorMsg(err.message || "An error occurred while processing the file.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadResult = () => {
    if (!successResult) return;
    if (successResult.downloadBlob) {
      downloadBlob(successResult.downloadBlob, successResult.fileName);
    } else if (successResult.downloadBytes) {
      downloadBytes(successResult.downloadBytes, successResult.fileName);
    }
    showToast(`Downloaded ${successResult.fileName}`);
  };

  const handleOpenInEditor = async () => {
    if (!successResult?.editorBytes) return;
    try {
      await loadDocumentBytes(
        successResult.editorBytes.buffer.slice(
          successResult.editorBytes.byteOffset,
          successResult.editorBytes.byteOffset + successResult.editorBytes.byteLength
        ) as ArrayBuffer,
        successResult.fileName
      );
      showToast(`Loaded ${successResult.fileName} in PDF Studio editor`);
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  // Get User-Friendly Title & Description
  const getToolMeta = () => {
    switch (toolId) {
      case "pdf-to-jpg":
        return { title: "PDF to JPG", desc: "Convert each PDF page into high-quality JPG images.", icon: ImageIcon };
      case "pdf-to-png":
        return { title: "PDF to PNG", desc: "Convert PDF pages to lossless transparent PNG images.", icon: ImageIcon };
      case "jpg-to-pdf":
      case "png-to-pdf":
      case "images-to-pdf":
        return { title: "Images to PDF", desc: "Combine JPG, PNG, or WebP images into a single PDF document.", icon: ImageIcon };
      case "compress-pdf":
        return { title: "Compress PDF", desc: "Reduce PDF file size while maintaining readability and vector paths.", icon: Minimize2 };
      case "protect-pdf":
        return { title: "Add Password", desc: "Encrypt and secure your PDF document with client-side password protection.", icon: Lock };
      case "unlock-pdf":
        return { title: "Unlock PDF", desc: "Remove password security from your PDF file.", icon: Unlock };
      case "split-pdf":
        return { title: "Split / Separate PDF", desc: "Separate PDF into individual pages or extract custom page ranges.", icon: Scissors };
      case "merge-pdf":
        return { title: "Merge PDFs", desc: "Combine multiple PDF documents into one unified file.", icon: Layers };
      case "pdf-to-word":
        return { title: "PDF to Word", desc: "Convert PDF documents to editable Microsoft Word (.docx) files.", icon: FileText };
      case "pdf-to-excel":
        return { title: "PDF to Excel", desc: "Extract tables and structured data to Excel (.xlsx) or CSV.", icon: FileSpreadsheet };
      case "pdf-to-ppt":
        return { title: "PDF to PowerPoint", desc: "Convert PDF pages into presentation slides.", icon: Presentation };
      case "word-to-pdf":
        return { title: "Word / Text to PDF", desc: "Convert text or Word documents directly to PDF.", icon: FileText };
      case "excel-to-pdf":
        return { title: "Excel / CSV to PDF", desc: "Convert tabular spreadsheets and CSV files into clean PDF tables.", icon: FileSpreadsheet };
      default:
        return { title: "PDF Tool", desc: "Process and convert your documents 100% locally.", icon: Sparkles };
    }
  };

  const meta = getToolMeta();
  const IconComponent = meta.icon;

  const isMultiFileTool =
    toolId === "merge-pdf" || toolId === "images-to-pdf" || toolId === "jpg-to-pdf" || toolId === "png-to-pdf";

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">{meta.title}</h2>
              <p className="text-xs text-slate-500">{meta.desc}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs text-slate-700">
          {/* File Selector Dropzone */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              multiple={isMultiFileTool}
              onChange={(e) => handleFilesAdded(e.target.files)}
              className="hidden"
            />

            {selectedFiles.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileUp className="w-6 h-6" />
                </div>
                <div className="text-sm font-semibold text-slate-800">
                  Click to select {isMultiFileTool ? "files" : "a file"}
                </div>
                <p className="text-[11px] text-slate-500">
                  Runs 100% locally in your browser. No files are uploaded to any server.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Selected {selectedFiles.length === 1 ? "File" : `Files (${selectedFiles.length})`}:</span>
                  {isMultiFileTool && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-blue-600 hover:text-blue-700 flex items-center space-x-1 font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add More</span>
                    </button>
                  )}
                </div>

                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {selectedFiles.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs hover:border-slate-300 transition"
                    >
                      <div className="flex items-center space-x-2.5 truncate max-w-[80%]">
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="font-medium text-slate-800 truncate">{item.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          ({formatFileSize(item.size)})
                        </span>
                      </div>
                      <button
                        onClick={() => removeFile(idx)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded transition"
                        title="Remove file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tool Options Configuration */}
          {selectedFiles.length > 0 && !successResult && (
            <div className="space-y-4 pt-2 border-t border-slate-100">
              {/* PDF TO JPG / PNG OPTIONS */}
              {(toolId === "pdf-to-jpg" || toolId === "pdf-to-png") && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Resolution Quality</label>
                    <select
                      value={imageDpi}
                      onChange={(e) => setImageDpi(parseFloat(e.target.value))}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-hidden"
                    >
                      <option value={1.0}>Standard (72 DPI - Fast)</option>
                      <option value={2.0}>High Quality (150 DPI - Recommended)</option>
                      <option value={3.5}>Ultra Sharp (250 DPI - Large)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Output Format</label>
                    <div className="p-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-700">
                      {toolId === "pdf-to-png" ? "PNG (Lossless)" : "JPEG (Compressed)"}
                    </div>
                  </div>
                </div>
              )}

              {/* IMAGES TO PDF OPTIONS */}
              {(toolId === "images-to-pdf" || toolId === "jpg-to-pdf" || toolId === "png-to-pdf") && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Page Layout</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPageSize("fit")}
                      className={`p-2 rounded-lg border text-center font-medium transition ${
                        pageSize === "fit"
                          ? "bg-blue-50 border-blue-500 text-blue-700 font-semibold"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      Fit Image Size
                    </button>
                    <button
                      type="button"
                      onClick={() => setPageSize("a4")}
                      className={`p-2 rounded-lg border text-center font-medium transition ${
                        pageSize === "a4"
                          ? "bg-blue-50 border-blue-500 text-blue-700 font-semibold"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      A4 Standard
                    </button>
                    <button
                      type="button"
                      onClick={() => setPageSize("letter")}
                      className={`p-2 rounded-lg border text-center font-medium transition ${
                        pageSize === "letter"
                          ? "bg-blue-50 border-blue-500 text-blue-700 font-semibold"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      US Letter
                    </button>
                  </div>
                </div>
              )}

              {/* COMPRESS OPTIONS */}
              {toolId === "compress-pdf" && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">Compression Level</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setCompressionPreset("recommended")}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        compressionPreset === "recommended"
                          ? "bg-blue-50 border-blue-500 text-blue-900"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <span className="block font-bold text-xs">Recommended</span>
                      <span className="text-[10px] text-slate-500">Optimal size & clarity</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompressionPreset("extreme")}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        compressionPreset === "extreme"
                          ? "bg-blue-50 border-blue-500 text-blue-900"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <span className="block font-bold text-xs">Extreme</span>
                      <span className="text-[10px] text-slate-500">Maximum compression</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompressionPreset("low")}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        compressionPreset === "low"
                          ? "bg-blue-50 border-blue-500 text-blue-900"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <span className="block font-bold text-xs">Low</span>
                      <span className="text-[10px] text-slate-500">High quality preservation</span>
                    </button>
                  </div>
                </div>
              )}

              {/* PASSWORD OPTIONS */}
              {(toolId === "protect-pdf" || toolId === "unlock-pdf") && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {toolId === "protect-pdf" ? "Create Document Password" : "Enter Current Password"}
                  </label>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter password..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-hidden"
                  />
                </div>
              )}

              {/* SPLIT OPTIONS */}
              {toolId === "split-pdf" && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={splitMode === "all"}
                        onChange={() => setSplitMode("all")}
                        className="text-blue-600"
                      />
                      <span className="font-medium text-xs">Extract all pages (into ZIP)</span>
                    </label>
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={splitMode === "range"}
                        onChange={() => setSplitMode("range")}
                        className="text-blue-600"
                      />
                      <span className="font-medium text-xs">Custom page range</span>
                    </label>
                  </div>

                  {splitMode === "range" && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Page Ranges</label>
                      <input
                        type="text"
                        value={splitRange}
                        onChange={(e) => setSplitRange(e.target.value)}
                        placeholder="e.g. 1-3, 5, 8-10"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-hidden"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Progress Indicator */}
          {isProcessing && (
            <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200/80 space-y-2 text-center animate-in fade-in">
              <div className="flex items-center justify-center space-x-2 text-blue-700 font-semibold text-xs">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{progress?.stage || "Processing document locally..."}</span>
              </div>
              {progress && (
                <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-200"
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2.5 text-red-800 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Result View */}
          {successResult && (
            <div className="p-5 bg-emerald-50/70 border border-emerald-200/90 rounded-2xl space-y-4 text-emerald-950 animate-in zoom-in-95 duration-200">
              <div className="flex items-center space-x-2 text-emerald-800 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Ready to Download</span>
              </div>

              <div className="text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">{successResult.fileName}</p>
                {successResult.details && <p className="text-slate-500">{successResult.details}</p>}
                {successResult.compressStats && (
                  <div className="grid grid-cols-3 gap-2 text-center pt-2 font-mono">
                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <span className="block text-slate-400 text-[10px]">Before</span>
                      <span className="font-bold text-slate-800">
                        {formatFileSize(successResult.compressStats.originalSize)}
                      </span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-slate-200">
                      <span className="block text-slate-400 text-[10px]">After</span>
                      <span className="font-bold text-emerald-600">
                        {formatFileSize(successResult.compressStats.compressedSize)}
                      </span>
                    </div>
                    <div className="p-2 bg-emerald-100/80 rounded-lg border border-emerald-200">
                      <span className="block text-emerald-700 text-[10px]">Reduction</span>
                      <span className="font-bold text-emerald-800">
                        -{successResult.compressStats.savedPercentage}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  onClick={handleDownloadResult}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/20 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Download File</span>
                </button>

                {successResult.canOpenInEditor && (
                  <button
                    onClick={handleOpenInEditor}
                    className="py-2.5 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-medium text-xs flex items-center space-x-1 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    <span>Open in Editor</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">100% In-Browser Local Processing</span>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition"
            >
              Close
            </button>

            {!successResult && (
              <button
                onClick={handleRunTool}
                disabled={selectedFiles.length === 0 || isProcessing}
                className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition disabled:opacity-50 flex items-center space-x-1.5"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <span>Convert Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
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

