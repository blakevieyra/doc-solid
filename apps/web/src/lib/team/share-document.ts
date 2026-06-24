import { IndexedDBStorage } from "@doc-solid/storage";
import {
  getShareById,
  loadShares,
  recordShareAudit,
  saveShare,
  updateShare,
  type DocumentShare,
  type ShareAuditEvent,
} from "./invites";

export async function buildSharePayloadFromDocument(
  documentId: string,
  documentTemplateId?: string
): Promise<{
  documentTemplateId?: string;
  fieldDataSnapshot?: Record<string, string>;
}> {
  const storage = new IndexedDBStorage();
  const doc = await storage.getDocument(documentId);
  if (!doc) {
    return { documentTemplateId };
  }
  return {
    documentTemplateId: documentTemplateId ?? doc.templateId,
    fieldDataSnapshot: doc.fieldData as Record<string, string>,
  };
}

export async function saveShareWithDocument(
  share: Omit<DocumentShare, "id" | "createdAt" | "auditLog">,
  options?: { auditType?: ShareAuditEvent["type"] }
): Promise<DocumentShare> {
  const snapshot = await buildSharePayloadFromDocument(
    share.documentId,
    share.documentTemplateId
  );
  const full = saveShare({
    ...share,
    documentTemplateId: snapshot.documentTemplateId ?? share.documentTemplateId,
    fieldDataSnapshot: snapshot.fieldDataSnapshot,
  });
  recordShareAudit(full.id, options?.auditType ?? "sent", {
    actorEmail: share.fromEmail,
    actorName: share.fromName,
    details: share.shareType === "signature_request" ? "Signature request sent" : "Document shared",
  });
  recordShareAudit(full.id, "received", {
    actorEmail: share.toEmail,
    actorName: share.toName,
    details: "Delivered to recipient inbox",
  });
  return full;
}

export function markShareOpened(shareId: string, viewer: { email: string; name: string }): void {
  const share = getShareById(shareId);
  if (!share) return;
  const alreadyOpened = share.auditLog?.some((e) => e.type === "opened" && e.actorEmail === viewer.email);
  if (alreadyOpened) return;
  recordShareAudit(shareId, "opened", {
    actorEmail: viewer.email,
    actorName: viewer.name,
    details: "Recipient opened the document",
  });
}

export function completeShareSigning(
  shareId: string,
  fieldData: Record<string, string>,
  signer: { email: string; name: string }
): DocumentShare | null {
  const share = getShareById(shareId);
  if (!share) return null;

  const assigned = share.signatureFieldIds ?? [];
  const allSigned =
    assigned.length === 0 ||
    assigned.every((fieldId) => {
      const raw = fieldData[fieldId];
      return Boolean(raw?.trim());
    });

  const updated = updateShare(shareId, {
    fieldDataSnapshot: fieldData,
    signedAt: new Date().toISOString(),
    ...(allSigned ? { completedAt: new Date().toISOString(), shareType: share.shareType } : {}),
  });

  recordShareAudit(shareId, "signed", {
    actorEmail: signer.email,
    actorName: signer.name,
    details: assigned.length
      ? `Signed field(s): ${assigned.join(", ")}`
      : "Signature applied",
  });

  if (allSigned) {
    recordShareAudit(shareId, "completed", {
      actorEmail: signer.email,
      actorName: signer.name,
      details: "All requested signatures completed — returned to sender",
    });
  }

  return updated;
}

export function getShareAuditLabel(event: ShareAuditEvent): string {
  switch (event.type) {
    case "sent":
      return "Sent";
    case "received":
      return "Received";
    case "opened":
      return "Opened";
    case "signed":
      return "Signed";
    case "completed":
      return "Completed";
    default:
      return event.type;
  }
}
