import { Rect, Point, Dimensions } from "./geometry";

export enum EditStrategy {
  NativeStreamModification = "native_modification",
  LocalReconstruction = "local_reconstruction",
  VisualOverlay = "visual_overlay",
}

export interface FormattingStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  fontColorHex: string;
  alignment: "left" | "center" | "right";
  opacity: number;
  strokeColorHex?: string;
  fillColorHex?: string;
  strokeWidth?: number;
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
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  fontColorHex: string;
  alignment: "left" | "center" | "right";
  opacity: number;
  rotation?: number;
  strategy: EditStrategy;
}

export interface WhiteoutOperation extends BaseOperation {
  type: "whiteout";
  rect: Rect;
  fillColorHex: string; // Typically #ffffff or matched background
  opacity: number;
}

export interface BlackoutOperation extends BaseOperation {
  type: "blackout";
  rect: Rect;
  fillColorHex: string; // Always #000000
  opacity: number;
}

export interface RedactionOperation extends BaseOperation {
  type: "redaction";
  rect: Rect;
  isPermanent: boolean; // True = strip bytes from content stream (Tier 2); False = visual blackout
  fillColorHex: string; // Typically #000000
  textToRedact?: string; // Target text to permanently strip from content stream
}

export interface AddTextOperation extends BaseOperation {
  type: "add_text";
  position: Point;
  dimensions?: Dimensions;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  fontColorHex: string;
  alignment: "left" | "center" | "right";
  opacity: number;
  rotation?: number;
  isStyleInherited?: boolean;
}

export interface AddImageOperation extends BaseOperation {
  type: "add_image";
  rect: Rect;
  imageDataUrl: string; // Base64 data URL
  mimeType: "image/png" | "image/jpeg";
  opacity: number;
  rotation?: number;
}

export interface AddShapeOperation extends BaseOperation {
  type: "add_shape";
  shapeType: "rectangle" | "circle" | "line" | "arrow";
  rect: Rect;
  startPoint?: Point; // Specific for line / arrow
  endPoint?: Point;
  strokeColorHex: string;
  fillColorHex?: string;
  strokeWidth: number;
  opacity: number;
  rotation?: number;
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

export interface AddHyperlinkOperation extends BaseOperation {
  type: "add_hyperlink";
  rect: Rect;
  targetType: "external_url" | "internal_page";
  url?: string;
  targetPage?: number;
}

export interface DeleteHyperlinkOperation extends BaseOperation {
  type: "delete_hyperlink";
  linkId: string;
  rect: Rect;
}

export interface AddDrawingOperation extends BaseOperation {
  type: "freehand";
  points: Point[]; // Sequence of { x, y } in PDF points
  strokeColorHex: string;
  strokeWidth: number;
  opacity: number;
  isHighlighter?: boolean;
}

export interface AddPageOperation {
  id: string;
  type: "add_page";
  timestamp: number;
  insertAtIndex: number;
  dimensions: Dimensions;
}

export type EditOperation =
  | TextEditOperation
  | WhiteoutOperation
  | BlackoutOperation
  | RedactionOperation
  | AddTextOperation
  | AddImageOperation
  | AddShapeOperation
  | AddDrawingOperation
  | PageReorderOperation
  | PageRotateOperation
  | PageDeleteOperation
  | AddHyperlinkOperation
  | DeleteHyperlinkOperation
  | AddPageOperation;
