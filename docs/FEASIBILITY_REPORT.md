# PDF Studio — Technical Feasibility & Architecture Report

**Version:** 1.0  
**Date:** November 2026  
**Status:** Approved Architectural Baseline  

---

## 1. Executive Summary

PDF Studio is a 100% client-side, browser-based PDF editing application prioritizing high accuracy and format preservation. Unlike basic annotation tools or naive PDF editors that either convert pages to flat images or fail to preserve document structure, PDF Studio implements a three-tier editing strategy (Native, Reconstruction, Visual Overlay) backed by a pluggable engine architecture.

This report evaluates the technical feasibility of the requirements specified in the PRD, analyzes the real-world capabilities and constraints of the selected libraries (`pdfjs-dist`, `pdf-lib`, `mupdf`), and defines the structural foundation of the project.

---

## 2. Library Analysis & Reality Check

### 2.1 PDF.js (`pdfjs-dist`)
- **Primary Role:** Parsing, layout inspection, typography analysis, and canvas rendering.
- **Capabilities:**
  - Fast, accurate HTML5 Canvas page rendering via Web Workers.
  - Granular text extraction via `page.getTextContent()` returning text chunks (`str`), 2D affine transformation matrices (`transform`), font IDs (`fontName`), and bounding metrics.
  - Style dictionary extraction via `textContent.styles` (fontFamily, ascent, descent).
  - Low-level vector operator parsing via `page.getOperatorList()`.
  - Annotation discovery via `page.getAnnotations()` (hyperlinks, page links, form widgets).
- **Limitations:**
  - Read-only engine: PDF.js is strictly a viewer/parser. It cannot modify, save, or export PDF files.
  - Normalized font representation: Embedded font metrics are often synthesized for canvas display rather than directly exposing original PostScript glyph data.
- **License:** Apache 2.0 (Permissive, commercial-friendly).

### 2.2 pdf-lib
- **Primary Role:** Client-side document mutation, page management, and export.
- **Capabilities:**
  - Create and modify PDF documents entirely in JavaScript without native binary dependencies.
  - Fast page operations: add, delete, copy, reorder, rotate, split, and merge.
  - Draw text (`page.drawText`), rectangles, lines, circles, and embedded images (JPEG/PNG).
  - Form manipulation (read and fill AcroForm fields).
  - Immutable pipeline: reads ArrayBuffer, generates new Uint8Array on save.
- **Limitations:**
  - **No text extraction:** `pdf-lib` cannot inspect existing text content streams or calculate bounding boxes of existing text.
  - **No in-place text replacement:** Does not parse or mutate existing content streams (`BT ... ET` blocks).
  - To "edit" text with `pdf-lib` alone, one must overlay a whiteout/colored rectangle over old text and draw new text on top (Strategy 3: Visual Overlay).
- **License:** MIT (Permissive, commercial-friendly).

### 2.3 MuPDF.js (`mupdf`)
- **Primary Role:** Advanced low-level PDF manipulation, true redaction, and structural inspection via WebAssembly.
- **Capabilities:**
  - WebAssembly port of Artifex's C-based MuPDF engine running in modern browsers.
  - True redactions (`createAnnotation('Redact')` + `applyRedactions()`), securely stripping underlying character bytes and glyph drawing operators from the PDF stream.
  - Text insertion (`page.insertText`) with font specification.
  - High-fidelity rasterization and vector rendering.
- **Limitations:**
  - **No arbitrary inline text reflow:** Like all PDF engines, text in PDF is a display list of positioned glyphs. MuPDF does not automatically reflow paragraphs or re-wrap lines across page boundaries when text is replaced.
  - WebAssembly footprint (~15-20MB WASM binary), requiring worker instantiation and asynchronous asset loading.
- **Licensing Constraint (Critical):**
  - Dual-licensed under **GNU AGPLv3** and Artifex Commercial.
  - Under AGPLv3, any web application that links or distributes this WASM module over a network must provide its complete source code under AGPLv3.
  - **Mitigation:** The application must abstract PDF operations behind a `PdfEngineAdapter` interface so that PDF Studio can operate in either:
    1. **Pure Permissive Mode (MIT/Apache 2.0):** Powered by `pdfjs-dist` + `pdf-lib`.
    2. **Enhanced WASM Mode (AGPLv3 / Licensed):** Powered by `mupdf` for true content-stream redaction.

---

## 3. Technical Feasibility Matrix

| Feature | Category | Strategy & Implementation Path |
| :--- | :--- | :--- |
| **PDF Upload & Validation** | Native | Native browser `FileReader` / `ArrayBuffer` validation with magic byte check (`%PDF-`). Original bytes kept immutable. |
| **Canvas Rendering** | Native | `pdfjs-dist` worker rendering to HTML5 Canvas with device pixel ratio scaling. |
| **Page Thumbnails** | Native | Low-resolution offscreen canvas rendering via `pdfjs-dist`. |
| **Document Metadata & Metrics** | Native | Extracted from PDF catalog and `pdfDocument.getMetadata()`. |
| **Text Coordinate & Bounds Detection** | Reconstruction | Parse `getTextContent()`, cluster character/word tokens by baseline and proximity, compute bounding boxes. |
| **Font Family & Size Detection** | Reconstruction | Computed from `textContent.styles` and item transform matrices (`scaleX`, `scaleY`). |
| **Hyperlink Preservation** | Native | Extracted via `page.getAnnotations()`. Unrelated links are untouched during page edits; updated links written via PDF annotation dictionary. |
| **Page Reorder / Rotate / Delete** | Native | Fully supported via `pdf-lib` page manipulation API. |
| **Page Merge & Split** | Native | Supported via `pdf-lib.PDFDocument.create()` and `copyPages()`. |
| **Whiteout (Cover)** | Native | Draw filled rectangle with page background color (`pdf-lib.drawRectangle`). |
| **Blackout (Visual)** | Native | Draw black filled rectangle (`pdf-lib.drawRectangle`). |
| **Permanent Redaction** | Native / Fallback | MuPDF `applyRedactions()` strips content stream bytes. Fallback in pure mode: visual cover with explicit user notice that underlying stream is masked visually. |
| **Add New Text & Shapes** | Native | Fabric/Konva canvas overlay in editor; rasterized/vectorized to PDF via `pdf-lib.drawText` and drawing operators. |
| **Existing Text Editing (Replacement)** | Reconstruction & Fallback | **Tier 1:** Native form field editing where AcroForm fields exist.<br>**Tier 2:** Bounding box redaction (MuPDF) + insertion of replacement text at baseline coordinates.<br>**Tier 3:** Visual cover of target text bounding box + redraw replacement text with matched typography (pdf-lib). |
| **Export to PDF** | Native | Re-assembled PDF saved via `pdf-lib.save()` or `mupdf.saveToBuffer()`. |
| **Export to JPG/PNG** | Native | High-DPI canvas render via PDF.js exported to `toBlob()`. |
| **Command Undo/Redo** | Native | Command ledger storing atomic actions (reversible operations), maintaining original PDF immutability. |
| **Arbitrary Multi-page Text Reflow** | Unsupported | Out of scope. PDFs lack semantic document flow; paragraph reflow across pages is warned as unsupported. |

---

## 4. Architecture Decisions

1. **Strict Client-Side Privacy:**
   - Zero outbound requests containing document data.
   - All parsing, rendering, and exporting occurs inside Web Workers or main thread memory.
   - Blob URLs revoked on document closure.

2. **Immutable Document Pipeline:**
   - The original uploaded `ArrayBuffer` is never directly mutated.
   - All edits exist as an in-memory modification graph (`EditOperation[]`).
   - The export process creates a fresh document or applies an incremental patch pipeline.

3. **Pluggable PDF Engine Adapter (`PdfEngineAdapter`):**
   - Clean interface isolating the UI and state store from low-level PDF manipulation libraries.
   - Default implementation: `HybridPdfAdapter` (combines `pdfjs-dist` for inspection/rendering with `pdf-lib` for document mutations).
   - Secondary implementation: `MuPdfAdapter` for AGPL-compliant / WASM-accelerated redactions.

4. **Layered Canvas Architecture:**
   - **Base Layer:** PDF Canvas (rendered via PDF.js with high DPI).
   - **Text Layer:** Invisible or highlighted text spans aligned over glyphs for native selection.
   - **Interaction/Annotation Layer:** Interactive canvas (Konva/Fabric) handling active selections, handles, shapes, and editing boxes.

---

## 5. Development Milestones

- **Milestone 1 (Current):** Project Foundation & Architecture Setup
  - Project configuration (Next.js, TypeScript, Tailwind CSS, Zustand, Vitest).
  - Type-safe domain models and engine adapter interface.
  - Immutability and command ledger architecture.
  - Core engine adapter contracts and unit tests.
- **Milestone 2:** Document Loader, Analyzer & Render Pipeline
  - PDF file ingestion and validation (client-side).
  - PDF.js rendering pipeline with Web Worker support.
  - Document Style Profile extractor (fonts, sizes, colors, layout coordinates, links).
- **Milestone 3:** Interactive Editor Canvas & Page Management
  - Thumbnails sidebar with reordering, rotation, deletion.
  - Main viewport with zoom, pan, and text selection overlay.
  - Undo/redo command manager.
- **Milestone 4:** Editing Engine (Text, Whiteout, Redact, Add Content)
  - Strategy 1/2/3 text editor.
  - Redaction and whiteout tools.
  - Shapes, images, and formatting properties panel.
- **Milestone 5:** Hyperlink Management, Export & Validation
  - Interactive link creation and preservation.
  - PDF export and page image export (PNG/JPG).
  - Export integrity verification and error reporting.

