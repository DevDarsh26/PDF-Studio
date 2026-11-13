import { Command } from "./command";
import {
  EditOperation,
  AddTextOperation,
  AddImageOperation,
  AddShapeOperation,
  WhiteoutOperation,
  BlackoutOperation,
  RedactionOperation,
  AddHyperlinkOperation,
  DeleteHyperlinkOperation,
  TextEditOperation,
  FormattingStyle,
} from "../models/operations";

export type OperationStoreCallback = {
  addOperation: (op: EditOperation) => void;
  removeOperation: (id: string) => void;
  updateOperation: (id: string, updates: Partial<EditOperation>) => void;
};

/**
 * Command to add a new text element with full formatting support.
 */
export class AddTextCommand implements Command {
  readonly id: string;
  readonly type = "add_text";
  readonly description: string;
  readonly timestamp = Date.now();
  private operation: AddTextOperation;
  private store: OperationStoreCallback;

  constructor(operation: AddTextOperation, store: OperationStoreCallback) {
    this.id = operation.id;
    this.operation = operation;
    this.store = store;
    this.description = `Add text: "${operation.text.substring(0, 15)}"`;
  }

  execute(): void {
    this.store.addOperation(this.operation);
  }

  undo(): void {
    this.store.removeOperation(this.id);
  }

  redo(): void {
    this.execute();
  }

  getOperation(): AddTextOperation {
    return this.operation;
  }
}

/**
 * Command to add an image element.
 */
export class AddImageCommand implements Command {
  readonly id: string;
  readonly type = "add_image";
  readonly description = "Add image";
  readonly timestamp = Date.now();
  private operation: AddImageOperation;
  private store: OperationStoreCallback;

  constructor(operation: AddImageOperation, store: OperationStoreCallback) {
    this.id = operation.id;
    this.operation = operation;
    this.store = store;
  }

  execute(): void {
    this.store.addOperation(this.operation);
  }

  undo(): void {
    this.store.removeOperation(this.id);
  }

  redo(): void {
    this.execute();
  }

  getOperation(): AddImageOperation {
    return this.operation;
  }
}

/**
 * Command to add a vector shape (rectangle, circle, line, arrow).
 */
export class AddShapeCommand implements Command {
  readonly id: string;
  readonly type = "add_shape";
  readonly description: string;
  readonly timestamp = Date.now();
  private operation: AddShapeOperation;
  private store: OperationStoreCallback;

  constructor(operation: AddShapeOperation, store: OperationStoreCallback) {
    this.id = operation.id;
    this.operation = operation;
    this.store = store;
    this.description = `Add ${operation.shapeType}`;
  }

  execute(): void {
    this.store.addOperation(this.operation);
  }

  undo(): void {
    this.store.removeOperation(this.id);
  }

  redo(): void {
    this.execute();
  }

  getOperation(): AddShapeOperation {
    return this.operation;
  }
}

/**
 * Command to apply a whiteout area.
 */
export class WhiteoutCommand implements Command {
  readonly id: string;
  readonly type = "whiteout";
  readonly description = "Apply whiteout";
  readonly timestamp = Date.now();
  private operation: WhiteoutOperation;
  private store: OperationStoreCallback;

  constructor(operation: WhiteoutOperation, store: OperationStoreCallback) {
    this.id = operation.id;
    this.operation = operation;
    this.store = store;
  }

  execute(): void {
    this.store.addOperation(this.operation);
  }

  undo(): void {
    this.store.removeOperation(this.id);
  }

  redo(): void {
    this.execute();
  }

  getOperation(): WhiteoutOperation {
    return this.operation;
  }
}

/**
 * Command to apply a blackout area.
 */
export class BlackoutCommand implements Command {
  readonly id: string;
  readonly type = "blackout";
  readonly description = "Apply blackout";
  readonly timestamp = Date.now();
  private operation: BlackoutOperation;
  private store: OperationStoreCallback;

  constructor(operation: BlackoutOperation, store: OperationStoreCallback) {
    this.id = operation.id;
    this.operation = operation;
    this.store = store;
  }

  execute(): void {
    this.store.addOperation(this.operation);
  }

  undo(): void {
    this.store.removeOperation(this.id);
  }

  redo(): void {
    this.execute();
  }

  getOperation(): BlackoutOperation {
    return this.operation;
  }
}

/**
 * Command to delete an element.
 */
export class DeleteElementCommand implements Command {
  readonly id: string;
  readonly type = "delete_element";
  readonly description = "Delete element";
  readonly timestamp = Date.now();
  private deletedOperation: EditOperation;
  private store: OperationStoreCallback;

  constructor(operation: EditOperation, store: OperationStoreCallback) {
    this.id = operation.id;
    this.deletedOperation = operation;
    this.store = store;
  }

  execute(): void {
    this.store.removeOperation(this.id);
  }

  undo(): void {
    this.store.addOperation(this.deletedOperation);
  }

  redo(): void {
    this.execute();
  }

  getOperation(): EditOperation | null {
    return null; // Deleted, not in export
  }
}

/**
 * Command to update geometry (position/dimensions/rotation) or style formatting.
 */
export class UpdateElementCommand implements Command {
  readonly id: string;
  readonly type = "update_element";
  readonly description = "Modify element";
  readonly timestamp = Date.now();
  private previousState: Partial<EditOperation>;
  private nextState: Partial<EditOperation>;
  private store: OperationStoreCallback;

  constructor(
    id: string,
    previousState: Partial<EditOperation>,
    nextState: Partial<EditOperation>,
    store: OperationStoreCallback
  ) {
    this.id = id;
    this.previousState = previousState;
    this.nextState = nextState;
    this.store = store;
  }

  execute(): void {
    this.store.updateOperation(this.id, this.nextState);
  }

  undo(): void {
    this.store.updateOperation(this.id, this.previousState);
  }

  redo(): void {
    this.execute();
  }

  getOperation(): EditOperation | null {
    return null; // Update modifies existing operation in place
  }
}

/**
 * Command to modify existing document text (Strategy A, B, or C).
 */
export class TextEditCommand implements Command {
  readonly id: string;
  readonly type = "text_edit";
  readonly description: string;
  readonly timestamp = Date.now();
  private operation: TextEditOperation;
  private store: OperationStoreCallback;

  constructor(operation: TextEditOperation, store: OperationStoreCallback) {
    this.id = operation.id;
    this.operation = operation;
    this.store = store;
    this.description = `Edit text: "${operation.originalText.substring(0, 12)}" → "${operation.replacementText.substring(0, 12)}" [${operation.strategy}]`;
  }

  execute(): void {
    this.store.addOperation(this.operation);
  }

  undo(): void {
    this.store.removeOperation(this.id);
  }

  redo(): void {
    this.execute();
  }

  getOperation(): TextEditOperation {
    return this.operation;
  }
}

/**
 * Command to apply a permanent redaction.
 */
export class RedactionCommand implements Command {
  readonly id: string;
  readonly type = "redaction";
  readonly description = "Apply permanent redaction";
  readonly timestamp = Date.now();
  private operation: RedactionOperation;
  private store: OperationStoreCallback;

  constructor(operation: RedactionOperation, store: OperationStoreCallback) {
    this.id = operation.id;
    this.operation = operation;
    this.store = store;
  }

  execute(): void {
    this.store.addOperation(this.operation);
  }

  undo(): void {
    this.store.removeOperation(this.id);
  }

  redo(): void {
    this.execute();
  }

  getOperation(): RedactionOperation {
    return this.operation;
  }
}

/**
 * Command to add a hyperlink annotation.
 */
export class AddHyperlinkCommand implements Command {
  readonly id: string;
  readonly type = "add_hyperlink";
  readonly description = "Add hyperlink";
  readonly timestamp = Date.now();
  private operation: AddHyperlinkOperation;
  private store: OperationStoreCallback;

  constructor(operation: AddHyperlinkOperation, store: OperationStoreCallback) {
    this.id = operation.id;
    this.operation = operation;
    this.store = store;
  }

  execute(): void {
    this.store.addOperation(this.operation);
  }

  undo(): void {
    this.store.removeOperation(this.id);
  }

  redo(): void {
    this.execute();
  }

  getOperation(): AddHyperlinkOperation {
    return this.operation;
  }
}


