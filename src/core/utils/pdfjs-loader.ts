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
    (name === "TypeError" && msg.includes("__webpack_modules__")) ||
    msg.includes("is not a function") ||
    msg.includes("loading chunk") ||
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("error loading dynamic import") ||
    msg.includes("unexpected token")
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
 * Loads pdfjs-dist with automatic fallback and retry on chunk loading failure.
 * In browser environments, it prioritizes the stable static /pdf.min.mjs bundle to bypass
 * Webpack HMR dynamic chunk hash mismatches and __webpack_modules__ errors entirely.
 */
export async function getPdfjs(): Promise<any> {
  if (cachedPdfjsLib) {
    return cachedPdfjsLib;
  }

  // If already attached to window by a previous load
  if (typeof window !== "undefined" && (window as any).pdfjsLib?.getDocument) {
    const lib = (window as any).pdfjsLib;
    configurePdfjsWorker(lib);
    cachedPdfjsLib = lib;
    return lib;
  }

  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    let lastError: any = null;
    const isRealBrowser =
      typeof window !== "undefined" &&
      typeof document !== "undefined" &&
      !(typeof process !== "undefined" && process.env?.VITEST);

    // Attempt 1 (Browser-first): Native browser ES dynamic import bypassing Vite & Webpack chunk splitting
    if (isRealBrowser) {
      try {
        const importDynamic = new Function("u", "return import(u)");
        const lib = await importDynamic("/pdf.min.mjs");
        if (lib && (lib.getDocument || (lib as any).default?.getDocument)) {
          const resolved = lib.getDocument ? lib : (lib as any).default;
          configurePdfjsWorker(resolved);
          cachedPdfjsLib = resolved;
          return resolved;
        }
      } catch (browserStaticErr: any) {
        console.warn("[PDF.js Loader] Static /pdf.min.mjs load failed, falling back to bundler import:", browserStaticErr?.message || browserStaticErr);
      }
    }

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
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
            continue;
          }

          // Fallback to legacy build if Webpack module resolution failed
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
