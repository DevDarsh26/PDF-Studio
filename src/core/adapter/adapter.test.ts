import { describe, it, expect } from "vitest";
import { createPdfAdapter, HybridPdfAdapter, MuPdfAdapter } from "./index";

describe("PDF Engine Adapter Factory", () => {
  it("creates HybridPdfAdapter by default", () => {
    const adapter = createPdfAdapter("hybrid");
    expect(adapter).toBeInstanceOf(HybridPdfAdapter);
    expect(adapter.engineName).toContain("Hybrid");
    expect(adapter.isWasmAccelerated).toBe(false);
  });

  it("creates MuPdfAdapter when requested", () => {
    const adapter = createPdfAdapter("mupdf");
    expect(adapter).toBeInstanceOf(MuPdfAdapter);
    expect(adapter.engineName).toContain("MuPDF");
    expect(adapter.isWasmAccelerated).toBe(true);
  });

  it("validates byte buffers before processing", async () => {
    const adapter = createPdfAdapter("hybrid");
    const emptyResult = await adapter.validate(new ArrayBuffer(0));
    expect(emptyResult.isValid).toBe(false);

    const validBytes = new TextEncoder().encode("%PDF-1.7\n%PDF Studio Sample Test Document\n%%EOF").buffer;
    const validResult = await adapter.validate(validBytes);
    expect(validResult.isValid).toBe(true);
    expect(validResult.version).toBe("1.7");
  });
});
