import type { AgentAnalyzeResponse, AgentProviderKind } from "@/lib/agent";

export interface HistoryEntry {
  id: string;
  code: string;
  providerId: AgentProviderKind;
  result: AgentAnalyzeResponse;
  createdAt: string;
  isPinned?: boolean;
  title?: string;
}

const DB_NAME = "nunopi-history";
const DB_VERSION = 1;
const STORE_NAME = "analyses";
const MAX_ENTRIES = 20;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });
}

export async function saveToHistory(
  entry: Omit<HistoryEntry, "id">,
): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const full: HistoryEntry = { ...entry, id };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(full);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  db.close();

  // trim only unpinned entries to MAX_ENTRIES
  const all = await getAllHistory();
  const unpinned = all.filter((e) => !e.isPinned);
  if (unpinned.length > MAX_ENTRIES) {
    const toDelete = unpinned.slice(MAX_ENTRIES);
    for (const e of toDelete) {
      await deleteFromHistory(e.id);
    }
  }
  return id;
}

export async function getAllHistory(): Promise<HistoryEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const entries = (req.result as HistoryEntry[]).sort((a, b) => {
        // pinned first
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        // then by recency
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        if (isNaN(ta) || isNaN(tb)) return 0;
        return tb - ta;
      });
      resolve(entries);
      db.close();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function updateHistory(
  id: string,
  changes: Partial<Pick<HistoryEntry, "isPinned" | "title">>,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result as HistoryEntry | undefined;
      if (!existing) { resolve(); db.close(); return; }
      const updated: HistoryEntry = { ...existing, ...changes };
      const putReq = store.put(updated);
      putReq.onsuccess = () => { resolve(); db.close(); };
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function deleteFromHistory(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => { resolve(); db.close(); };
    req.onerror = () => reject(req.error);
  });
}

export async function clearHistory(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => { resolve(); db.close(); };
    req.onerror = () => reject(req.error);
  });
}
