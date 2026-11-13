import { Rect, TransformMatrix, Dimensions } from "./geometry";

export type Provenance = "extracted" | "inferred";

export interface FontProfile {
  id: string; // Internal identifier (e.g., 'g_d0_f1' or '/F1')
  postScriptName: string; // True PostScript base name (e.g., 'ABCDEF+Helvetica-Bold')
  family: string; // Normalized family name (e.g., 'Helvetica')
  weight: number | string;
  style: "normal" | "italic" | "oblique";
  isBold: boolean;
  isItalic: boolean;
  isEmbedded: boolean; // True if font file is embedded in PDF stream
  isSubset: boolean; // True if name has 6-letter subset prefix (e.g., 'ABCDEF+')
  isStandard14: boolean; // True if standard Type 1 font (Helvetica, Times, Courier, etc.)
  canBeReusedForEditing: boolean; // False if subset or missing font program
  reusabilityReason: string;
  characterCoverage: {
    count: number;
    sampleCharacters: string[];
  };
  frequency: number;
  provenance: Provenance;
}

export interface ColorUsage {
  colorHex: string;
  colorSpace: "DeviceRGB" | "DeviceCMYK" | "DeviceGray" | "CalRGB" | "ICCBased" | "Unknown";
  components: number[];
  frequency: number;
  contexts: Array<"text" | "background" | "stroke" | "fill">;
  provenance: Provenance;
}

export interface ImageInfo {
  id: string;
  pageNumber: number;
  rect: Rect; // Positioning coordinates on the page
  intrinsicDimensions: {
    width: number;
    height: number;
  };
  format: "JPEG" | "PNG" | "Inline" | "Raw" | "Unknown";
  colorSpace: string;
  bitsPerComponent: number;
  aspectRatio: number;
  provenance: Provenance;
}

export interface TextToken {
  id: string;
  text: string;
  rect: Rect;
  transform: TransformMatrix;
  fontId: string;
  fontSize: number;
  colorHex: string;
  colorSpace: string;
  advanceWidth: number;
  provenance: Provenance;
}

export interface LayoutBlock {
  id: string;
  pageNumber: number;
  rect: Rect;
  lines: string[];
  tokens: TextToken[];
  dominantFontId?: string;
  dominantFontSize?: number;
  dominantColorHex?: string;
  isInferred: boolean; // Always true because PDF lacks semantic paragraph markers
  confidence: number; // 0.0 to 1.0 confidence score of clustering
}

export interface HyperlinkInfo {
  id: string;
  pageNumber: number;
  rect: Rect;
  targetType: "external_url" | "internal_page" | "named_destination";
  target: string | number;
  provenance: Provenance;
}

export interface PageMetadata {
  pageNumber: number;
  dimensions: Dimensions;
  rotation: number;
  boxTypes: {
    mediaBox: Rect;
    cropBox?: Rect;
  };
  tokenCount: number;
  imageCount: number;
  linkCount: number;
  hasAnnotations: boolean;
}

export interface DocumentAccuracyReport {
  totalTokensExtracted: number;
  fontsDirectlyExtractedCount: number;
  fontsInferredCount: number;
  colorsSampledCount: number;
  imagesDetectedCount: number;
  linksExtractedCount: number;
  nonReusableSubsetFontCount: number;
  knownLimitations: string[];
}

export interface DocumentStyleProfile {
  detectedFonts: Map<string, FontProfile>;
  frequentlyUsedColors: ColorUsage[];
  layoutBlocks: LayoutBlock[];
  textTokens: TextToken[];
  images: ImageInfo[];
  hyperlinks: HyperlinkInfo[];
  pageMetadata: PageMetadata;
  inferredProperties: {
    baseFontSize?: number;
    bodyFontFamily?: string;
    primaryTextColor?: string;
    pageBackgroundHex?: string;
    estimatedColumnLayout?: "single" | "multi" | "unstructured";
  };
  accuracyReport: DocumentAccuracyReport;
}
