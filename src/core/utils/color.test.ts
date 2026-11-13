import { describe, it, expect } from "vitest";
import { rgbToHex, hexToRgb, cmykToRgb, normalizePdfColorToHex } from "./color";

describe("Color Utilities", () => {
  it("converts RGB values to Hex", () => {
    expect(rgbToHex(255, 255, 255)).toBe("#ffffff");
    expect(rgbToHex(0, 0, 0)).toBe("#000000");
    expect(rgbToHex(59, 130, 246)).toBe("#3b82f6");
  });

  it("converts Hex strings to RGB objects", () => {
    expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("invalid")).toBeNull();
  });

  it("converts CMYK normalized components to RGB", () => {
    // Pure Cyan: C=1, M=0, Y=0, K=0 -> RGB (0, 255, 255)
    expect(cmykToRgb(1, 0, 0, 0)).toEqual({ r: 0, g: 255, b: 255 });
    // Pure Black: C=0, M=0, Y=0, K=1 -> RGB (0, 0, 0)
    expect(cmykToRgb(0, 0, 0, 1)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("normalizes PDF color spaces to Hex", () => {
    expect(normalizePdfColorToHex([1], "Grayscale")).toBe("#ffffff");
    expect(normalizePdfColorToHex([0], "Grayscale")).toBe("#000000");
    expect(normalizePdfColorToHex([1, 0, 0], "RGB")).toBe("#ff0000");
  });
});
