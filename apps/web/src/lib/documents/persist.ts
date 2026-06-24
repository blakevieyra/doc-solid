import { IndexedDBStorage, type LocalDocument } from "@doc-solid/storage";
import { generateTemplate, getDocumentById } from "@doc-solid/documents";
import { appendDocumentAudit, type DocumentActor } from "./audit";
import { mergeProtectedSignatures } from "./signature-lock";

export async function updateSavedDocumentFields(
  localId: string,
  fieldData: Record<string, string>,
  options?: {
    status?: LocalDocument["status"];
    actor?: DocumentActor;
    auditDetails?: string;
  }
): Promise<LocalDocument | null> {
  const storage = new IndexedDBStorage();
  const doc = await storage.getDocument(localId);
  if (!doc) return null;

  const meta = getDocumentById(doc.templateId);
  const template = meta ? generateTemplate(meta) : null;
  const protectedData = template
    ? mergeProtectedSignatures(fieldData, doc.fieldData as Record<string, string>, template)
    : fieldData;

  let updated: LocalDocument = {
    ...doc,
    fieldData: protectedData,
    updatedAt: new Date().toISOString(),
    ...(options?.status ? { status: options.status } : {}),
  };

  if (options?.status && options.status !== doc.status) {
    updated = appendDocumentAudit(
      updated,
      options.status === "ARCHIVED" ? "archived" : "status_changed",
      options?.actor,
      options?.auditDetails ?? `Status → ${options.status}`
    );
  } else {
    updated = appendDocumentAudit(
      updated,
      "saved",
      options?.actor,
      options?.auditDetails ?? "Document saved"
    );
  }

  await storage.saveDocument(updated);
  return updated;
}

export async function archiveSavedDocument(
  localId: string,
  actor?: DocumentActor
): Promise<LocalDocument | null> {
  const storage = new IndexedDBStorage();
  const doc = await storage.getDocument(localId);
  if (!doc) return null;
  if (doc.status === "ARCHIVED") return doc;

  const updated = appendDocumentAudit(
    {
      ...doc,
      status: "ARCHIVED",
      updatedAt: new Date().toISOString(),
    },
    "archived",
    actor,
    "Moved to archive"
  );
  await storage.saveDocument(updated);
  return updated;
}

export async function unarchiveSavedDocument(
  localId: string,
  actor?: DocumentActor
): Promise<LocalDocument | null> {
  const storage = new IndexedDBStorage();
  const doc = await storage.getDocument(localId);
  if (!doc) return null;
  if (doc.status !== "ARCHIVED") return doc;

  const updated = appendDocumentAudit(
    {
      ...doc,
      status: "FINAL",
      updatedAt: new Date().toISOString(),
    },
    "unarchived",
    actor,
    "Restored from archive"
  );
  await storage.saveDocument(updated);
  return updated;
}

export async function deleteSavedDocument(localId: string): Promise<boolean> {
  const storage = new IndexedDBStorage();
  const doc = await storage.getDocument(localId);
  if (!doc) return false;
  await storage.deleteDocument(localId);
  return true;
}
