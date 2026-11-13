import { Dimensions } from "./geometry";

export interface PdfDocumentMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  pdfVersion: string;
  isEncrypted: boolean;
  pageCount: number;
  fileSizeBytes: number;
}

export interface PageInfo {
  pageNumber: number; // 1-indexed
  dimensions: Dimensions;
  rotation: number; // 0, 90, 180, 270
}

export interface DocumentValidationResult {
  isValid: boolean;
  error?: string;
  isEncrypted: boolean;
  version?: string;
  pageCount?: number;
}
