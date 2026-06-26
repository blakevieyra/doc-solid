import {
  generateTemplate,
  getDocumentById,
  getNumberFieldId,
} from "@doc-solid/documents";
import { IndexedDBStorage, createLocalId, type LocalDocument } from "@doc-solid/storage";
import { appendDocumentAudit, type DocumentActor } from "./audit";
import {
  mergeProtectedSignatures,
  redactionSkippedLockedSignatures,
} from "./signature-lock";
import {
  redactDocumentFields,
  type SecurityFinding,
} from "@/lib/security/document-scan";
import { ensureDocumentNumber, resolveDocumentNumber } from "./document-number";
import { canCreateDocumentThisMonth } from "./limits";
import { pushCloudDocument } from "./cloud-sync";

export interface RedactedDocumentCopyResult {
  sourceDoc: LocalDocument | null;
  redactedDoc: LocalDocument | null;
  skippedLockedSignatures: string[];
  error?: string;
}

export async function createRedactedDocumentCopy(
  sourceLocalId: string,
  findings: SecurityFinding[],
  options?: {
    actor?: DocumentActor;
    userId?: string | null;
    unlimitedDocs?: boolean;
    authMode?: "local" | "server";
    /** When false, redaction is blocked (Pro-only feature). */
    securityScanAllowed?: boolean;
    cloudSyncAllowed?: boolean;
  },
): Promise<RedactedDocumentCopyResult> {
  const storage = new IndexedDBStorage();
  const source = await storage.getDocument(sourceLocalId);
  if (!source) {
    return { sourceDoc: null, redactedDoc: null, skippedLockedSignatures: [] };
  }
  if (findings.length === 0) {
    return { sourceDoc: source, redactedDoc: null, skippedLockedSignatures: [], error: "No items selected to redact." };
  }
  if (options?.securityScanAllowed === false) {
    return {
      sourceDoc: source,
      redactedDoc: null,
      skippedLockedSignatures: [],
      error: "Security scan and redaction require a Pro plan.",
    };
  }

  const userId = options?.userId ?? source.userId ?? null;
  if (options?.authMode === "server" && !userId) {
    return {
      sourceDoc: source,
      redactedDoc: null,
      skippedLockedSignatures: [],
      error: "Sign in to save redacted copies to your account.",
    };
  }
  if (options?.unlimitedDocs === false) {
    const existing = await storage.getDocumentsForUser(userId);
    const { allowed, used, limit } = canCreateDocumentThisMonth(existing, false);
    if (!allowed) {
      return {
        sourceDoc: source,
        redactedDoc: null,
        skippedLockedSignatures: [],
        error: `Free plan limit reached (${used}/${limit} documents this month). Upgrade to Pro for unlimited.`,
      };
    }
  }

  const meta = getDocumentById(source.templateId);
  const template = meta ? generateTemplate(meta) : null;
  const existingFields = source.fieldData as Record<string, string>;
  const redactedFields = redactDocumentFields(existingFields, findings, { redactEntireField: true });
  const skippedLockedSignatures = template
    ? redactionSkippedLockedSignatures(redactedFields, existingFields, template)
    : [];
  const protectedData = template
    ? mergeProtectedSignatures(redactedFields, existingFields, template)
    : redactedFields;

  const allFieldIds = template?.sections.flatMap((s) => s.fields.map((f) => f.id)) ?? [];
  const numField = getNumberFieldId(allFieldIds);
  const { documentNumber, fieldData } = ensureDocumentNumber({
    userId,
    templateId: source.templateId,
    fieldData: protectedData,
    numberFieldId: numField,
  });

  const now = new Date().toISOString();
  const sourceNumber = resolveDocumentNumber(source) ?? source.localId.slice(0, 8);
  const metaName = meta?.name ?? source.title.replace(/\s*\([^)]*\)\s*$/, "").split("#")[0].trim();
  const title = `${metaName} #${documentNumber} (Redacted)`;
  const labels = [...new Set(findings.map((f) => f.label))].join(", ");
  const redactionDetails =
    skippedLockedSignatures.length > 0
      ? `Redacted copy from ${source.title} (${sourceNumber}). Redacted: ${labels}. Signed signature field(s) kept intact.`
      : `Redacted copy from ${source.title} (${sourceNumber}). Redacted: ${labels}.`;

  const redactedDoc: LocalDocument = {
    localId: createLocalId(),
    title,
    templateId: source.templateId,
    fieldData,
    documentNumber,
    domain: source.domain,
    category: source.category,
    userId: userId ?? undefined,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
    syncStatus: "LOCAL_ONLY",
    auditLog: [
      {
        type: "created",
        timestamp: now,
        actorEmail: options?.actor?.email,
        actorName: options?.actor?.name,
        details: redactionDetails,
      },
    ],
  };

  await storage.saveDocument(redactedDoc);
  await storage.enqueueSync({
    localId: redactedDoc.localId,
    action: "CREATE",
    payload: redactedDoc,
    timestamp: now,
  });

  const sourceDoc = appendDocumentAudit(
    source,
    "saved",
    options?.actor,
    `Redacted copy created: ${title}`,
  );
  await storage.saveDocument(sourceDoc);

  let savedRedactedDoc = redactedDoc;
  if (options?.authMode === "server") {
    const synced = await pushCloudDocument(redactedDoc);
    if (synced) {
      savedRedactedDoc = { ...redactedDoc, ...synced, syncStatus: "SYNCED" };
      await storage.saveDocument(savedRedactedDoc);
    }
  }

  return { sourceDoc, redactedDoc: savedRedactedDoc, skippedLockedSignatures };
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
