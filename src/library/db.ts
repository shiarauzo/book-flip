// Minimal IndexedDB store for uploaded PDFs. Metadata (small) lives in one store
// so the shelf can list books without loading bytes; the raw ArrayBuffers live in
// a separate store, read only when a book is opened.

const DB_NAME = "book-flip";
const VERSION = 1;
const META = "meta";
const BLOBS = "blobs";

export type PdfMeta = { id: string; name: string; addedAt: number };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: "id" });
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** All stored PDFs' metadata (no bytes), oldest first. */
export async function listPdfs(): Promise<PdfMeta[]> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(META, "readonly").objectStore(META).getAll();
      req.onsuccess = () => resolve((req.result as PdfMeta[]).sort((a, b) => a.addedAt - b.addedAt));
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** Persist a PDF's bytes + metadata; returns the new metadata. */
export async function addPdf(name: string, bytes: ArrayBuffer): Promise<PdfMeta> {
  const meta: PdfMeta = { id: crypto.randomUUID(), name, addedAt: Date.now() };
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction([META, BLOBS], "readwrite");
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
      t.objectStore(META).put(meta);
      t.objectStore(BLOBS).put({ id: meta.id, bytes });
    });
  } finally {
    db.close();
  }
  // Opt out of eviction under storage pressure (best-effort).
  void navigator.storage?.persist?.();
  return meta;
}

/** The raw bytes for a stored PDF, or null if missing. */
export async function getPdfBytes(id: string): Promise<ArrayBuffer | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(BLOBS, "readonly").objectStore(BLOBS).get(id);
      req.onsuccess = () => resolve((req.result as { bytes: ArrayBuffer } | undefined)?.bytes ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function removePdf(id: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const t = db.transaction([META, BLOBS], "readwrite");
      t.oncomplete = () => resolve();
      t.onerror = () => reject(t.error);
      t.objectStore(META).delete(id);
      t.objectStore(BLOBS).delete(id);
    });
  } finally {
    db.close();
  }
}
