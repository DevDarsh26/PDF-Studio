import { PdfEngineAdapter } from "./types";
import { HybridPdfAdapter } from "./hybrid-adapter";
import { MuPdfAdapter } from "./mupdf-adapter";

export * from "./types";
export * from "./hybrid-adapter";
export * from "./mupdf-adapter";

export type SupportedEngineType = "hybrid" | "mupdf";

/**
 * Factory function to instantiate the requested PDF processing engine.
 * Allows effortless switching between pure MIT/Apache permissive libraries
 * and high-accuracy WASM engines.
 */
export function createPdfAdapter(type: SupportedEngineType = "hybrid"): PdfEngineAdapter {
  switch (type) {
    case "hybrid":
      return new HybridPdfAdapter();
    case "mupdf":
      return new MuPdfAdapter();
    default:
      throw new Error(`Unsupported PDF engine type: ${type}`);
  }
}
