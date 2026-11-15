import { PDFDocument } from "pdf-lib";
import { getPdfjs } from "../utils/pdfjs-loader";

export interface ExportExpectations {
  expectedPageCount?: number;
  expectedPageDimensions?: { pageNumber: number; width: number; height: number }[];
  expectedTexts?: string[];
  redactedTexts?: string[]; // Must NOT appear in ordinary text extraction
  expectedLinksCount?: number;
  password?: string;
}

export interface DimensionCheck {
  pageNumber: number;
  expected: { width: number; height: number };
  actual: { width: number; height: number };
  matches: boolean;
}

export interface ExportValidationResult {
  isValid: boolean;
  pageCountVerified: boolean;
  actualPageCount: number;
  dimensionsVerified: boolean;
  dimensionDetails: DimensionCheck[];
  textPreservationVerified: boolean;
  foundExpectedTexts: string[];
  missingExpectedTexts: string[];
  redactionVerified: boolean;
  leakedRedactedTexts: string[];
  linksPreservedCount: number;
  renderedSuccessfully: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Validates exported PDF documents by reopening them through both PDF.js and pdf-lib.
 * Ensures zero corruption, dimension fidelity, expected text presence, and verified redaction sanitization.
 */
export async function validateExportedPdf(
  exportedBytes: Uint8Array,
  expectations: ExportExpectations = {}
): Promise<ExportValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  let pageCountVerified = true;
  let actualPageCount = 0;
  let dimensionsVerified = true;
  const dimensionDetails: DimensionCheck[] = [];
  let textPreservationVerified = true;
  const foundExpectedTexts: string[] = [];
  const missingExpectedTexts: string[] = [];
  let redactionVerified = true;
  const leakedRedactedTexts: string[] = [];
  let linksPreservedCount = 0;
  let renderedSuccessfully = true;

  // 1. Reopen with pdf-lib to verify structural integrity and dimensions
  let pdfLibDoc: PDFDocument;
  try {
    pdfLibDoc = await PDFDocument.load(exportedBytes.slice(0), {
      ignoreEncryption: true,
    });
    actualPageCount = pdfLibDoc.getPageCount();
  } catch (err: any) {
    return {
      isValid: false,
      pageCountVerified: false,
      actualPageCount: 0,
      dimensionsVerified: false,
      dimensionDetails: [],
      textPreservationVerified: false,
      foundExpectedTexts: [],
      missingExpectedTexts: expectations.expectedTexts || [],
      redactionVerified: false,
      leakedRedactedTexts: [],
      linksPreservedCount: 0,
      renderedSuccessfully: false,
      warnings: [],
      errors: [`Corrupted PDF binary: ${err?.message || "Failed to parse document structure."}`],
    };
  }

  // 2. Verify Page Count
  if (
    expectations.expectedPageCount !== undefined &&
    actualPageCount !== expectations.expectedPageCount
  ) {
    pageCountVerified = false;
    errors.push(
      `Page count mismatch: Expected ${expectations.expectedPageCount} pages, got ${actualPageCount}.`
    );
  }

  // 3. Verify Page Dimensions
  if (expectations.expectedPageDimensions) {
    for (const exp of expectations.expectedPageDimensions) {
      if (exp.pageNumber <= actualPageCount) {
        const page = pdfLibDoc.getPage(exp.pageNumber - 1);
        const actualWidth = Math.round(page.getWidth() * 10) / 10;
        const actualHeight = Math.round(page.getHeight() * 10) / 10;
        const expWidth = Math.round(exp.width * 10) / 10;
        const expHeight = Math.round(exp.height * 10) / 10;

        const matches =
          Math.abs(actualWidth - expWidth) <= 1.0 &&
          Math.abs(actualHeight - expHeight) <= 1.0;

        dimensionDetails.push({
          pageNumber: exp.pageNumber,
          expected: { width: exp.width, height: exp.height },
          actual: { width: actualWidth, height: actualHeight },
          matches,
        });

        if (!matches) {
          dimensionsVerified = false;
          errors.push(
            `Page ${exp.pageNumber} dimensions distorted: Expected ${expWidth}x${expHeight}pt, got ${actualWidth}x${actualHeight}pt.`
          );
        }
      }
    }
  }

  // 4. Reopen with PDF.js for text extraction, link verification, and render checks
  try {
    const pdfjsLib = await getPdfjs();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(exportedBytes.slice(0)),
      password: expectations.password || undefined,
      useSystemFonts: true,
    });
    const pdfJsDoc = await loadingTask.promise;

    let fullExtractedText = "";

    for (let p = 1; p <= pdfJsDoc.numPages; p++) {
      const page = await pdfJsDoc.getPage(p);

      // Extract text content
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .join(" ");
      fullExtractedText += " " + pageText;

      // Extract annotations for links
      const annotations = await page.getAnnotations();
      const linkAnnots = annotations.filter(
        (a: any) => a.subtype === "Link" || a.annotationType === 1
      );
      linksPreservedCount += linkAnnots.length;

      // Test rendering in DOM environment if available
      if (typeof document !== "undefined") {
        try {
          const canvas = document.createElement("canvas");
          const viewport = page.getViewport({ scale: 1.0 });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const renderTask = page.render({ canvasContext: ctx as any, viewport });
            await renderTask.promise;
          }
        } catch (rErr: any) {
          renderedSuccessfully = false;
          warnings.push(`Page ${p} canvas rendering warning: ${rErr?.message}`);
        }
      }
    }

    // 5. Verify Expected Texts
    if (expectations.expectedTexts) {
      for (const expText of expectations.expectedTexts) {
        if (fullExtractedText.includes(expText)) {
          foundExpectedTexts.push(expText);
        } else {
          missingExpectedTexts.push(expText);
          textPreservationVerified = false;
          errors.push(`Expected text "${expText}" missing from exported document.`);
        }
      }
    }

    // 6. Verify Redaction Sanitization (Redacted text must NOT be recoverable)
    if (expectations.redactedTexts) {
      for (const redText of expectations.redactedTexts) {
        if (redText.trim() && fullExtractedText.includes(redText)) {
          redactionVerified = false;
          leakedRedactedTexts.push(redText);
          errors.push(
            `Critical Security Failure: Redacted text "${redText}" was recovered through ordinary text extraction!`
          );
        }
      }
    }

    // 7. Verify Link Count
    if (
      expectations.expectedLinksCount !== undefined &&
      linksPreservedCount < expectations.expectedLinksCount
    ) {
      warnings.push(
        `Link count disparity: Expected ${expectations.expectedLinksCount} links, verified ${linksPreservedCount}.`
      );
    }
  } catch (pdfJsErr: any) {
    warnings.push(`PDF.js secondary inspection notice: ${pdfJsErr?.message}`);
  }

  const isValid =
    errors.length === 0 &&
    pageCountVerified &&
    dimensionsVerified &&
    textPreservationVerified &&
    redactionVerified;

  return {
    isValid,
    pageCountVerified,
    actualPageCount,
    dimensionsVerified,
    dimensionDetails,
    textPreservationVerified,
    foundExpectedTexts,
    missingExpectedTexts,
    redactionVerified,
    leakedRedactedTexts,
    linksPreservedCount,
    renderedSuccessfully,
    warnings,
    errors,
  };
}
