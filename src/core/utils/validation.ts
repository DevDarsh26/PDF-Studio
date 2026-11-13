import { DocumentValidationResult } from "../models/document";

const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const MAX_RECOMMENDED_BROWSER_SIZE_BYTES = 250 * 1024 * 1024; // 250 MB

/**
 * Validates PDF byte structure directly in the browser before invoking heavy parsers.
 */
export function validatePdfBytes(buffer: ArrayBuffer): DocumentValidationResult {
  if (!buffer || buffer.byteLength === 0) {
    return {
      isValid: false,
      error: "File is empty or unreadable.",
      isEncrypted: false,
    };
  }

  if (buffer.byteLength < 32) {
    return {
      isValid: false,
      error: "File is too small to be a valid PDF document.",
      isEncrypted: false,
    };
  }

  const bytes = new Uint8Array(buffer, 0, Math.min(1024, buffer.byteLength));

  // Search for %PDF- within the first 1024 bytes (spec allows comments or BOM before header)
  let headerIndex = -1;
  for (let i = 0; i <= bytes.length - PDF_MAGIC_BYTES.length; i++) {
    let match = true;
    for (let j = 0; j < PDF_MAGIC_BYTES.length; j++) {
      if (bytes[i + j] !== PDF_MAGIC_BYTES[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    return {
      isValid: false,
      error: "Invalid file format: Missing '%PDF-' header signature.",
      isEncrypted: false,
    };
  }

  // Extract PDF version string (e.g. "1.4", "1.7", "2.0")
  let version = "1.4";
  try {
    const versionBytes = bytes.slice(headerIndex + 5, headerIndex + 8);
    const versionStr = String.fromCharCode(...versionBytes);
    if (/^\d\.\d$/.test(versionStr)) {
      version = versionStr;
    }
  } catch {
    // Keep fallback version
  }

  // Check tail bytes for EOF marker (last 2048 bytes)
  const tailLength = Math.min(2048, buffer.byteLength);
  const tailBytes = new Uint8Array(buffer, buffer.byteLength - tailLength, tailLength);
  let tailStr = "";
  for (let i = 0; i < tailBytes.length; i++) {
    tailStr += String.fromCharCode(tailBytes[i]);
  }

  const hasEof = tailStr.includes("%%EOF");
  if (!hasEof) {
    // Some poorly authored PDFs lack clean %%EOF but are still parseable;
    // we mark as valid with a caution or allow parsing engine to attempt recovery.
  }

  // Inspect for standard encryption flags (/Encrypt) in trailer/cross-reference
  const isEncrypted = tailStr.includes("/Encrypt");

  return {
    isValid: true,
    version,
    isEncrypted,
  };
}

export function isFileExceedingMemoryLimit(fileSizeBytes: number): boolean {
  return fileSizeBytes > MAX_RECOMMENDED_BROWSER_SIZE_BYTES;
}

