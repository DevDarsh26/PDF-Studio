/**
 * Client-Side Document Session Persistence
 * Uses browser IndexedDB to persist the currently active PDF document,
 * page position, zoom, rotation, and operations ledger so user progress is NEVER lost on reload.
 */

const DB_NAME = "pdf-studio-session-db";
const DB_VERSION = 2;
const STORE_NAME = "active_session";
const SESSION_KEY = "current_document";

export interface StoredDocumentSession {
  documentName: string;
  rawBytes: ArrayBuffer;
  documentPassword?: string | null;
  operations: any[];
  currentPageNumber: number;
  zoomScale: number;
  viewRotation?: number;
  timestamp: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not available in this environment."));
      return;
    }

    const timer = setTimeout(() => {
      reject(new Error("IndexedDB connection timed out."));
    }, 3000);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      clearTimeout(timer);
      resolve(request.result);
    };
    request.onerror = () => {
      clearTimeout(timer);
      reject(request.error);
    };
    request.onblocked = () => {
      clearTimeout(timer);
      console.warn("IndexedDB upgrade blocked.");
    };
  });
}

/**
 * Save document session to IndexedDB.
 */
export async function saveDocumentSession(session: {
  documentName: string;
  rawBytes: ArrayBuffer;
  documentPassword?: string | null;
  operations: any[];
  currentPageNumber: number;
  zoomScale: number;
  viewRotation?: number;
}): Promise<void> {
  try {
    // If file is larger than 75MB, we still try, but catch quota safely
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);

      const record: StoredDocumentSession = {
        documentName: session.documentName,
        rawBytes: session.rawBytes.slice(0),
        documentPassword: session.documentPassword || null,
        operations: session.operations ? JSON.parse(JSON.stringify(session.operations)) : [],
        currentPageNumber: session.currentPageNumber || 1,
        zoomScale: session.zoomScale || 1.0,
        viewRotation: session.viewRotation || 0,
        timestamp: Date.now(),
      };

      const putRequest = store.put(record, SESSION_KEY);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => {
        console.warn("IndexedDB save failed:", putRequest.error);
        resolve(); // Don't throw to avoid disrupting UI
      };
    });
  } catch (err) {
    console.warn("Could not save session to IndexedDB:", err);
  }
}

/**
 * Load document session from IndexedDB.
 */
export async function loadDocumentSession(): Promise<StoredDocumentSession | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(SESSION_KEY);

      getRequest.onsuccess = () => {
        const result = getRequest.result as StoredDocumentSession | undefined;
        if (!result || !result.rawBytes || result.rawBytes.byteLength === 0) {
          resolve(null);
          return;
        }

        let arrayBuffer: ArrayBuffer;
        if (result.rawBytes instanceof ArrayBuffer) {
          arrayBuffer = result.rawBytes;
        } else if ((result.rawBytes as any).buffer instanceof ArrayBuffer) {
          const view = result.rawBytes as any;
          arrayBuffer = view.buffer.slice(
            view.byteOffset || 0,
            (view.byteOffset || 0) + (view.byteLength || view.buffer.byteLength)
          );
        } else {
          const u8 = new Uint8Array(result.rawBytes as any);
          arrayBuffer = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
        }

        resolve({
          ...result,
          rawBytes: arrayBuffer,
          documentPassword: result.documentPassword || null,
        });
      };
      getRequest.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Clear document session from IndexedDB.
 */
export async function clearDocumentSession(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const delRequest = store.delete(SESSION_KEY);
      delRequest.onsuccess = () => resolve();
      delRequest.onerror = () => resolve();
    });
  } catch {
    // Ignored
  }
}
