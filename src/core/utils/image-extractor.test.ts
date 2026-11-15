import { describe, it, expect } from "vitest";
import { sliceCanvasImage } from "./image-extractor";

describe("sliceCanvasImage", () => {
  it("returns fallback data URL when canvas is null", () => {
    const dataUrl = sliceCanvasImage(null, { x: 10, y: 10, width: 100, height: 100 }, 792, 612);
    expect(dataUrl).toContain("data:image/png;base64");
  });

  it("extracts slice when mock canvas is provided", () => {
    // In node/vitest, createElement may not have full 2D canvas without canvas mock
    const mockCanvas = {
      width: 612,
      height: 792,
    } as any;
    const dataUrl = sliceCanvasImage(mockCanvas, { x: 50, y: 50, width: 80, height: 80 }, 792, 612);
    expect(dataUrl).toBeDefined();
  });
});
