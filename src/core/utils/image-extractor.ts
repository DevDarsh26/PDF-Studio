import { Rect } from "../models/geometry";

/**
 * Extracts / crops an image region from the rendered PDF canvas as a high-quality data URL.
 * Used to convert existing logos and images in the PDF into fully interactive, movable,
 * resizable, and replaceable elements without losing image visual fidelity.
 */
export function sliceCanvasImage(
  canvas: HTMLCanvasElement | null,
  rect: Rect,
  pageHeight: number,
  pageWidth: number
): string {
  if (!canvas || typeof window === "undefined") {
    // 1x1 transparent PNG fallback
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  }
  try {
    const scaleX = canvas.width / pageWidth;
    const scaleY = canvas.height / pageHeight;

    const srcX = Math.floor(rect.x * scaleX);
    // In PDF coordinates, (x, y) is bottom-left, so top-left in screen is pageHeight - (y + height)
    const srcY = Math.floor((pageHeight - (rect.y + rect.height)) * scaleY);
    const srcW = Math.max(4, Math.ceil(rect.width * scaleX));
    const srcH = Math.max(4, Math.ceil(rect.height * scaleY));

    const offscreen = document.createElement("canvas");
    offscreen.width = srcW;
    offscreen.height = srcH;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return "";

    ctx.drawImage(canvas, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
    return offscreen.toDataURL("image/png");
  } catch {
    return "";
  }
}
