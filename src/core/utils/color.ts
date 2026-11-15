/**
 * Color utility for PDF color space conversion and normalization
 */

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    return clamped.toString(16).padStart(2, "0");
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleanHex = hex.replace("#", "").trim();
  if (cleanHex.length === 3) {
    return {
      r: parseInt(cleanHex[0] + cleanHex[0], 16),
      g: parseInt(cleanHex[1] + cleanHex[1], 16),
      b: parseInt(cleanHex[2] + cleanHex[2], 16),
    };
  }
  if (cleanHex.length === 6) {
    return {
      r: parseInt(cleanHex.substring(0, 2), 16),
      g: parseInt(cleanHex.substring(2, 4), 16),
      b: parseInt(cleanHex.substring(4, 6), 16),
    };
  }
  return null;
}

export function cmykToRgb(c: number, m: number, y: number, k: number): { r: number; g: number; b: number } {
  // c, m, y, k are normalized [0.0 - 1.0]
  const r = 255 * (1 - c) * (1 - k);
  const g = 255 * (1 - m) * (1 - k);
  const b = 255 * (1 - y) * (1 - k);
  return {
    r: Math.round(r),
    g: Math.round(g),
    b: Math.round(b),
  };
}

export function normalizePdfColorToHex(components: number[], colorSpace: "RGB" | "CMYK" | "Grayscale"): string {
  if (colorSpace === "Grayscale" && components.length >= 1) {
    const gray = Math.round(components[0] * 255);
    return rgbToHex(gray, gray, gray);
  }
  if (colorSpace === "RGB" && components.length >= 3) {
    return rgbToHex(components[0] * 255, components[1] * 255, components[2] * 255);
  }
  if (colorSpace === "CMYK" && components.length >= 4) {
    const rgb = cmykToRgb(components[0], components[1], components[2], components[3]);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }
  return "#000000";
}

/**
 * Samples the true background color from the rendered canvas around a target bounding box.
 * This inspects pixels immediately surrounding the text box (clearances and page margins)
 * to find the dominant document background color of the actual rendered PDF.
 */
export function sampleCanvasBackgroundColor(
  canvas: HTMLCanvasElement | null,
  rect: { x: number; y: number; width: number; height: number },
  pageHeight: number,
  pageWidth: number,
  fallbackHex: string = "#ffffff"
): string {
  if (!canvas || typeof window === "undefined") return fallbackHex;
  try {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || canvas.width === 0 || canvas.height === 0) return fallbackHex;

    const scaleX = canvas.width / pageWidth;
    const scaleY = canvas.height / pageHeight;

    // Convert PDF coordinates (origin at bottom-left) to canvas coordinates (origin at top-left)
    const screenLeft = Math.floor(rect.x * scaleX);
    const screenRight = Math.ceil((rect.x + rect.width) * scaleX);
    const screenTop = Math.floor((pageHeight - (rect.y + rect.height)) * scaleY);
    const screenBottom = Math.ceil((pageHeight - rect.y) * scaleY);

    const pad = Math.max(3, Math.round(4 * scaleX));
    const samplePoints: { x: number; y: number }[] = [
      // 4 points right outside the 4 edges of the text box
      { x: Math.max(2, screenLeft - pad), y: Math.floor((screenTop + screenBottom) / 2) },
      { x: Math.min(canvas.width - 2, screenRight + pad), y: Math.floor((screenTop + screenBottom) / 2) },
      { x: Math.floor((screenLeft + screenRight) / 2), y: Math.max(2, screenTop - pad) },
      { x: Math.floor((screenLeft + screenRight) / 2), y: Math.min(canvas.height - 2, screenBottom + pad) },
      // Top-left and top-right margins of the page
      { x: Math.min(20, Math.floor(canvas.width * 0.05)), y: Math.min(20, Math.floor(canvas.height * 0.05)) },
      { x: Math.max(canvas.width - 20, Math.floor(canvas.width * 0.95)), y: Math.min(20, Math.floor(canvas.height * 0.05)) },
    ];

    const sampledHexes: string[] = [];
    for (const pt of samplePoints) {
      if (pt.x >= 0 && pt.x < canvas.width && pt.y >= 0 && pt.y < canvas.height) {
        const p = ctx.getImageData(pt.x, pt.y, 1, 1).data;
        // Ignore transparent or dark text pixels (brightness > 60)
        const brightness = p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114;
        if (p[3] > 30 && brightness > 50) {
          sampledHexes.push(rgbToHex(p[0], p[1], p[2]));
        }
      }
    }

    if (sampledHexes.length > 0) {
      // Count frequency of sampled colors to pick dominant background
      const counts: Record<string, number> = {};
      for (const h of sampledHexes) {
        counts[h] = (counts[h] || 0) + 1;
      }
      return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    }
  } catch {
    // Canvas taint or context access fallback
  }
  return fallbackHex;
}


