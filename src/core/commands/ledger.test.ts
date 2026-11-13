import { describe, it, expect, beforeEach } from "vitest";
import { CommandLedger } from "./ledger";
import { Command } from "./command";
import { WhiteoutOperation } from "../models/operations";

class MockWhiteoutCommand implements Command {
  readonly id = "mock-1";
  readonly type = "whiteout";
  readonly description = "Apply whiteout";
  readonly timestamp = Date.now();
  executed = false;
  undone = false;

  execute() {
    this.executed = true;
    this.undone = false;
  }

  undo() {
    this.undone = true;
    this.executed = false;
  }

  redo() {
    this.execute();
  }

  getOperation(): WhiteoutOperation {
    return {
      id: this.id,
      pageNumber: 1,
      timestamp: this.timestamp,
      type: "whiteout",
      rect: { x: 10, y: 10, width: 50, height: 20 },
      fillColorHex: "#ffffff",
    };
  }
}

describe("CommandLedger", () => {
  let ledger: CommandLedger;

  beforeEach(() => {
    ledger = new CommandLedger(5);
  });

  it("initializes with empty stacks and clean state", () => {
    expect(ledger.state.canUndo).toBe(false);
    expect(ledger.state.canRedo).toBe(false);
    expect(ledger.state.isDirty).toBe(false);
  });

  it("executes command and updates undo stack", async () => {
    const cmd = new MockWhiteoutCommand();
    await ledger.execute(cmd);

    expect(cmd.executed).toBe(true);
    expect(ledger.state.canUndo).toBe(true);
    expect(ledger.state.canRedo).toBe(false);
    expect(ledger.state.isDirty).toBe(true);
  });

  it("supports undo and redo cycles", async () => {
    const cmd = new MockWhiteoutCommand();
    await ledger.execute(cmd);

    // Undo
    const undone = await ledger.undo();
    expect(undone).toBe(cmd);
    expect(cmd.undone).toBe(true);
    expect(ledger.state.canUndo).toBe(false);
    expect(ledger.state.canRedo).toBe(true);

    // Redo
    const redone = await ledger.redo();
    expect(redone).toBe(cmd);
    expect(cmd.executed).toBe(true);
    expect(ledger.state.canUndo).toBe(true);
    expect(ledger.state.canRedo).toBe(false);
  });

  it("clears redo stack when new command executed after undo", async () => {
    const cmd1 = new MockWhiteoutCommand();
    const cmd2 = new MockWhiteoutCommand();

    await ledger.execute(cmd1);
    await ledger.undo();
    expect(ledger.state.canRedo).toBe(true);

    await ledger.execute(cmd2);
    expect(ledger.state.canRedo).toBe(false);
  });

  it("respects max history limit and tracks dirty state", async () => {
    for (let i = 0; i < 7; i++) {
      await ledger.execute(new MockWhiteoutCommand());
    }
    expect(ledger.state.undoStackLength).toBe(5);

    ledger.markSaved();
    expect(ledger.state.isDirty).toBe(false);

    await ledger.execute(new MockWhiteoutCommand());
    expect(ledger.state.isDirty).toBe(true);
  });
});

