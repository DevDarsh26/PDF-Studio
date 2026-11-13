# PDF Studio — System Architecture

## 1. Architectural Philosophy

PDF Studio is architected around three foundational pillars:

1. **Zero-Trust Privacy & Local Processing:**
   No PDF content, text chunk, or raster image is ever transmitted across the network. All execution occurs strictly client-side within the browser's JavaScript / WebAssembly runtime.

2. **Source Byte Immutability:**
   The original byte array (`ArrayBuffer`) uploaded by the user is never mutated in place. Edits are tracked as a discrete, reversible modification ledger (`CommandLedger`). During export, a target PDF is either generated incrementally or assembled using deterministic patch operations.

3. **Pluggable Engine Abstraction (`PdfEngineAdapter`):**
   Low-level PDF mechanics are decoupled from the UI and presentation layer. This allows the editor to run on:
   - **Permissive Hybrid Engine (`HybridPdfAdapter`):** Mozilla `pdfjs-dist` (Apache 2.0) for reading, layout analysis, font inspection, and high-DPI canvas rendering + `pdf-lib` (MIT) for document manipulation, page reordering, shapes, and export.
   - **High-Accuracy WASM Engine (`MuPdfAdapter`):** Artifex MuPDF.js (WebAssembly) for byte-level redaction and stream surgery (subject to AGPLv3/commercial terms).

---

## 2. Component Architecture

```
+-----------------------------------------------------------------------------------+
|                                 Next.js UI Layer                                  |
|  +--------------------+  +--------------------------------+  +-----------------+  |
|  |  Thumbnail Sidebar |  |    Interactive Canvas Viewport |  | Properties Panel|  |
|  |  (Page Navigation) |  |   (PDF.js Canvas + Fabric/Konva)|  | (Fonts, Colors)|  |
|  +--------------------+  +--------------------------------+  +-----------------+  |
|  +-----------------------------------------------------------------------------+  |
|  |                  Top Action Toolbar & Bottom Status Bar                     |  |
|  +-----------------------------------------------------------------------------+  |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                             State Management (Zustand)                            |
|  +--------------------------------------+  +------------------------------------+  |
|  |             EditorStore              |  |            HistoryStore            |  |
|  | - activeTool: EditorTool             |  | - ledger: CommandLedger            |  |
|  | - metadata: PdfDocumentMetadata      |  | - canUndo / canRedo                |  |
|  | - currentStyleProfile: StyleProfile  |  | - execute / undo / redo            |  |
|  +--------------------------------------+  +------------------------------------+  |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                        Core PDF Engine Adapter Layer                              |
|                                                                                   |
|                           <<interface>> PdfEngineAdapter                          |
|    + validate(bytes)                                                              |
|    + loadDocument(bytes, password)                                                |
|    + getPageInfos()                                                               |
|    + analyzeStyleProfile(pageNumber)                                              |
|    + renderPage(options)                                                          |
|    + exportPdf(options)                                                           |
|    + exportPageImage(options)                                                     |
|                                                                                   |
|           ^                                                    ^                  |
|           |                                                    |                  |
|  +--------+------------------+                        +--------+----------------+ |
|  |    HybridPdfAdapter       |                        |      MuPdfAdapter       | |
|  |  - pdfjs-dist (Parser)    |                        |  - MuPDF.js (WASM)      | |
|  |  - pdf-lib (Mutator)      |                        |  - C Engine Redaction   | |
|  +---------------------------+                        +-------------------------+ |
+-----------------------------------------------------------------------------------+
```

---

## 3. The Three-Tier Text Editing Strategy

Because PDFs do not store semantic text flows (they store absolute-positioned glyph drawing instructions), PDF Studio handles text edits across three tiers:

1. **Tier 1 — Native Content Modification:**
   Directly updates interactive AcroForm text fields or modifies stream arguments when the target font is a standard standard-14 Type 1 font (Helvetica, Times, Courier) and characters do not overflow the bounding box.

2. **Tier 2 — Local Reconstruction (WASM):**
   Using `MuPdfAdapter`, the target text's bounding quad is stripped via a true redaction operation (`createAnnotation('Redact')` + `applyRedactions()`), securely deleting original character glyphs from the content stream. Replacement text is then inserted at the exact calculated baseline coordinates.

3. **Tier 3 — Visual Overlay Fallback (Permissive):**
   When operating under pure MIT/Apache permissive libraries (`pdf-lib`), the target bounding box is masked using a precisely positioned rectangle matching the page background color (or whiteout), and replacement text is drawn on top with matching font size, color, and spacing metrics.

---

## 4. Hyperlink Preservation Protocol

Hyperlinks (`/Subtype /Link`) are distinct PDF annotation dictionary entries. During any page editing or content modification:
1. `pdfjs-dist` scans `page.getAnnotations()` and categorizes links by destination type:
   - External URI (`/A << /S /URI /URI (https://...) >>`)
   - Internal Page Destination (`/Dest [pageRef /XYZ ...]`)
2. Unmodified links remain completely untouched in the PDF catalog.
3. Modified or newly created links are synthesized as standard PDF annotation objects and attached to the page dictionary without flattening into raster graphics.

---

## 5. Security & Privacy Model

- **No Remote Telemetry or Tracking:** No document hashes, metadata, or contents are sent to external analytics or APIs.
- **Strict Web Worker Sandboxing:** Rendering and parsing operations run inside Web Workers to ensure responsive UI frames and isolate memory.
- **Memory Lifetime:** When a document is closed or replaced, references to ArrayBuffers are decoupled, canvas contexts cleared, and temporary Blob URLs explicitly revoked via `URL.revokeObjectURL()`.

