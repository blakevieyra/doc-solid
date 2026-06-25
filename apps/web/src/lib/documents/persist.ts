import { IndexedDBStorage, type LocalDocument } from "@doc-solid/storage";
import { generateTemplate, getDocumentById } from "@doc-solid/documents";
import { appendDocumentAudit, type DocumentActor } from "./audit";
import {
  mergeProtectedSignatures,
  redactionSkippedLockedSignatures,
} from "./signature-lock";
import {
  redactDocumentFields,
  type SecurityFinding,
} from "@/lib/security/document-scan";

export async function applyDocumentRedaction(
  localId: string,
  findings: SecurityFinding[],
  actor?: DocumentActor,
): Promise<{ doc: LocalDocument | null; skippedLockedSignatures: string[] }> {
  const storage = new IndexedDBStorage();
  const doc = await storage.getDocument(localId);
  if (!doc || findings.length === 0) {
    return { doc: null, skippedLockedSignatures: [] };
  }

  const meta = getDocumentById(doc.templateId);
  const template = meta ? generateTemplate(meta) : null;
  const existing = doc.fieldData as Record<string, string>;
  const redacted = redactDocumentFields(existing, findings, { redactEntireField: true });
  const skippedLockedSignatures = template
    ? redactionSkippedLockedSignatures(redacted, existing, template)
    : [];
  const protectedData = template
    ? mergeProtectedSignatures(redacted, existing, template)
    : redacted;

  const labels = [...new Set(findings.map((f) => f.label))].join(", ");
  const auditDetails =
    skippedLockedSignatures.length > 0
      ? `Redacted ${findings.length} item(s) (${labels}). Signed signature field(s) kept intact.`
      : `Redacted ${findings.length} item(s): ${labels}`;

  const updated = await updateSavedDocumentFields(localId, protectedData, {
    actor,
    auditDetails,
  });

  return { doc: updated, skippedLockedSignatures };
}

export async function updateSavedDocumentFields(
  localId: string,
  fieldData: Record<string, string>,
  options?: {
    status?: LocalDocument["status"];
    documentNumber?: string;
    title?: string;
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
    ...(options?.documentNumber ? { documentNumber: options.documentNumber } : {}),
    ...(options?.title ? { title: options.title } : {}),
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
