import { Rect } from "../models/geometry";
import { FontProfile, LayoutBlock, TextToken } from "../models/style-profile";
import { EditStrategy } from "../models/operations";

export type TextScope = "word" | "number" | "sentence" | "block" | "deletion";

export interface TextEditValidationResult {
  scope: TextScope;
  recommendedStrategy: EditStrategy;
  canUseNative: boolean;
  canUseReconstruction: boolean;
  characterCoverage: {
    isCovered: boolean;
    missingChars: string[];
    reusabilityReason?: string;
  };
  dimensionMetrics: {
    originalWidth: number;
    replacementEstimatedWidth: number;
    overflowRatio: number;
    isOverflowing: boolean;
  };
  hasOverlapWithAdjacent: boolean;
  warnings: string[];
}

export function detectTextScope(originalText: string, replacementText: string): TextScope {
  if (replacementText.trim() === "") {
    return "deletion";
  }

  const trimmed = originalText.trim();
  if (/^[\d.,$%€£+\-/]+$/.test(trimmed)) {
    return "number";
  }

  const words = trimmed.split(/\s+/);
  if (words.length <= 1) {
    return "word";
  }

  if (trimmed.includes("\n") || trimmed.length > 80 || words.length > 12) {
    return "block";
  }

  return "sentence";
}

export function validateTextReplacement(
  originalText: string,
  replacementText: string,
  targetRect: Rect,
  fontSize: number,
  fontProfile?: FontProfile,
  pageLayout?: { layoutBlocks?: LayoutBlock[]; textTokens?: TextToken[] }
): TextEditValidationResult {
  const scope = detectTextScope(originalText, replacementText);
  const warnings: string[] = [];

  // 1. Character coverage and font reusability analysis
  let isCovered = true;
  const missingChars: string[] = [];

  if (fontProfile) {
    if (fontProfile.isSubset) {
      // Check if replacement chars exist in the subset sample / original text
      const knownChars = new Set(fontProfile.characterCoverage.sampleCharacters);
      for (const char of originalText) {
        knownChars.add(char);
      }

      for (const char of replacementText) {
        if (char.trim() && !knownChars.has(char)) {
          if (!missingChars.includes(char)) {
            missingChars.push(char);
          }
        }
      }

      if (missingChars.length > 0) {
        isCovered = false;
        warnings.push(
          `Original font "${fontProfile.postScriptName}" is an embedded subset. Character(s) [${missingChars.slice(0, 5).join(", ")}] are missing from the font program.`
        );
      }
    } else if (!fontProfile.canBeReusedForEditing && !fontProfile.isStandard14) {
      isCovered = false;
      warnings.push(
        `Original font "${fontProfile.family}" cannot be legally or technically synthesized directly (${fontProfile.reusabilityReason}).`
      );
    }
  }

  // 2. Dimension Metrics & Overflow Analysis
  const origLen = Math.max(1, originalText.length);
  const repLen = replacementText.length;
  const originalWidth = targetRect.width || fontSize * origLen * 0.55;
  const replacementEstimatedWidth = (repLen / origLen) * originalWidth;
  const overflowRatio = Math.round((replacementEstimatedWidth / Math.max(1, originalWidth)) * 100) / 100;
  const isOverflowing = overflowRatio > 1.15;

  if (isOverflowing && scope !== "deletion") {
    const percent = Math.round((overflowRatio - 1) * 100);
    warnings.push(
      `Text overflow: Replacement text is ~${percent}% wider than original area. Adjacent content may be disrupted.`
    );
  }

  // 3. Check for overlapping content with neighboring tokens
  let hasOverlapWithAdjacent = false;
  if (isOverflowing && pageLayout?.textTokens) {
    const expandedRight = targetRect.x + replacementEstimatedWidth;
    for (const token of pageLayout.textTokens) {
      // Look for tokens on the same horizontal band to the right
      const isSameY = Math.abs(token.rect.y - targetRect.y) < fontSize * 0.8;
      const isRight = token.rect.x > targetRect.x && token.rect.x < expandedRight + 2;
      if (isSameY && isRight && token.text !== originalText) {
        hasOverlapWithAdjacent = true;
        warnings.push(`Layout collision: Replacement text overlaps with adjacent text "${token.text.substring(0, 10)}...".`);
        break;
      }
    }
  }

  // 4. Strategy Recommendation
  // Strategy A (Native): Allowed when font is standard 14 or non-subset with full coverage
  const canUseNative = Boolean(
    !fontProfile ||
    fontProfile.isStandard14 ||
    (!fontProfile.isSubset && fontProfile.canBeReusedForEditing && isCovered)
  );

  const canUseReconstruction = true; // Always supported via content stream suppression + standard font embedding

  let recommendedStrategy: EditStrategy;
  if (canUseNative && isCovered) {
    recommendedStrategy = EditStrategy.NativeStreamModification;
  } else {
    recommendedStrategy = EditStrategy.LocalReconstruction;
    warnings.push(
      "Using Strategy B (Local Reconstruction): The original text operator will be suppressed and reconstructed with a matching standard typeface."
    );
  }

  return {
    scope,
    recommendedStrategy,
    canUseNative,
    canUseReconstruction,
    characterCoverage: {
      isCovered,
      missingChars,
      reusabilityReason: fontProfile?.reusabilityReason,
    },
    dimensionMetrics: {
      originalWidth,
      replacementEstimatedWidth,
      overflowRatio,
      isOverflowing,
    },
    hasOverlapWithAdjacent,
    warnings,
  };
}
