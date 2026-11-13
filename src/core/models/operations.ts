import { Rect, Point } from "./geometry";

export enum EditStrategy {
  NativeStreamModification = "native_modification",
  LocalReconstruction = "local_reconstruction",
  VisualOverlay = "visual_overlay",
}

export interface BaseOperation {
  id: string;
  pageNumber: number;
  timestamp: number;
}

export interface TextEditOperation extends BaseOperation {
  type: "text_edit";
  targetRect: Rect;
  originalText: string;
  replacementText: string;
  fontFamily: string;
  fontSize: number;
  fontColorHex: string;
  strategy: EditStrategy;
}

export interface WhiteoutOperation extends BaseOperation {
  type: "whiteout";
  rect: Rect;
  fillColorHex: string; // Typically #ffffff or matched background
}

export interface RedactionOperation extends BaseOperation {
  type: "redaction";
  rect: Rect;
  isPermanent: boolean; // True = strip bytes from content stream (Tier 2); False = visual blackout
  fillColorHex: string; // Typically #000000
}

export interface AddTextOperation extends BaseOperation {
  type: "add_text";
  position: Point;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontColorHex: string;
  opacity: number;
}

export interface AddShapeOperation extends BaseOperation {
  type: "add_shape";
  shapeType: "rectangle" | "circle" | "line" | "arrow";
  rect: Rect;
  strokeColorHex: string;
  fillColorHex?: string;
  strokeWidth: number;
  opacity: number;
}

export interface PageReorderOperation {
  id: string;
  type: "page_reorder";
  timestamp: number;
  sourceIndex: number;
  targetIndex: number;
}

export interface PageRotateOperation {
  id: string;
  type: "page_rotate";
  timestamp: number;
  pageNumber: number;
  rotationDegrees: 90 | 180 | 270;
}

export interface PageDeleteOperation {
  id: string;
  type: "page_delete";
  timestamp: number;
  pageNumber: number;
}

export type EditOperation =
  | TextEditOperation
  | WhiteoutOperation
  | RedactionOperation
  | AddTextOperation
  | AddShapeOperation
  | PageReorderOperation
  | PageRotateOperation
  | PageDeleteOperation;

