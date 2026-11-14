import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "./editor-store";
import {
  createSinglePageSamplePdf,
  createMultiPageSamplePdf,
} from "../core/utils/sample-pdfs";

describe("useEditorStore — State & Control Actions", () => {
  beforeEach(async () => {
    await useEditorStore.getState().closeDocument();
  });

  it("loads document bytes and updates store metadata and pages", async () => {
    const buffer = await createMultiPageSamplePdf();
    await useEditorStore.getState().loadDocumentBytes(buffer, "test-multi.pdf");

    const state = useEditorStore.getState();
    expect(state.documentName).toBe("test-multi.pdf");
    expect(state.metadata).not.toBeNull();
    expect(state.metadata?.pageCount).toBe(5);
    expect(state.pageInfos.length).toBe(5);
    expect(state.currentPageNumber).toBe(1);
    expect(state.zoomScale).toBe(1.0);
    expect(state.viewRotation).toBe(0);
  });

  it("navigates through pages with bounds checking", async () => {
    const buffer = await createMultiPageSamplePdf();
    await useEditorStore.getState().loadDocumentBytes(buffer);

    const store = useEditorStore.getState();
    expect(store.currentPageNumber).toBe(1);

    // Prev page at page 1 should remain 1
    await store.prevPage();
    expect(useEditorStore.getState().currentPageNumber).toBe(1);

    // Next page
    await store.nextPage();
    expect(useEditorStore.getState().currentPageNumber).toBe(2);

    // Jump directly to page 4
    await store.setCurrentPage(4);
    expect(useEditorStore.getState().currentPageNumber).toBe(4);

    // Jump to invalid page (> 5) should be ignored
    await store.setCurrentPage(99);
    expect(useEditorStore.getState().currentPageNumber).toBe(4);
  });

  it("adjusts zoom scale with clamp constraints", () => {
    const store = useEditorStore.getState();
    expect(store.zoomScale).toBe(1.0);

    store.zoomIn();
    expect(useEditorStore.getState().zoomScale).toBeCloseTo(1.15, 2);

    store.zoomOut();
    expect(useEditorStore.getState().zoomScale).toBeCloseTo(1.0, 2);

    // Test minimum clamp (0.25)
    store.setZoomScale(0.05);
    expect(useEditorStore.getState().zoomScale).toBe(0.25);

    // Test maximum clamp (4.0)
    store.setZoomScale(10.0);
    expect(useEditorStore.getState().zoomScale).toBe(4.0);
  });

  it("calculates fitToWidth and fitToPage correctly", async () => {
    const buffer = await createSinglePageSamplePdf();
    await useEditorStore.getState().loadDocumentBytes(buffer);

    const store = useEditorStore.getState();
    // Container width = 800px; page width ~595pt
    store.fitToWidth(800);
    expect(useEditorStore.getState().fitMode).toBe("width");
    expect(useEditorStore.getState().zoomScale).toBeGreaterThan(0.5);

    // Fit to page
    store.fitToPage(800, 1000);
    expect(useEditorStore.getState().fitMode).toBe("page");
  });

  it("rotates viewing orientation in 90-degree steps", () => {
    const store = useEditorStore.getState();
    expect(store.viewRotation).toBe(0);

    store.rotateViewing("cw");
    expect(useEditorStore.getState().viewRotation).toBe(90);

    store.rotateViewing("cw");
    expect(useEditorStore.getState().viewRotation).toBe(180);

    store.rotateViewing("cw");
    expect(useEditorStore.getState().viewRotation).toBe(270);

    store.rotateViewing("cw");
    expect(useEditorStore.getState().viewRotation).toBe(0);
  });

  it("handles password protection modal workflow", async () => {
    // Encrypted PDF fixture
    const encryptedPdfStr =
      "%PDF-1.7\n%PDF Studio Encrypted Test\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
      "2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n" +
      "trailer\n<< /Root 1 0 R /Encrypt 3 0 R >>\n%%EOF";
    const buffer = new TextEncoder().encode(encryptedPdfStr).buffer;

    // Loading without password should trigger password modal
    await useEditorStore.getState().loadDocumentBytes(buffer, "encrypted.pdf");
    expect(useEditorStore.getState().isPasswordRequired).toBe(true);
    expect(useEditorStore.getState().pendingBytes).not.toBeNull();

    // Cancelling prompt resets password state
    useEditorStore.getState().cancelPasswordPrompt();
    expect(useEditorStore.getState().isPasswordRequired).toBe(false);
    expect(useEditorStore.getState().pendingBytes).toBeNull();
  });

  it("remembers document password once entered and does not prompt again on internal reloads", async () => {
    const buffer = await createSinglePageSamplePdf();
    // Load with a password (representing unlocking a password-protected document)
    await useEditorStore.getState().loadDocumentBytes(buffer, "doc.pdf", "secret-pass-123");

    expect(useEditorStore.getState().documentPassword).toBe("secret-pass-123");
    expect(useEditorStore.getState().isPasswordRequired).toBe(false);

    // Perform an internal restore/reload without explicitly passing password
    await useEditorStore.getState().loadDocumentBytes(buffer, "doc.pdf", undefined, {
      isRestoring: true,
      pageNumber: 1,
    });

    // Password must be retained and password modal must not be triggered
    expect(useEditorStore.getState().documentPassword).toBe("secret-pass-123");
    expect(useEditorStore.getState().isPasswordRequired).toBe(false);
  });

  it("resets state and cleans up resources on closeDocument", async () => {
    const buffer = await createSinglePageSamplePdf();
    await useEditorStore.getState().loadDocumentBytes(buffer, "doc.pdf");

    expect(useEditorStore.getState().metadata).not.toBeNull();

    await useEditorStore.getState().closeDocument();
    const state = useEditorStore.getState();
    expect(state.documentName).toBeNull();
    expect(state.metadata).toBeNull();
    expect(state.rawBytes).toBeNull();
    expect(state.pageInfos.length).toBe(0);
  });

  it("supports switching to grab tool and moving elements", async () => {
    const store = useEditorStore.getState();
    expect(store.activeTool).toBe("select");

    // Switch to grab tool
    store.setActiveTool("grab");
    expect(useEditorStore.getState().activeTool).toBe("grab");

    // Switch back to select
    store.setActiveTool("select");
    expect(useEditorStore.getState().activeTool).toBe("select");

    // Add and move an operation via direct update
    const op = {
      id: "text-1",
      pageNumber: 1,
      timestamp: Date.now(),
      type: "add_text" as const,
      position: { x: 100, y: 200 },
      text: "Move Me",
      fontFamily: "Helvetica",
      fontSize: 14,
      fontColorHex: "#000000",
    };
    useEditorStore.getState().addOperationDirect(op);
    expect(useEditorStore.getState().operations.length).toBe(1);

    // Direct move update during drag
    useEditorStore.getState().updateOperationDirect("text-1", {
      position: { x: 150, y: 250 },
    });
    const updated = useEditorStore.getState().operations.find((o) => o.id === "text-1");
    expect((updated as any).position).toEqual({ x: 150, y: 250 });
  });
});
