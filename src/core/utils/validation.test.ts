import { describe, it, expect } from "vitest";
import { validatePdfBytes, isFileExceedingMemoryLimit } from "./validation";

describe("validatePdfBytes", () => {
  it("rejects empty buffers", () => {
    const empty = new ArrayBuffer(0);
    const result = validatePdfBytes(empty);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("empty");
  });

  it("rejects buffers smaller than minimum PDF size", () => {
    const small = new ArrayBuffer(10);
    const result = validatePdfBytes(small);
    expect(result.isValid).toBe(false);
  });

  it("rejects files without %PDF- magic header", () => {
    const fakeBytes = new Uint8Array(64);
    fakeBytes.set([0x47, 0x49, 0x46, 0x38]); // GIF8
    const result = validatePdfBytes(fakeBytes.buffer);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("%PDF-");
  });

  it("successfully validates valid PDF header and extracts version", () => {
    const validHeader = "%PDF-1.7\n%some binary data\n%%EOF";
    const buffer = new TextEncoder().encode(validHeader).buffer;
    const result = validatePdfBytes(buffer);
    expect(result.isValid).toBe(true);
    expect(result.version).toBe("1.7");
    expect(result.isEncrypted).toBe(false);
  });

  it("detects encryption flags in trailer", () => {
    const encryptedPdf = "%PDF-1.6\n/Trailer << /Encrypt 12 0 R >>\n%%EOF";
    const buffer = new TextEncoder().encode(encryptedPdf).buffer;
    const result = validatePdfBytes(buffer);
    expect(result.isValid).toBe(true);
    expect(result.isEncrypted).toBe(true);
  });
});

describe("isFileExceedingMemoryLimit", () => {
  it("flags files larger than recommended browser threshold (250MB)", () => {
    expect(isFileExceedingMemoryLimit(300 * 1024 * 1024)).toBe(true);
    expect(isFileExceedingMemoryLimit(50 * 1024 * 1024)).toBe(false);
  });
});

