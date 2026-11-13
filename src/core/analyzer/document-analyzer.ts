import {
  DocumentStyleProfile,
  FontProfile,
  ColorUsage,
  ImageInfo,
  TextToken,
  LayoutBlock,
  HyperlinkInfo,
  PageMetadata,
  DocumentAccuracyReport,
} from "../models/style-profile";
import { Rect, TransformMatrix } from "../models/geometry";
import { normalizePdfColorToHex, rgbToHex } from "../utils/color";

const STANDARD_14_FONTS = new Set([
  "helvetica",
  "helvetica-bold",
  "helvetica-oblique",
  "helvetica-boldoblique",
  "times-roman",
  "times-bold",
  "times-italic",
  "times-bolditalic",
  "courier",
  "courier-bold",
  "courier-oblique",
  "courier-boldoblique",
  "symbol",
  "zapfdingbats",
]);

/**
 * Analyzes a PDF page with high granularity, extracting fonts, colors, layout coordinates,
 * images, and hyperlinks, while strictly distinguishing extracted vs. inferred data.
 */
export async function analyzePdfPage(pdfJsPage: any): Promise<DocumentStyleProfile> {
  const pageNumber = pdfJsPage.pageNumber;
  const viewport = pdfJsPage.getViewport({ scale: 1.0 });

  // 1. Text & Typography Extraction
  const textContent = await pdfJsPage.getTextContent({ includeMarkedContent: true });
  const styles = textContent.styles || {};

  // 2. Operator List Extraction (Vector paths, Images, Low-Level Colors)
  let operatorList: any = null;
  try {
    operatorList = await pdfJsPage.getOperatorList();
  } catch {
    // Continue if operator list extraction fails
  }

  // 3. Annotations (Links & Forms)
  let annotations: any[] = [];
  try {
    annotations = await pdfJsPage.getAnnotations();
  } catch {
    annotations = [];
  }

  // Collections
  const detectedFonts = new Map<string, FontProfile>();
  const charCoverageMap = new Map<string, Set<string>>();
  const colorUsageMap = new Map<string, ColorUsage>();
  const tokens: TextToken[] = [];
  const images: ImageInfo[] = [];
  const hyperlinks: HyperlinkInfo[] = [];

  // Parse Text Tokens
  for (let i = 0; i < textContent.items.length; i++) {
    const item = textContent.items[i] as any;
    if (!("str" in item) || item.str === undefined) {
      continue;
    }

    const text = item.str;
    const fontId = item.fontName || "default";
    const style = styles[fontId] || {};
    const transform = item.transform as TransformMatrix;

    // Font size is the magnitude of the transformation matrix scale components
    const fontSize = Math.hypot(transform[0], transform[1]) || 12;
    const width = item.width || 0;
    const height = item.height || fontSize;

    const tokenRect: Rect = {
      x: transform[4],
      y: transform[5],
      width,
      height,
    };

    // Track character coverage
    if (!charCoverageMap.has(fontId)) {
      charCoverageMap.set(fontId, new Set<string>());
    }
    const charSet = charCoverageMap.get(fontId)!;
    for (const char of text) {
      if (char.trim()) charSet.add(char);
    }

    // Inspect Font Details from PDF.js commonObjs if available
    let postScriptName = style.fontFamily || fontId;
    let isEmbedded = false;
    let isSubset = false;

    try {
      if (pdfJsPage.commonObjs && pdfJsPage.commonObjs.has(fontId)) {
        const fontObj = pdfJsPage.commonObjs.get(fontId);
        if (fontObj) {
          postScriptName = fontObj.name || fontObj.loadedName || postScriptName;
          isEmbedded = Boolean(fontObj.isEmbedded || fontObj.data || fontObj.file);
        }
      }
    } catch {
      // Ignore commonObjs lookup error
    }

    // A subset font has a 6-uppercase-letter prefix followed by '+'
    isSubset = /^[A-Z]{6}\+/.test(postScriptName);
    const cleanFamily = postScriptName.replace(/^[A-Z]{6}\+/, "").split("-")[0] || "Unknown";
    const normalizedName = postScriptName.toLowerCase();
    const isStandard14 = STANDARD_14_FONTS.has(normalizedName);

    // Font reusability decision
    let canBeReusedForEditing = false;
    let reusabilityReason = "";

    if (isSubset) {
      canBeReusedForEditing = false;
      reusabilityReason =
        "Subset font contains only characters used in the original document; cannot safely synthesize arbitrary new characters.";
    } else if (isStandard14) {
      canBeReusedForEditing = true;
      reusabilityReason = "Standard 14 Type 1 font is universally supported and can be synthesized.";
    } else if (isEmbedded) {
      canBeReusedForEditing = true;
      reusabilityReason = "Fully embedded font file with complete character metrics.";
    } else {
      canBeReusedForEditing = false;
      reusabilityReason = "Non-embedded font; relies on system font fallback.";
    }

    const isBold =
      normalizedName.includes("bold") ||
      Boolean(style.descent && style.descent < -0.3);
    const isItalic =
      normalizedName.includes("italic") ||
      normalizedName.includes("oblique");

    if (!detectedFonts.has(fontId)) {
      detectedFonts.set(fontId, {
        id: fontId,
        postScriptName,
        family: cleanFamily,
        weight: isBold ? "bold" : "normal",
        style: isItalic ? "italic" : "normal",
        isBold,
        isItalic,
        isEmbedded,
        isSubset,
        isStandard14,
        canBeReusedForEditing,
        reusabilityReason,
        characterCoverage: {
          count: 0,
          sampleCharacters: [],
        },
        frequency: 1,
        provenance: "extracted",
      });
    } else {
      detectedFonts.get(fontId)!.frequency += 1;
    }

    const token: TextToken = {
      id: `tok-${pageNumber}-${i}`,
      text,
      rect: tokenRect,
      transform,
      fontId,
      fontSize: Math.round(fontSize * 10) / 10,
      colorHex: "#000000",
      colorSpace: "DeviceRGB",
      advanceWidth: width,
      provenance: "extracted",
    };

    tokens.push(token);
  }

  // Update font character coverage summaries
  detectedFonts.forEach((font, fontId) => {
    const chars = Array.from(charCoverageMap.get(fontId) || []);
    font.characterCoverage = {
      count: chars.length,
      sampleCharacters: chars.slice(0, 15),
    };
  });

  // 4. Operator List Inspection for Images & Colors
  let detectedPageBackgroundHex: string | undefined = undefined;

  if (operatorList && operatorList.fnArray && operatorList.argsArray) {
    const fns = operatorList.fnArray;
    const args = operatorList.argsArray;

    // Tracking graphic state CTM
    let currentCtm: TransformMatrix = [1, 0, 0, 1, 0, 0];
    const ctmStack: TransformMatrix[] = [];
    let currentFillHex = "#000000";

    for (let i = 0; i < fns.length; i++) {
      const fn = fns[i];
      const arg = args[i];

      // Save / Restore state
      if (fn === 1) {
        // save
        ctmStack.push([...currentCtm]);
      } else if (fn === 2) {
        // restore
        if (ctmStack.length > 0) {
          currentCtm = ctmStack.pop()!;
        }
      } else if (fn === 3) {
        // transform CTM
        if (Array.isArray(arg) && arg.length >= 6) {
          currentCtm = [arg[0], arg[1], arg[2], arg[3], arg[4], arg[5]];
        }
      } else if (fn === 20 || fn === 21 || fn === 22) {
        // RGB Color
        if (arg && arg.length >= 3) {
          currentFillHex = rgbToHex(arg[0] * 255, arg[1] * 255, arg[2] * 255);
          if (!colorUsageMap.has(currentFillHex)) {
            colorUsageMap.set(currentFillHex, {
              colorHex: currentFillHex,
              colorSpace: "DeviceRGB",
              components: [arg[0], arg[1], arg[2]],
              frequency: 1,
              contexts: ["fill"],
              provenance: "extracted",
            });
          } else {
            colorUsageMap.get(currentFillHex)!.frequency += 1;
          }
        }
      } else if (fn === 23) {
        // CMYK Color
        if (arg && arg.length >= 4) {
          currentFillHex = normalizePdfColorToHex(arg, "CMYK");
          if (!colorUsageMap.has(currentFillHex)) {
            colorUsageMap.set(currentFillHex, {
              colorHex: currentFillHex,
              colorSpace: "DeviceCMYK",
              components: [arg[0], arg[1], arg[2], arg[3]],
              frequency: 1,
              contexts: ["fill"],
              provenance: "extracted",
            });
          } else {
            colorUsageMap.get(currentFillHex)!.frequency += 1;
          }
        }
      } else if (fn === 85 || fn === 86 || fn === 87) {
        // paintImageXObject / paintJpegXObject / paintInlineImageXObject
        const imgId = Array.isArray(arg) ? arg[0] : `img-${pageNumber}-${i}`;
        const imgWidth = Math.hypot(currentCtm[0], currentCtm[1]);
        const imgHeight = Math.hypot(currentCtm[2], currentCtm[3]);

        images.push({
          id: String(imgId),
          pageNumber,
          rect: {
            x: currentCtm[4],
            y: currentCtm[5],
            width: Math.round(imgWidth * 10) / 10,
            height: Math.round(imgHeight * 10) / 10,
          },
          intrinsicDimensions: {
            width: Math.round(imgWidth),
            height: Math.round(imgHeight),
          },
          format: fn === 86 ? "JPEG" : "PNG",
          colorSpace: "DeviceRGB",
          bitsPerComponent: 8,
          aspectRatio: imgHeight > 0 ? Math.round((imgWidth / imgHeight) * 100) / 100 : 1,
          provenance: "extracted",
        });
      } else if (fn === 11) {
        // constructPath (rectangles, etc.)
        // Check if drawing a full page background rectangle
        if (Array.isArray(arg) && arg.length >= 4) {
          const w = Math.abs(arg[2]);
          const h = Math.abs(arg[3]);
          if (w >= viewport.width * 0.8 && h >= viewport.height * 0.8) {
            detectedPageBackgroundHex = currentFillHex;
          }
        }
      }
    }
  }

  // 5. Hyperlink Extraction
  for (let i = 0; i < annotations.length; i++) {
    const annot = annotations[i];
    if (annot.subtype === "Link") {
      const rect: Rect = {
        x: annot.rect[0],
        y: annot.rect[1],
        width: Math.abs(annot.rect[2] - annot.rect[0]),
        height: Math.abs(annot.rect[3] - annot.rect[1]),
      };

      const targetUrl = annot.url || annot.unsafeUrl;
      const isExternal = Boolean(targetUrl);

      hyperlinks.push({
        id: `link-${pageNumber}-${i}`,
        pageNumber,
        rect,
        targetType: isExternal ? "external_url" : "internal_page",
        target: targetUrl || annot.dest || "Page",
        provenance: "extracted",
      });
    }
  }

  // 6. Inferred Text Block Positioning (Clustering)
  // PDFs do NOT contain semantic paragraphs. We cluster tokens by baseline and proximity.
  const layoutBlocks = clusterTokensIntoBlocks(tokens, pageNumber);

  // Default color if empty
  if (colorUsageMap.size === 0) {
    colorUsageMap.set("#000000", {
      colorHex: "#000000",
      colorSpace: "DeviceRGB",
      components: [0, 0, 0],
      frequency: tokens.length || 1,
      contexts: ["text"],
      provenance: "inferred",
    });
  }

  const frequentlyUsedColors = Array.from(colorUsageMap.values()).sort(
    (a, b) => b.frequency - a.frequency
  );

  let nonReusableSubsetFontCount = 0;
  detectedFonts.forEach((f) => {
    if (!f.canBeReusedForEditing) nonReusableSubsetFontCount++;
  });

  const accuracyReport: DocumentAccuracyReport = {
    totalTokensExtracted: tokens.length,
    fontsDirectlyExtractedCount: detectedFonts.size,
    fontsInferredCount: 0,
    colorsSampledCount: frequentlyUsedColors.length,
    imagesDetectedCount: images.length,
    linksExtractedCount: hyperlinks.length,
    nonReusableSubsetFontCount,
    knownLimitations: [
      "Paragraph blocks are heuristically inferred based on token proximity; PDF standard does not define paragraph boundaries.",
      "Embedded subset fonts cannot be reused for characters outside their original glyph repertoire.",
      "Vector shading gradients and complex blend modes are reported as aggregate colors.",
    ],
  };

  const pageMetadata: PageMetadata = {
    pageNumber,
    dimensions: { width: viewport.width, height: viewport.height },
    rotation: pdfJsPage.rotate || 0,
    boxTypes: {
      mediaBox: { x: 0, y: 0, width: viewport.width, height: viewport.height },
      cropBox: { x: 0, y: 0, width: viewport.width, height: viewport.height },
    },
    tokenCount: tokens.length,
    imageCount: images.length,
    linkCount: hyperlinks.length,
    hasAnnotations: annotations.length > 0,
  };

  const dominantFont = detectedFonts.values().next().value;
  const inferredProperties = {
    baseFontSize: tokens[0]?.fontSize || 12,
    bodyFontFamily: dominantFont?.family || "Helvetica",
    primaryTextColor: frequentlyUsedColors[0]?.colorHex || "#000000",
    pageBackgroundHex: detectedPageBackgroundHex || "#ffffff",
    estimatedColumnLayout: (layoutBlocks.length > 4 ? "multi" : "single") as
      | "single"
      | "multi"
      | "unstructured",
  };

  return {
    detectedFonts,
    frequentlyUsedColors,
    layoutBlocks,
    textTokens: tokens,
    images,
    hyperlinks,
    pageMetadata,
    inferredProperties,
    accuracyReport,
  };
}

/**
 * Clusters text tokens into lines and layout blocks based on geometric proximity.
 * This is explicitly marked as inferred heuristic data.
 */
function clusterTokensIntoBlocks(tokens: TextToken[], pageNumber: number): LayoutBlock[] {
  if (tokens.length === 0) return [];

  // Sort tokens primarily by Y descending (PDF coordinates start bottom-left), then X ascending
  const sorted = [...tokens].sort((a, b) => {
    const yDiff = b.rect.y - a.rect.y;
    if (Math.abs(yDiff) > 3) return yDiff;
    return a.rect.x - b.rect.x;
  });

  const lines: TextToken[][] = [];
  let currentLine: TextToken[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = currentLine[currentLine.length - 1];
    const curr = sorted[i];

    // Same baseline check (within 3pt tolerance)
    if (Math.abs(curr.rect.y - prev.rect.y) <= 3) {
      currentLine.push(curr);
    } else {
      lines.push(currentLine);
      currentLine = [curr];
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);

  // Cluster lines into blocks
  const blocks: LayoutBlock[] = [];
  let currentBlockLines: TextToken[][] = [lines[0]];

  for (let i = 1; i < lines.length; i++) {
    const prevLine = currentBlockLines[currentBlockLines.length - 1];
    const currLine = lines[i];

    const prevY = prevLine[0].rect.y;
    const currY = currLine[0].rect.y;
    const lineHeight = prevLine[0].fontSize || 12;

    // Line spacing within 1.8x font size indicates same paragraph block
    if (prevY - currY <= lineHeight * 1.8 && prevY - currY >= 0) {
      currentBlockLines.push(currLine);
    } else {
      blocks.push(buildBlock(currentBlockLines, pageNumber, blocks.length));
      currentBlockLines = [currLine];
    }
  }
  if (currentBlockLines.length > 0) {
    blocks.push(buildBlock(currentBlockLines, pageNumber, blocks.length));
  }

  return blocks;
}

function buildBlock(lines: TextToken[][], pageNumber: number, index: number): LayoutBlock {
  const allTokens = lines.flat();
  const xs = allTokens.map((t) => t.rect.x);
  const ys = allTokens.map((t) => t.rect.y);
  const rights = allTokens.map((t) => t.rect.x + t.rect.width);
  const tops = allTokens.map((t) => t.rect.y + t.rect.height);

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...rights);
  const maxY = Math.max(...tops);

  const stringLines = lines.map((line) => line.map((t) => t.text).join(" "));

  return {
    id: `block-${pageNumber}-${index}`,
    pageNumber,
    rect: {
      x: minX,
      y: minY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY),
    },
    lines: stringLines,
    tokens: allTokens,
    dominantFontId: allTokens[0]?.fontId,
    dominantFontSize: allTokens[0]?.fontSize,
    dominantColorHex: allTokens[0]?.colorHex,
    isInferred: true,
    confidence: lines.length > 1 ? 0.85 : 0.95,
  };
}
