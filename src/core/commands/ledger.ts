import { Command } from "./command";
import { EditOperation } from "../models/operations";

export interface LedgerState {
  canUndo: boolean;
  canRedo: boolean;
  undoStackLength: number;
  redoStackLength: number;
  isDirty: boolean;
}

/**
 * CommandLedger manages the history of user modifications.
 * Uses a command-based timeline rather than full PDF snapshots,
 * keeping memory bounded even with hundreds of edits.
 */
export class CommandLedger {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory: number;
  private dirtyPoint: number = 0; // Tracks saved state

  constructor(maxHistory = 100) {
    this.maxHistory = maxHistory;
  }

  /**
   * Pushes and executes a new command, invalidating any existing redo history.
   */
  async execute(command: Command): Promise<void> {
    await command.execute();
    this.undoStack.push(command);

    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
      if (this.dirtyPoint > 0) {
        this.dirtyPoint--;
      }
    }

    // Any new action clears the redo stack
    this.redoStack = [];
  }

  /**
   * Undoes the most recent command.
   */
  async undo(): Promise<Command | null> {
    const command = this.undoStack.pop();
    if (!command) {
      return null;
    }

    await command.undo();
    this.redoStack.push(command);
    return command;
  }

  /**
   * Redoes the most recently undone command.
   */
  async redo(): Promise<Command | null> {
    const command = this.redoStack.pop();
    if (!command) {
      return null;
    }

    await command.redo();
    this.undoStack.push(command);
    return command;
  }

  get state(): LedgerState {
    return {
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      undoStackLength: this.undoStack.length,
      redoStackLength: this.redoStack.length,
      isDirty: this.undoStack.length !== this.dirtyPoint,
    };
  }

  markSaved(): void {
    this.dirtyPoint = this.undoStack.length;
  }

  /**
   * Extracts all active operations in chronological order for export.
   */
  getActiveOperations(): EditOperation[] {
    const ops: EditOperation[] = [];
    for (const cmd of this.undoStack) {
      const op = cmd.getOperation();
      if (op) {
        ops.push(op);
      }
    }
    return ops;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.dirtyPoint = 0;
  }
}

