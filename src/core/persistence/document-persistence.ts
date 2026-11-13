/**
 * Client-Side Document Session Persistence
 * Uses browser IndexedDB to persist the currently active PDF document,
 * page position, zoom, and operations ledger so user progress is NEVER lost on reload.
 */

const DB_NAME = "pdf-studio-session-db";
const DB_VERSION = 1;
const STORE_NAME = "active_session";
const SESSION_KEY = "current_document";

export interface StoredDocumentSession {
  documentName: string;
  rawBytes: ArrayBuffer;
  operations: any[];
  currentPageNumber: number;
  zoomScale: number;
  timestamp: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not available in this environment."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDocumentSession(session: {
  documentName: string;
  rawBytes: ArrayBuffer;
  operations: any[];
  currentPageNumber: number;
  zoomScale: number;
}): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      const record: StoredDocumentSession = {
        documentName: session.documentName,
        rawBytes: session.rawBytes.slice(0),
        operations: session.operations,
        currentPageNumber: session.currentPageNumber,
        zoomScale: session.zoomScale,
        timestamp: Date.now(),
      };

      const putRequest = store.put(record, SESSION_KEY);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    });
  } catch {
    // Graceful fallback if storage quota exceeded or disabled
  }
}

export async function loadDocumentSession(): Promise<StoredDocumentSession | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(SESSION_KEY);

      getRequest.onsuccess = () => {
        resolve((getRequest.result as StoredDocumentSession) || null);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  } catch {
    return null;
  }
}

export async function clearDocumentSession(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const delRequest = store.delete(SESSION_KEY);

      delRequest.onsuccess = () => resolve();
      delRequest.onerror = () => reject(delRequest.error);
    });
  } catch {
    // Ignored
  }
}
