export type ToolCategory = "all" | "convert-to-pdf" | "convert-from-pdf" | "organize" | "security";

export type ToolId =
  | "edit-pdf"
  | "pdf-to-jpg"
  | "pdf-to-png"
  | "jpg-to-pdf"
  | "png-to-pdf"
  | "images-to-pdf"
  | "compress-pdf"
  | "protect-pdf"
  | "unlock-pdf"
  | "split-pdf"
  | "merge-pdf"
  | "pdf-to-word"
  | "pdf-to-excel"
  | "pdf-to-ppt"
  | "word-to-pdf"
  | "excel-to-pdf";

export interface ToolDefinition {
  id: ToolId;
  title: string;
  shortDesc: string;
  category: ToolCategory;
  badge?: string;
  popular?: boolean;
  acceptedFormats: string;
  color: string;
  gradient: string;
}

export interface ConversionProgress {
  current: number;
  total: number;
  stage: string;
  percentage: number;
}
