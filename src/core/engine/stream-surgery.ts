import {
  PDFDocument,
  PDFRawStream,
  PDFRef,
  PDFName,
  rgb,
  StandardFonts,
  degrees,
  decodePDFRawStream,
} from "pdf-lib";
import { Rect } from "../models/geometry";
import { hexToRgb } from "../utils/color";

/**
 * Low-level PDF Content Stream Surgery Engine.
 * Supports Strategy A (Native Modification) and Strategy B (Local Reconstruction).
 */

export async function getStreamText(
  streamRefOrObj: any,
  pdfDoc: PDFDocument
): Promise<string> {
  const stream =
    streamRefOrObj instanceof PDFRef
      ? pdfDoc.context.lookup(streamRefOrObj)
      : streamRefOrObj;

  if (!stream) return "";

  if (stream instanceof PDFRawStream) {
    try {
      const decoded = decodePDFRawStream(stream);
      return new TextDecoder().decode(decoded.decode());
    } catch {
      // Fallback
    }
  }

  if (typeof (stream as any).getUnencodedContents === "function") {
    return new TextDecoder().decode((stream as any).getUnencodedContents());
  }

  if (typeof (stream as any).getContents === "function") {
    return await decompressStream((stream as any).getContents());
  }

  return "";
}

export async function decompressStream(rawBytes: Uint8Array): Promise<string> {
  // If not compressed (plain ASCII operators)
  if (rawBytes.length > 0 && rawBytes[0] === 0x71 && rawBytes[1] === 0x0a) {
    // Starts with "q\n"
    return new TextDecoder().decode(rawBytes);
  }

  try {
    const ds = new DecompressionStream("deflate");
    const writer = ds.writable.getWriter();
    writer.write(rawBytes as any);
    writer.close();
    const response = new Response(ds.readable);
    return await response.text();
  } catch {
    // Fallback if not deflate-compressed or already raw
    return new TextDecoder().decode(rawBytes);
  }
}

export async function compressStream(text: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  try {
    const cs = new CompressionStream("deflate");
    const writer = cs.writable.getWriter();
    writer.write(bytes as any);
    writer.close();
    const response = new Response(cs.readable);
    const compressed = await response.arrayBuffer();
    return new Uint8Array(compressed);
  } catch {
    return bytes;
  }
}

export function stringToHex(str: string): string {
  let hex = "";
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, "0").toUpperCase();
  }
  return hex;
}

export function escapePdfLiteral(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Strategy A: Native Content Stream Modification
 * Directly identifies and patches the text operator in the content stream.
 */
export async function applyNativeModification(
  pdfDoc: PDFDocument,
  pageIndex: number,
  originalText: string,
  replacementText: string
): Promise<boolean> {
  const page = pdfDoc.getPage(pageIndex);
  let contents: any = page.node.Contents();
  if (!contents) return false;

  if (contents instanceof PDFRef) {
    contents = pdfDoc.context.lookup(contents);
  }

  const origHex = stringToHex(originalText);
  const newHex = stringToHex(replacementText);
  const origLiteral = `(${escapePdfLiteral(originalText)})`;
  const newLiteral = `(${escapePdfLiteral(replacementText)})`;

  // Function to process and patch an individual stream
  const patchStream = async (streamRefOrObj: any): Promise<boolean> => {
    const uncompressed = await getStreamText(streamRefOrObj, pdfDoc);
    if (!uncompressed) return false;

    let modified = uncompressed;
    let found = false;

    // Check for hex-encoded Tj: <HEX> Tj
    if (uncompressed.includes(origHex)) {
      modified = uncompressed.replace(origHex, newHex);
      found = true;
    } else if (uncompressed.includes(origLiteral)) {
      // Check for literal string Tj: (str) Tj
      modified = uncompressed.replace(origLiteral, newLiteral);
      found = true;
    }

    if (found) {
      const newStream = pdfDoc.context.flateStream(modified);
      if (streamRefOrObj instanceof PDFRef) {
        pdfDoc.context.assign(streamRefOrObj, newStream);
      } else {
        const newRef = pdfDoc.context.register(newStream);
        page.node.set(PDFName.of("Contents"), newRef);
      }
      return true;
    }
    return false;
  };

  if ("size" in contents && typeof contents.size === "function") {
    // PDFArray of streams
    for (let i = 0; i < contents.size(); i++) {
      const success = await patchStream(contents.get(i));
      if (success) return true;
    }
  } else {
    return await patchStream(contents);
  }

  return false;
}

/**
 * Strategy B: Local Reconstruction
 * Suppresses the original text in the content stream (replaces with empty string),
 * and reconstructs the new text at the exact baseline coordinates with matching styling.
 */
export async function applyLocalReconstruction(
  pdfDoc: PDFDocument,
  pageIndex: number,
  originalText: string,
  replacementText: string,
  targetRect: Rect,
  options: {
    fontFamily: string;
    fontSize: number;
    fontWeight: "normal" | "bold";
    fontStyle: "normal" | "italic";
    fontColorHex: string;
  }
): Promise<boolean> {
  const page = pdfDoc.getPage(pageIndex);
  let contents: any = page.node.Contents();
  if (contents instanceof PDFRef) {
    contents = pdfDoc.context.lookup(contents);
  }

  const origHex = stringToHex(originalText);
  const origLiteral = `(${escapePdfLiteral(originalText)})`;

  // 1. Suppress the original text token from the content stream
  if (contents) {
    const suppressStream = async (streamRefOrObj: any) => {
      const uncompressed = await getStreamText(streamRefOrObj, pdfDoc);
      if (!uncompressed) return;

      let modified = uncompressed;

      if (uncompressed.includes(origHex)) {
        modified = uncompressed.replace(origHex, "");
      } else if (uncompressed.includes(origLiteral)) {
        modified = uncompressed.replace(origLiteral, "()");
      }

      if (modified !== uncompressed) {
        const newStream = pdfDoc.context.flateStream(modified);
        if (streamRefOrObj instanceof PDFRef) {
          pdfDoc.context.assign(streamRefOrObj, newStream);
        } else {
          const newRef = pdfDoc.context.register(newStream);
          page.node.set(PDFName.of("Contents"), newRef);
        }
      }
    };

    if ("size" in contents && typeof contents.size === "function") {
      for (let i = 0; i < contents.size(); i++) {
        await suppressStream(contents.get(i));
      }
    } else {
      await suppressStream(contents);
    }
  }

  // 2. Reconstruct the replacement text at the exact baseline coordinates
  const lowerFamily = (options.fontFamily || "helvetica").toLowerCase();
  let fontKey = StandardFonts.Helvetica;
  if (lowerFamily.includes("times")) {
    fontKey =
      options.fontWeight === "bold"
        ? StandardFonts.TimesRomanBold
        : StandardFonts.TimesRoman;
  } else if (lowerFamily.includes("courier")) {
    fontKey =
      options.fontWeight === "bold"
        ? StandardFonts.CourierBold
        : StandardFonts.Courier;
  } else {
    fontKey =
      options.fontWeight === "bold"
        ? StandardFonts.HelveticaBold
        : StandardFonts.Helvetica;
  }

  const font = await pdfDoc.embedFont(fontKey);
  const rgbColor = hexToRgb(options.fontColorHex) || { r: 0, g: 0, b: 0 };

  page.drawText(replacementText, {
    x: targetRect.x,
    y: targetRect.y,
    size: options.fontSize,
    font,
    color: rgb(rgbColor.r / 255, rgbColor.g / 255, rgbColor.b / 255),
  });

  return true;
}

/**
 * Strategy C: Visual Overlay Fallback
 * Used only when content stream surgery is unavailable or rejected.
 */
export async function applyVisualOverlayFallback(
  pdfDoc: PDFDocument,
  pageIndex: number,
  targetRect: Rect,
  replacementText: string,
  options: {
    fontFamily: string;
    fontSize: number;
    fontWeight: "normal" | "bold";
    fontStyle: "normal" | "italic";
    fontColorHex: string;
    backgroundColorHex?: string;
  }
): Promise<void> {
  const page = pdfDoc.getPage(pageIndex);
  const bgRgb = hexToRgb(options.backgroundColorHex || "#ffffff") || {
    r: 255,
    g: 255,
    b: 255,
  };

  // Mask original text with background color
  page.drawRectangle({
    x: targetRect.x,
    y: targetRect.y - 2,
    width: targetRect.width,
    height: targetRect.height + 4,
    color: rgb(bgRgb.r / 255, bgRgb.g / 255, bgRgb.b / 255),
  });

  // Draw replacement text on top
  const font = await pdfDoc.embedFont(
    options.fontWeight === "bold"
      ? StandardFonts.HelveticaBold
      : StandardFonts.Helvetica
  );
  const textRgb = hexToRgb(options.fontColorHex) || { r: 0, g: 0, b: 0 };

  page.drawText(replacementText, {
    x: targetRect.x,
    y: targetRect.y,
    size: options.fontSize,
    font,
    color: rgb(textRgb.r / 255, textRgb.g / 255, textRgb.b / 255),
  });
}

/**
 * Permanent Redaction:
 * Strips targeted text bytes from the content stream so the underlying information
 * CANNOT be recovered through ordinary text extraction, and draws an opaque blackout rectangle.
 */
export async function applyPermanentRedaction(
  pdfDoc: PDFDocument,
  pageIndex: number,
  targetRect: Rect,
  textToRedact?: string,
  fillColorHex: string = "#000000"
): Promise<boolean> {
  const page = pdfDoc.getPage(pageIndex);
  let contents: any = page.node.Contents();
  if (contents instanceof PDFRef) {
    contents = pdfDoc.context.lookup(contents);
  }

  // If specific text is targeted for redaction, strip its hex/literal from content stream
  if (contents && textToRedact && textToRedact.trim()) {
    const origHex = stringToHex(textToRedact);
    const origLiteral = `(${escapePdfLiteral(textToRedact)})`;

    const suppressStream = async (streamRefOrObj: any) => {
      const uncompressed = await getStreamText(streamRefOrObj, pdfDoc);
      if (!uncompressed) return;

      let modified = uncompressed;

      if (uncompressed.includes(origHex)) {
        modified = uncompressed.replaceAll(origHex, "");
      } else if (uncompressed.includes(origLiteral)) {
        modified = uncompressed.replaceAll(origLiteral, "()");
      }

      if (modified !== uncompressed) {
        const newStream = pdfDoc.context.flateStream(modified);
        if (streamRefOrObj instanceof PDFRef) {
          pdfDoc.context.assign(streamRefOrObj, newStream);
        } else {
          const newRef = pdfDoc.context.register(newStream);
          page.node.set(PDFName.of("Contents"), newRef);
        }
      }
    };

    if ("size" in contents && typeof contents.size === "function") {
      for (let i = 0; i < contents.size(); i++) {
        await suppressStream(contents.get(i));
      }
    } else {
      await suppressStream(contents);
    }
  }

  // Draw permanent opaque blackout rectangle
  const fillRgb = hexToRgb(fillColorHex) || { r: 0, g: 0, b: 0 };
  page.drawRectangle({
    x: targetRect.x,
    y: targetRect.y,
    width: targetRect.width,
    height: targetRect.height,
    color: rgb(fillRgb.r / 255, fillRgb.g / 255, fillRgb.b / 255),
    opacity: 1.0,
  });

  return true;
}
