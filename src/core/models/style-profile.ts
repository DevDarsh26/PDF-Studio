import { Rect, TransformMatrix } from "./geometry";

export interface FontProfile {
  id: string;
  name: string;
  family: string;
  weight: number | string;
  isBold: boolean;
  isItalic: boolean;
  isEmbedded: boolean;
  isSubset: boolean;
  frequency: number;
}

export interface ColorUsage {
  colorHex: string;
  colorSpace: "RGB" | "CMYK" | "Grayscale";
  components: number[];
  frequency: number;
  contexts: Array<"text" | "background" | "stroke">;
}

export interface TextToken {
  id: string;
  text: string;
  rect: Rect;
  transform: TransformMatrix;
  fontId: string;
  fontSize: number;
  colorHex: string;
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
}

export interface HyperlinkInfo {
  id: string;
  pageNumber: number;
  rect: Rect;
  targetType: "external_url" | "internal_page" | "named_destination";
  target: string | number;
}

export interface DocumentStyleProfile {
  detectedFonts: Map<string, FontProfile>;
  frequentlyUsedColors: ColorUsage[];
  layoutBlocks: LayoutBlock[];
  hyperlinks: HyperlinkInfo[];
  inferredProperties: {
    baseFontSize?: number;
    bodyFontFamily?: string;
    primaryTextColor?: string;
    pageBackgroundHex?: string;
  };
}

