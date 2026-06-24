import { IndexedDBStorage, type LocalDocument } from "@doc-solid/storage";

export async function fetchCloudDocuments(): Promise<LocalDocument[] | null> {
  const res = await fetch("/api/documents", { credentials: "include", cache: "no-store" });
  if (res.status === 401 || res.status === 503) return null;
  if (!res.ok) return null;
  const data = await res.json() as { documents: LocalDocument[] };
  return data.documents;
}

export async function pushCloudDocument(doc: LocalDocument): Promise<LocalDocument | null> {
  const res = await fetch("/api/documents", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document: doc }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { document: LocalDocument };
  return data.document;
}

export async function deleteCloudDocument(localId: string): Promise<boolean> {
  const res = await fetch(`/api/documents?localId=${encodeURIComponent(localId)}`, {
    method: "DELETE",
    credentials: "include",
  });
  return res.ok;
}

/** Merge cloud documents into IndexedDB (cloud wins when newer). */
export async function syncDocumentsFromCloud(userId: string | null): Promise<number> {
  const cloud = await fetchCloudDocuments();
  if (!cloud) return 0;

  const storage = new IndexedDBStorage();
  let merged = 0;

  for (const remote of cloud) {
    const local = await storage.getDocument(remote.localId);
    const remoteUpdated = new Date(remote.updatedAt).getTime();
    const localUpdated = local ? new Date(local.updatedAt).getTime() : 0;

    if (!local || remoteUpdated >= localUpdated) {
      await storage.saveDocument({
        ...remote,
        userId: userId ?? remote.userId,
        syncStatus: "SYNCED",
      });
      merged++;
    }
  }

  return merged;
}
