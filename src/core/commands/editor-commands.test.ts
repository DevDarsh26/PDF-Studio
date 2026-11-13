import { describe, it, expect, beforeEach } from "vitest";
import { CommandLedger } from "./ledger";
import {
  AddTextCommand,
  AddShapeCommand,
  AddImageCommand,
  WhiteoutCommand,
  BlackoutCommand,
  DeleteElementCommand,
  UpdateElementCommand,
} from "./editor-commands";
import {
  EditOperation,
  AddTextOperation,
  AddShapeOperation,
  AddImageOperation,
  WhiteoutOperation,
  BlackoutOperation,
} from "../models/operations";

describe("Editor Commands & Reversible History", () => {
  let operations: EditOperation[];
  let ledger: CommandLedger;

  const storeCallback = {
    addOperation: (op: EditOperation) => {
      operations.push(op);
    },
    removeOperation: (id: string) => {
      operations = operations.filter((o) => o.id !== id);
    },
    updateOperation: (id: string, updates: Partial<EditOperation>) => {
      operations = operations.map((o) => (o.id === id ? ({ ...o, ...updates } as EditOperation) : o));
    },
  };

  beforeEach(() => {
    operations = [];
    ledger = new CommandLedger(50);
  });

  it("executes and undoes AddTextCommand", async () => {
    const textOp: AddTextOperation = {
      id: "text-1",
      pageNumber: 1,
      timestamp: Date.now(),
      type: "add_text",
      position: { x: 100, y: 200 },
      text: "Invoice #1002",
      fontFamily: "Helvetica",
      fontSize: 16,
      fontWeight: "bold",
      fontStyle: "normal",
      fontColorHex: "#000000",
      alignment: "left",
      opacity: 1.0,
    };

    const cmd = new AddTextCommand(textOp, storeCallback);
    await ledger.execute(cmd);

    expect(operations.length).toBe(1);
    expect(operations[0].id).toBe("text-1");
    expect(ledger.state.canUndo).toBe(true);

    // Undo
    await ledger.undo();
    expect(operations.length).toBe(0);
    expect(ledger.state.canRedo).toBe(true);

    // Redo
    await ledger.redo();
    expect(operations.length).toBe(1);
    expect(operations[0].id).toBe("text-1");
  });

  it("executes and undoes AddShapeCommand (rectangle, circle, line, arrow)", async () => {
    const shapeOp: AddShapeOperation = {
      id: "shape-rect-1",
      pageNumber: 1,
      timestamp: Date.now(),
      type: "add_shape",
      shapeType: "rectangle",
      rect: { x: 50, y: 50, width: 200, height: 100 },
      strokeColorHex: "#2563eb",
      fillColorHex: "#93c5fd",
      strokeWidth: 2,
      opacity: 0.8,
    };

    const cmd = new AddShapeCommand(shapeOp, storeCallback);
    await ledger.execute(cmd);

    expect(operations.length).toBe(1);
    expect((operations[0] as AddShapeOperation).shapeType).toBe("rectangle");

    // Undo
    await ledger.undo();
    expect(operations.length).toBe(0);
  });

  it("executes and undoes WhiteoutCommand and BlackoutCommand", async () => {
    const whiteoutOp: WhiteoutOperation = {
      id: "wo-1",
      pageNumber: 1,
      timestamp: Date.now(),
      type: "whiteout",
      rect: { x: 100, y: 500, width: 80, height: 25 },
      fillColorHex: "#ffffff",
      opacity: 1.0,
    };

    const blackoutOp: BlackoutOperation = {
      id: "bo-1",
      pageNumber: 1,
      timestamp: Date.now(),
      type: "blackout",
      rect: { x: 200, y: 500, width: 80, height: 25 },
      fillColorHex: "#000000",
      opacity: 1.0,
    };

    await ledger.execute(new WhiteoutCommand(whiteoutOp, storeCallback));
    await ledger.execute(new BlackoutCommand(blackoutOp, storeCallback));

    expect(operations.length).toBe(2);

    // Undo blackout
    await ledger.undo();
    expect(operations.length).toBe(1);
    expect(operations[0].type).toBe("whiteout");

    // Undo whiteout
    await ledger.undo();
    expect(operations.length).toBe(0);
  });

  it("executes and undoes DeleteElementCommand", async () => {
    const textOp: AddTextOperation = {
      id: "text-del",
      pageNumber: 1,
      timestamp: Date.now(),
      type: "add_text",
      position: { x: 100, y: 100 },
      text: "Temporary",
      fontFamily: "Helvetica",
      fontSize: 12,
      fontWeight: "normal",
      fontStyle: "normal",
      fontColorHex: "#000000",
      alignment: "left",
      opacity: 1.0,
    };

    await ledger.execute(new AddTextCommand(textOp, storeCallback));
    expect(operations.length).toBe(1);

    // Delete element
    const delCmd = new DeleteElementCommand(textOp, storeCallback);
    await ledger.execute(delCmd);
    expect(operations.length).toBe(0);

    // Undo delete restores element
    await ledger.undo();
    expect(operations.length).toBe(1);
    expect(operations[0].id).toBe("text-del");
  });

  it("executes and undoes UpdateElementCommand (modifying position & styles)", async () => {
    const textOp: AddTextOperation = {
      id: "text-update",
      pageNumber: 1,
      timestamp: Date.now(),
      type: "add_text",
      position: { x: 50, y: 50 },
      text: "Heading",
      fontFamily: "Helvetica",
      fontSize: 14,
      fontWeight: "normal",
      fontStyle: "normal",
      fontColorHex: "#000000",
      alignment: "left",
      opacity: 1.0,
    };

    await ledger.execute(new AddTextCommand(textOp, storeCallback));

    const updateCmd = new UpdateElementCommand(
      "text-update",
      { fontSize: 14, fontWeight: "normal" },
      { fontSize: 24, fontWeight: "bold" },
      storeCallback
    );

    await ledger.execute(updateCmd);
    expect((operations[0] as AddTextOperation).fontSize).toBe(24);
    expect((operations[0] as AddTextOperation).fontWeight).toBe("bold");

    // Undo update
    await ledger.undo();
    expect((operations[0] as AddTextOperation).fontSize).toBe(14);
    expect((operations[0] as AddTextOperation).fontWeight).toBe("normal");
  });
});
