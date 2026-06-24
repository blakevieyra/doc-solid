import { IndexedDBStorage, type LocalDocument } from "@doc-solid/storage";
import { generateTemplate, getDocumentById } from "@doc-solid/documents";
import { mergeProtectedSignatures } from "./signature-lock";

export async function updateSavedDocumentFields(
  localId: string,
  fieldData: Record<string, string>,
  options?: { status?: LocalDocument["status"] }
): Promise<LocalDocument | null> {
  const storage = new IndexedDBStorage();
  const doc = await storage.getDocument(localId);
  if (!doc) return null;

  const meta = getDocumentById(doc.templateId);
  const template = meta ? generateTemplate(meta) : null;
  const protectedData = template
    ? mergeProtectedSignatures(fieldData, doc.fieldData as Record<string, string>, template)
    : fieldData;

  const updated: LocalDocument = {
    ...doc,
    fieldData: protectedData,
    updatedAt: new Date().toISOString(),
    ...(options?.status ? { status: options.status } : {}),
  };
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
