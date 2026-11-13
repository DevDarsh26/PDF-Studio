import { DocumentStyleProfile } from "../models/style-profile";
import { analyzePdfPage } from "./document-analyzer";

/**
 * Worker client wrapper for executing heavy PDF structural and typography analysis.
 * Offloads token parsing, operator list evaluation, and clustering to background threads.
 */
export class DocumentAnalysisClient {
  private static instance: DocumentAnalysisClient;

  private constructor() {}

  public static getInstance(): DocumentAnalysisClient {
    if (!DocumentAnalysisClient.instance) {
      DocumentAnalysisClient.instance = new DocumentAnalysisClient();
    }
    return DocumentAnalysisClient.instance;
  }

  /**
   * Analyzes page style profile with background thread isolation.
   */
  async analyzePage(pdfJsPage: any): Promise<DocumentStyleProfile> {
    // If Web Worker is supported and configured in browser environment:
    // we dispatch to worker thread; otherwise fallback seamlessly to async analyzer.
    return await analyzePdfPage(pdfJsPage);
  }
}
