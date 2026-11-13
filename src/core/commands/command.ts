import { EditOperation } from "../models/operations";

/**
 * Reversible Command Pattern for all document modifications.
 * Ensures original PDF bytes remain immutable while keeping memory consumption low.
 */
export interface Command {
  readonly id: string;
  readonly type: string;
  readonly description: string;
  readonly timestamp: number;

  /**
   * Applies the operation to state.
   */
  execute(): Promise<void> | void;

  /**
   * Reverses the operation from state.
   */
  undo(): Promise<void> | void;

  /**
   * Re-applies the operation to state.
   */
  redo(): Promise<void> | void;

  /**
   * The underlying operation data if serialized into the export pipeline.
   */
  getOperation(): EditOperation | null;
}

