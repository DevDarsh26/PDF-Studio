# PDF Studio — Development Roadmap & Milestones

---

## Milestone 1: Foundation & Architecture (Current Milestone - COMPLETED)
- [x] Technical feasibility report on `pdfjs-dist`, `pdf-lib`, and `mupdf` capabilities and licensing.
- [x] Project workspace scaffolding with Next.js 15, React 19, TypeScript, Tailwind CSS, Zustand.
- [x] Strict client-side privacy architecture (zero server/AI network calls).
- [x] Pluggable `PdfEngineAdapter` interface.
- [x] `HybridPdfAdapter` combining `pdfjs-dist` and `pdf-lib`.
- [x] Reversible `CommandLedger` history engine (low-memory undo/redo).
- [x] Core geometry, document metadata, style profile, and operation domain models.
- [x] Test framework setup (Vitest + jsdom mock canvas + Playwright E2E configuration).
- [x] Baseline unit test suite executed and passing.

---

## Milestone 2: Document Ingestion, Analysis & High-DPI Rendering
- [ ] Drag-and-drop document upload with progressive loading bar.
- [ ] Password-protected PDF prompt and decryption handling.
- [ ] High-DPI Canvas page renderer via `pdfjs-dist` Web Worker.
- [ ] Document Style Profile extractor:
  - Font families, sizes, weights, subset detection.
  - Text colors (RGB/CMYK/Grayscale), dominant palette.
  - Text tokens and block clustering.
  - Link annotations extraction (external URLs + internal page destinations).
- [ ] Page thumbnail sidebar with live thumbnail generation and navigation.

---

## Milestone 3: Interactive Editor Canvas & Page Management
- [ ] Canvas selection overlay (Fabric.js / Konva) synchronized with PDF coordinate system.
- [ ] Text token hit-testing and bounding box selection highlighting.
- [ ] Page management operations:
  - Reorder pages via drag-and-drop.
  - Rotate pages (90°, 180°, 270°).
  - Delete pages.
  - Insert blank pages.
- [ ] Viewport controls: Smooth zoom (25% - 400%), pan, keyboard shortcuts.

---

## Milestone 4: Editing Engine (Text, Redaction & Additions)
- [ ] Three-tier text editor implementation:
  - Tier 1: AcroForm field inline editing.
  - Tier 2: WASM redaction + text insertion (MuPDF).
  - Tier 3: Visual overlay fallback with color matching (pdf-lib).
- [ ] Whiteout and blackout drawing tools (rectangle and freeform).
- [ ] Permanent redaction tool with verification that underlying text bytes are purged.
- [ ] Add content tools:
  - Add new text with font style inheritance from selected text.
  - Add shapes (rectangles, circles, lines, arrows).
  - Add and replace images with aspect ratio locking.
- [ ] Properties inspector panel with live two-way binding.

---

## Milestone 5: Hyperlink Management, Export & Validation
- [ ] Interactive hyperlink overlay:
  - Edit destination URLs.
  - Add new external links and internal page jumps.
  - Delete or resize link click areas.
- [ ] Verification suite: Ensure unrelated hyperlinks survive page export.
- [ ] PDF export pipeline with byte integrity check.
- [ ] High-resolution image export (PDF to PNG / JPG with selectable DPI).
- [ ] Side-by-side visual comparison between original and edited documents.
- [ ] Cross-browser validation (Chrome, Firefox, Safari, Edge).

