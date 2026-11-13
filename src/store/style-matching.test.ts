import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "./editor-store";
import { createSinglePageSamplePdf } from "../core/utils/sample-pdfs";
import { AddTextOperation } from "../core/models/operations";

describe("Style Matching & Interactive Formatting", () => {
  beforeEach(async () => {
    await useEditorStore.getState().closeDocument();
  });

  it("inherits formatting from selected extracted text token", async () => {
    const buffer = await createSinglePageSamplePdf();
    await useEditorStore.getState().loadDocumentBytes(buffer, "sample.pdf");

    const state = useEditorStore.getState();
    expect(state.currentStyleProfile).not.toBeNull();
    expect(state.currentStyleProfile!.textTokens.length).toBeGreaterThan(0);

    const firstToken = state.currentStyleProfile!.textTokens[0];

    // Select the token
    useEditorStore.getState().selectToken(firstToken.id);
    expect(useEditorStore.getState().selectedTokenId).toBe(firstToken.id);

    // Trigger inherit formatting
    const inherited = useEditorStore.getState().inheritStyleFromSelectedToken();
    expect(inherited).not.toBeNull();
    expect(inherited!.fontSize).toBe(firstToken.fontSize);
    expect(inherited!.fontColorHex).toBe(firstToken.colorHex);

    // Active formatting must now reflect the inherited style
    const activeFmt = useEditorStore.getState().activeFormatting;
    expect(activeFmt.fontSize).toBe(firstToken.fontSize);
  });

  it("copies formatting from an element and pastes it onto another element", async () => {
    const op1: AddTextOperation = {
      id: "text-source",
      pageNumber: 1,
      timestamp: Date.now(),
      type: "add_text",
      position: { x: 50, y: 100 },
      text: "Source",
      fontFamily: "Courier",
      fontSize: 22,
      fontWeight: "bold",
      fontStyle: "italic",
      fontColorHex: "#ef4444",
      alignment: "right",
      opacity: 0.9,
    };

    const op2: AddTextOperation = {
      id: "text-target",
      pageNumber: 1,
      timestamp: Date.now(),
      type: "add_text",
      position: { x: 50, y: 200 },
      text: "Target",
      fontFamily: "Helvetica",
      fontSize: 12,
      fontWeight: "normal",
      fontStyle: "normal",
      fontColorHex: "#000000",
      alignment: "left",
      opacity: 1.0,
    };

    await useEditorStore.getState().executeAddOperation(op1);
    await useEditorStore.getState().executeAddOperation(op2);

    // Select op1 and copy its formatting
    useEditorStore.getState().selectElement("text-source");
    useEditorStore.getState().copyFormatting();

    expect(useEditorStore.getState().copiedFormatting).not.toBeNull();
    expect(useEditorStore.getState().copiedFormatting!.fontFamily).toBe("Courier");
    expect(useEditorStore.getState().copiedFormatting!.fontSize).toBe(22);

    // Select op2 and paste formatting
    useEditorStore.getState().selectElement("text-target");
    await useEditorStore.getState().pasteFormatting();

    const targetOp = useEditorStore
      .getState()
      .operations.find((o) => o.id === "text-target") as AddTextOperation;

    expect(targetOp.fontFamily).toBe("Courier");
    expect(targetOp.fontSize).toBe(22);
    expect(targetOp.fontWeight).toBe("bold");
    expect(targetOp.fontColorHex).toBe("#ef4444");
  });

  it("deletes selected element and records deletion in undo history", async () => {
    const op: AddTextOperation = {
      id: "to-delete",
      pageNumber: 1,
      timestamp: Date.now(),
      type: "add_text",
      position: { x: 100, y: 100 },
      text: "Delete Me",
      fontFamily: "Helvetica",
      fontSize: 14,
      fontWeight: "normal",
      fontStyle: "normal",
      fontColorHex: "#000000",
      alignment: "left",
      opacity: 1.0,
    };

    await useEditorStore.getState().executeAddOperation(op);
    expect(useEditorStore.getState().operations.length).toBe(1);

    useEditorStore.getState().selectElement("to-delete");
    await useEditorStore.getState().deleteSelected();

    expect(useEditorStore.getState().operations.length).toBe(0);
    expect(useEditorStore.getState().selectedElementId).toBeNull();
  });
});
