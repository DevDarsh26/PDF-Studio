import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { HybridPdfAdapter } from "../adapter/hybrid-adapter";
import {
  createSinglePageSamplePdf,
  createMultiPageSamplePdf,
} from "../utils/sample-pdfs";

describe("Document Analysis & Automatic Style Detection Engine", () => {
  let adapter: HybridPdfAdapter;

  beforeEach(() => {
    adapter = new HybridPdfAdapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  it("extracts text tokens with exact coordinates, baseline, and font metrics", async () => {
    const buffer = await createSinglePageSamplePdf();
    await adapter.loadDocument(buffer);

    const profile = await adapter.analyzeStyleProfile(1);
    expect(profile.textTokens.length).toBeGreaterThan(0);

    const firstToken = profile.textTokens[0];
    expect(firstToken.text).toBeDefined();
    expect(firstToken.rect.width).toBeGreaterThan(0);
    expect(firstToken.rect.height).toBeGreaterThan(0);
    expect(firstToken.fontSize).toBeGreaterThan(0);
    expect(firstToken.provenance).toBe("extracted");
  });

  it("identifies fonts, detects standard 14 vs subset, and determines reuse eligibility", async () => {
    const buffer = await createSinglePageSamplePdf();
    await adapter.loadDocument(buffer);

    const profile = await adapter.analyzeStyleProfile(1);
    const fonts = Array.from(profile.detectedFonts.values());

    expect(fonts.length).toBeGreaterThan(0);

    fonts.forEach((font) => {
      expect(font.family).toBeDefined();
      expect(font.postScriptName).toBeDefined();
      expect(font.provenance).toBe("extracted");
      expect(typeof font.canBeReusedForEditing).toBe("boolean");
      expect(font.reusabilityReason.length).toBeGreaterThan(0);

      // Character coverage must track sample characters
      expect(font.characterCoverage.count).toBeGreaterThan(0);
      expect(font.characterCoverage.sampleCharacters.length).toBeGreaterThan(0);
    });
  });

  it("identifies color spaces and computes dominant color usage", async () => {
    const buffer = await createSinglePageSamplePdf();
    await adapter.loadDocument(buffer);

    const profile = await adapter.analyzeStyleProfile(1);
    expect(profile.frequentlyUsedColors.length).toBeGreaterThan(0);

    const topColor = profile.frequentlyUsedColors[0];
    expect(topColor.colorHex).toMatch(/^#[0-9a-f]{6}$/i);
    expect(["DeviceRGB", "DeviceCMYK", "DeviceGray", "CalRGB", "ICCBased", "Unknown"]).toContain(
      topColor.colorSpace
    );
    expect(topColor.frequency).toBeGreaterThan(0);
  });

  it("extracts embedded raster image XObjects with bounding boxes and aspect ratio", async () => {
    const buffer = await createSinglePageSamplePdf();
    await adapter.loadDocument(buffer);

    const profile = await adapter.analyzeStyleProfile(1);
    expect(profile.images.length).toBeGreaterThanOrEqual(1);

    const img = profile.images[0];
    expect(img.rect.width).toBeGreaterThan(0);
    expect(img.rect.height).toBeGreaterThan(0);
    expect(img.aspectRatio).toBeGreaterThan(0);
    expect(img.provenance).toBe("extracted");
  });

  it("extracts interactive hyperlink annotations with target URLs and coordinates", async () => {
    const buffer = await createSinglePageSamplePdf();
    await adapter.loadDocument(buffer);

    const profile = await adapter.analyzeStyleProfile(1);
    expect(profile.hyperlinks.length).toBeGreaterThanOrEqual(1);

    const link = profile.hyperlinks[0];
    expect(link.targetType).toBe("external_url");
    expect(String(link.target)).toContain("https://");
    expect(link.rect.width).toBeGreaterThan(0);
    expect(link.rect.height).toBeGreaterThan(0);
    expect(link.provenance).toBe("extracted");
  });

  it("clusters lines into inferred layout blocks while marking data as inferred", async () => {
    const buffer = await createSinglePageSamplePdf();
    await adapter.loadDocument(buffer);

    const profile = await adapter.analyzeStyleProfile(1);
    expect(profile.layoutBlocks.length).toBeGreaterThan(0);

    profile.layoutBlocks.forEach((block) => {
      expect(block.isInferred).toBe(true);
      expect(block.confidence).toBeGreaterThan(0);
      expect(block.lines.length).toBeGreaterThan(0);
      expect(block.rect.width).toBeGreaterThan(0);
      expect(block.rect.height).toBeGreaterThan(0);
    });
  });

  it("generates structured accuracy reports and lists known PDF technical limitations", async () => {
    const buffer = await createMultiPageSamplePdf();
    await adapter.loadDocument(buffer);

    const profile = await adapter.analyzeStyleProfile(1);
    const report = profile.accuracyReport;

    expect(report.totalTokensExtracted).toBeGreaterThan(0);
    expect(report.fontsDirectlyExtractedCount).toBeGreaterThan(0);
    expect(report.knownLimitations.length).toBeGreaterThan(0);
    expect(report.knownLimitations.some((lim) => lim.includes("heuristic"))).toBe(true);
  });
});
