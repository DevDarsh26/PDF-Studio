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

