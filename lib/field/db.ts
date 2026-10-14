export const FIELD_DB_NAME = "redline-field-v1";
export const FIELD_DB_VERSION = 1;

export interface PendingMutation {
  owner_user_id?: string;
  id: string;
  idempotency_key: string;
  action: string;
  url: string;
  method: "POST" | "PUT" | "PATCH";
  body: unknown;
  queued_at: string;
  dependency_ids: string[];
  retry_count: number;
  last_error: string | null;
  next_retry_at: string | null;
}

export interface PendingMedia {
  owner_user_id?: string;
  id: string;
  service_run_id: string;
  blob: Blob;
  filename: string;
  mime_type: string;
  evidence_type: "before" | "after";
  byte_size: number;
  queued_at: string;
  retry_count: number;
  last_error: string | null;
  next_retry_at: string | null;
}

export interface SyncMetadataEntry {
  key: string;
  value: unknown;
  updated_at: string;
}

let _db: IDBDatabase | null = null;
let _openPromise: Promise<IDBDatabase> | null = null;

function upgradeFieldDb(db: IDBDatabase) {
  if (!db.objectStoreNames.contains("cachedAssignments")) {
    db.createObjectStore("cachedAssignments", { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains("cachedProperties")) {
    db.createObjectStore("cachedProperties", { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains("cachedTemplates")) {
    db.createObjectStore("cachedTemplates", { keyPath: "id" });
  }
  if (!db.objectStoreNames.contains("activeRuns")) {
    db.createObjectStore("activeRuns", { keyPath: "serviceRunId" });
  }
  if (!db.objectStoreNames.contains("pendingMutations")) {
    const store = db.createObjectStore("pendingMutations", { keyPath: "id" });
    store.createIndex("by_queued_at", "queued_at");
    store.createIndex("by_action", "action");
    store.createIndex("by_next_retry_at", "next_retry_at");
  }
  if (!db.objectStoreNames.contains("pendingMedia")) {
    const store = db.createObjectStore("pendingMedia", { keyPath: "id" });
    store.createIndex("by_mutation_id", "mutation_id");
  }
  if (!db.objectStoreNames.contains("syncMetadata")) {
    db.createObjectStore("syncMetadata", { keyPath: "key" });
  }
}

export function openFieldDb(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  if (_openPromise) return _openPromise;

  _openPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(FIELD_DB_NAME, FIELD_DB_VERSION);
    req.onupgradeneeded = (e) => upgradeFieldDb((e.target as IDBOpenDBRequest).result);
    req.onsuccess = (e) => {
      _db = (e.target as IDBOpenDBRequest).result;
      resolve(_db);
    };
    req.onerror = () => {
      _openPromise = null;
      reject(req.error);
    };
    req.onblocked = () => reject(new Error("IndexedDB upgrade blocked by another tab."));
  });

  return _openPromise;
}

export function idbGet<T>(db: IDBDatabase, storeName: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export function idbPut(db: IDBDatabase, storeName: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Local save was aborted."));
    tx.onerror = () => reject(tx.error ?? new Error("Local save failed."));
  });
}

export function idbDelete(db: IDBDatabase, storeName: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Local deletion was aborted."));
    tx.onerror = () => reject(tx.error ?? new Error("Local deletion failed."));
  });
}

export function idbGetAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export function idbCount(db: IDBDatabase, storeName: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
