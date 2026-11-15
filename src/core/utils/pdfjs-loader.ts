/**
 * Centralized, resilient loader for pdfjs-dist.
 * Provides caching, automatic retry with backoff for transient ChunkLoadErrors,
 * worker configuration, and background preloading.
 */

let cachedPdfjsLib: any = null;
let inFlightPromise: Promise<any> | null = null;

function isChunkLoadError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  const name = err.name || "";
  return (
    name === "ChunkLoadError" ||
    msg.includes("loading chunk") ||
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("error loading dynamic import")
  );
}

/**
 * Configure PDF.js worker options safely
 */
export function configurePdfjsWorker(pdfjsLib: any): void {
  if (typeof window !== "undefined" && pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    }
  }
}

/**
 * Loads pdfjs-dist with automatic retry on chunk loading failure.
 */
export async function getPdfjs(): Promise<any> {
  if (cachedPdfjsLib) {
    return cachedPdfjsLib;
  }

  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    let lastError: any = null;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const lib = await import("pdfjs-dist");
        configurePdfjsWorker(lib);
        cachedPdfjsLib = lib;
        return lib;
      } catch (err: any) {
        lastError = err;
        console.warn(`[PDF.js Loader] Attempt ${attempt}/${maxAttempts} failed:`, err?.message || err);

        if (isChunkLoadError(err)) {
          // If this is a chunk load error due to dev server restart or HMR mismatch,
          // wait with exponential backoff before retrying
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
            continue;
          }

          // If exhausted in browser and still chunk loading failed, attempt fallback to legacy build
          try {
            console.info("[PDF.js Loader] Attempting fallback to pdfjs-dist legacy build...");
            const legacyLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
            configurePdfjsWorker(legacyLib);
            cachedPdfjsLib = legacyLib;
            return legacyLib;
          } catch (fallbackErr) {
            console.error("[PDF.js Loader] Legacy build fallback also failed:", fallbackErr);
          }
        } else {
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
          }
        }
      }
    }

    inFlightPromise = null;
    throw lastError || new Error("Failed to load PDF.js library.");
  })();

  return inFlightPromise;
}

/**
 * Preload PDF.js in the background during browser idle time so it is
 * instantly available without chunk-loading delay when the user opens a file.
 */
export function preloadPdfjs(): void {
  if (typeof window === "undefined" || cachedPdfjsLib) return;

  const runPreload = () => {
    getPdfjs().catch((err) => {
      console.warn("[PDF.js Loader] Background preload error (non-fatal):", err?.message || err);
    });
  };

  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(runPreload, { timeout: 2000 });
  } else {
    setTimeout(runPreload, 800);
  }
}
