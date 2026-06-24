export type SyncAction = "CREATE" | "UPDATE" | "DELETE";

export type DocumentAuditEventType =
  | "created"
  | "saved"
  | "status_changed"
  | "shared"
  | "signed"
  | "opened"
  | "archived"
  | "returned"
  | "emailed";

export interface DocumentAuditEvent {
  type: DocumentAuditEventType;
  timestamp: string;
  actorEmail?: string;
  actorName?: string;
  details?: string;
}

export interface LocalDocument {
  localId: string;
  cloudId?: string;
  title: string;
  templateId: string;
  fieldData: Record<string, unknown>;
  status: "DRAFT" | "FINAL" | "ARCHIVED";
  folderId?: string;
  /** Sequential accounting number, e.g. INV-2026-0042 */
  documentNumber?: string;
  domain?: string;
  category?: string;
  userId?: string;
  createdAt?: string;
  updatedAt: string;
  syncStatus: "SYNCED" | "PENDING" | "CONFLICT" | "LOCAL_ONLY";
  auditLog?: DocumentAuditEvent[];
}

export interface DocumentSearchFilters {
  query?: string;
  templateId?: string;
  domain?: string;
  category?: string;
  status?: LocalDocument["status"];
  sortBy?: "updatedAt" | "createdAt" | "title" | "documentNumber";
  sortDir?: "asc" | "desc";
}

export interface SyncQueueItem {
  localId: string;
  action: SyncAction;
  payload: LocalDocument;
  timestamp: string;
}

export interface StorageAdapter {
  getDocuments(): Promise<LocalDocument[]>;
  getDocument(localId: string): Promise<LocalDocument | null>;
  saveDocument(doc: LocalDocument): Promise<void>;
  deleteDocument(localId: string): Promise<void>;
  getSyncQueue(): Promise<SyncQueueItem[]>;
  enqueueSync(item: SyncQueueItem): Promise<void>;
  clearSyncItem(localId: string): Promise<void>;
}

/** Web: IndexedDB adapter with indexes for search */
export class IndexedDBStorage implements StorageAdapter {
  private dbName = "doc-solid";
  private storeName = "documents";
  private queueStore = "sync-queue";
  private dbVersion = 2;

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onupgradeneeded = () => {
        const db = request.result;
        let docStore: IDBObjectStore;
        if (!db.objectStoreNames.contains(this.storeName)) {
          docStore = db.createObjectStore(this.storeName, { keyPath: "localId" });
        } else {
          docStore = request.transaction!.objectStore(this.storeName);
        }
        const indexNames = ["templateId", "status", "domain", "category", "documentNumber", "updatedAt", "userId"];
        for (const name of indexNames) {
          if (!docStore.indexNames.contains(name)) {
            docStore.createIndex(name, name, { unique: false });
          }
        }
        if (!db.objectStoreNames.contains(this.queueStore)) {
          db.createObjectStore(this.queueStore, { keyPath: "localId" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getDocuments(): Promise<LocalDocument[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /** Returns documents owned by userId. Legacy docs without userId are excluded when userId is set. */
  async getDocumentsForUser(userId: string | null): Promise<LocalDocument[]> {
    if (!userId) return this.getDocuments();
    const byUser = await this.getDocumentsByIndex("userId", userId);
    return byUser;
  }

  async deleteDocumentsForUser(userId: string): Promise<number> {
    const docs = await this.getDocumentsForUser(userId);
    for (const doc of docs) {
      await this.deleteDocument(doc.localId);
    }
    return docs.length;
  }

  async getDocumentsByIndex(
    indexName: keyof Pick<LocalDocument, "templateId" | "status" | "domain" | "category" | "userId">,
    value: string
  ): Promise<LocalDocument[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      if (!store.indexNames.contains(indexName)) {
        resolve([]);
        return;
      }
      const request = store.index(indexName).getAll(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getDocument(localId: string): Promise<LocalDocument | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const request = tx.objectStore(this.storeName).get(localId);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveDocument(doc: LocalDocument): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      tx.objectStore(this.storeName).put(doc);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteDocument(localId: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      tx.objectStore(this.storeName).delete(localId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getSyncQueue(): Promise<SyncQueueItem[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.queueStore, "readonly");
      const request = tx.objectStore(this.queueStore).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async enqueueSync(item: SyncQueueItem): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.queueStore, "readwrite");
      tx.objectStore(this.queueStore).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearSyncItem(localId: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.queueStore, "readwrite");
      tx.objectStore(this.queueStore).delete(localId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.storeName, this.queueStore], "readwrite");
      tx.objectStore(this.storeName).clear();
      tx.objectStore(this.queueStore).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export function createLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export { searchDocuments, groupDocumentsByType, documentTypeCounts } from "./search";
