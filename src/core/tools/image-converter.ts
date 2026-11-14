import { PDFDocument, PageSizes } from "pdf-lib";
import { ConversionProgress } from "./types";

/**
 * Configure PDF.js worker safely for client-side execution.
 */
async function getPdfJs() {
  const pdfjsLib = await import("pdfjs-dist");
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  }
  return pdfjsLib;
}

/**
 * Render an individual PDF page to an image Blob (PNG or JPEG).
 */
export async function pdfPageToImage(
  pdfBytes: ArrayBuffer,
  pageNumber: number,
  format: "image/png" | "image/jpeg" = "image/jpeg",
  dpiScale: number = 2.0, // 2.0 ≈ 144-150 DPI for crisp export
  quality: number = 0.92
): Promise<Blob> {
  const pdfjsLib = await getPdfJs();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes.slice(0)) });
  const pdf = await loadingTask.promise;

  if (pageNumber < 1 || pageNumber > pdf.numPages) {
    throw new Error(`Page ${pageNumber} out of range (1 - ${pdf.numPages})`);
  }

  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: dpiScale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create 2D canvas context");

  // Fill white background for JPEG exports
  if (format === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const renderTask = page.render({
    canvasContext: ctx,
    viewport,
  });
  await renderTask.promise;

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to encode canvas to image blob"));
      },
      format,
      quality
    );
  });
}

/**
 * Render all pages of a PDF to image Blobs with progress updates.
 */
export async function pdfAllPagesToImages(
  pdfBytes: ArrayBuffer,
  format: "image/png" | "image/jpeg" = "image/jpeg",
  dpiScale: number = 2.0,
  quality: number = 0.92,
  onProgress?: (progress: ConversionProgress) => void
): Promise<{ pageNumber: number; blob: Blob; fileName: string }[]> {
  const pdfjsLib = await getPdfJs();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes.slice(0)) });
  const pdf = await loadingTask.promise;
  const total = pdf.numPages;
  const results: { pageNumber: number; blob: Blob; fileName: string }[] = [];

  const ext = format === "image/png" ? "png" : "jpg";

  for (let i = 1; i <= total; i++) {
    if (onProgress) {
      onProgress({
        current: i,
        total,
        stage: `Rendering page ${i} of ${total}...`,
        percentage: Math.round(((i - 1) / total) * 100),
      });
    }

    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: dpiScale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    if (format === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const renderTask = page.render({
      canvasContext: ctx,
      viewport,
    });
    await renderTask.promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error(`Failed to encode page ${i} image`));
        },
        format,
        quality
      );
    });

    results.push({
      pageNumber: i,
      blob,
      fileName: `page-${i}.${ext}`,
    });
  }

  if (onProgress) {
    onProgress({
      current: total,
      total,
      stage: "Completed all pages",
      percentage: 100,
    });
  }

  return results;
}

/**
 * Read image dimensions and decode to HTMLImageElement or ImageBitmap.
 */
function readImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for PDF conversion"));
    };
    img.src = url;
  });
}

/**
 * Convert an image file (PNG, JPG, WebP, GIF, etc.) into an ArrayBuffer compatible with pdf-lib.
 * Automatically transcode to PNG/JPEG canvas buffer if needed.
 */
async function prepareImageBytes(file: Blob): Promise<{ bytes: Uint8Array; format: "png" | "jpeg"; width: number; height: number }> {
  const type = file.type.toLowerCase();
  
  if (type === "image/jpeg" || type === "image/jpg") {
    const buffer = await file.arrayBuffer();
    const img = await readImageElement(file);
    return { bytes: new Uint8Array(buffer), format: "jpeg", width: img.naturalWidth, height: img.naturalHeight };
  }

  if (type === "image/png") {
    const buffer = await file.arrayBuffer();
    const img = await readImageElement(file);
    return { bytes: new Uint8Array(buffer), format: "png", width: img.naturalWidth, height: img.naturalHeight };
  }

  // For WebP, AVIF, BMP, GIF, SVG: Render to offscreen canvas and convert to PNG
  const img = await readImageElement(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || 800;
  canvas.height = img.naturalHeight || 600;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");
  ctx.drawImage(img, 0, 0);

  const pngBlob = await new Promise<Blob>((res, rej) => {
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("Transcoding failed"))), "image/png");
  });

  const buffer = await pngBlob.arrayBuffer();
  return { bytes: new Uint8Array(buffer), format: "png", width: canvas.width, height: canvas.height };
}

/**
 * Convert one or more images into a single multi-page PDF document.
 */
export async function imagesToPdf(
  images: { file: File | Blob; name: string }[],
  options?: {
    pageSize?: "fit" | "a4" | "letter";
    orientation?: "portrait" | "landscape" | "auto";
    margin?: number; // points
  },
  onProgress?: (progress: ConversionProgress) => void
): Promise<Uint8Array> {
  if (images.length === 0) {
    throw new Error("No images provided for PDF conversion.");
  }

  const pdfDoc = await PDFDocument.create();
  const total = images.length;
  const margin = options?.margin ?? 20;

  for (let i = 0; i < total; i++) {
    const imgItem = images[i];
    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        stage: `Converting ${imgItem.name} (${i + 1}/${total})...`,
        percentage: Math.round((i / total) * 100),
      });
    }

    const { bytes, format, width: naturalW, height: naturalH } = await prepareImageBytes(imgItem.file);

    let embeddedImage;
    if (format === "jpeg") {
      embeddedImage = await pdfDoc.embedJpg(bytes);
    } else {
      embeddedImage = await pdfDoc.embedPng(bytes);
    }

    let pageWidth = naturalW;
    let pageHeight = naturalH;
    let drawX = 0;
    let drawY = 0;
    let drawW = naturalW;
    let drawH = naturalH;

    if (options?.pageSize === "a4") {
      const isLandscape =
        options.orientation === "landscape" ||
        (options.orientation === "auto" && naturalW > naturalH);
      const baseDims = isLandscape ? [PageSizes.A4[1], PageSizes.A4[0]] : PageSizes.A4;
      pageWidth = baseDims[0];
      pageHeight = baseDims[1];

      // Scale image to fit within page margins preserving aspect ratio
      const maxW = pageWidth - margin * 2;
      const maxH = pageHeight - margin * 2;
      const scale = Math.min(maxW / naturalW, maxH / naturalH, 1.0);
      drawW = naturalW * scale;
      drawH = naturalH * scale;
      drawX = (pageWidth - drawW) / 2;
      drawY = (pageHeight - drawH) / 2;
    } else if (options?.pageSize === "letter") {
      const isLandscape =
        options.orientation === "landscape" ||
        (options.orientation === "auto" && naturalW > naturalH);
      const baseDims = isLandscape ? [PageSizes.Letter[1], PageSizes.Letter[0]] : PageSizes.Letter;
      pageWidth = baseDims[0];
      pageHeight = baseDims[1];

      const maxW = pageWidth - margin * 2;
      const maxH = pageHeight - margin * 2;
      const scale = Math.min(maxW / naturalW, maxH / naturalH, 1.0);
      drawW = naturalW * scale;
      drawH = naturalH * scale;
      drawX = (pageWidth - drawW) / 2;
      drawY = (pageHeight - drawH) / 2;
    }

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    page.drawImage(embeddedImage, {
      x: drawX,
      y: drawY,
      width: drawW,
      height: drawH,
    });
  }

  if (onProgress) {
    onProgress({
      current: total,
      total,
      stage: "Finalizing PDF...",
      percentage: 100,
    });
  }

  return await pdfDoc.save();
}
