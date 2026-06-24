import { IndexedDBStorage } from "@doc-solid/storage";
import {
  getShareById,
  recordShareAudit,
  saveShare,
  updateShare,
  type DocumentShare,
  type ShareAuditEvent,
} from "./invites";
import { pushShareToServer } from "./shares-sync";

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
    details:
      share.shareType === "signature_request"
        ? "Signature request sent"
        : share.shareType === "review_request"
          ? "Review request sent"
          : "Document shared",
  });
  recordShareAudit(full.id, "received", {
    actorEmail: share.toEmail,
    actorName: share.toName,
    details: "Delivered to recipient inbox",
  });
  const updated = getShareById(full.id) ?? full;
  await pushShareToServer(updated);
  return updated;
}

function syncShareToServer(shareId: string): DocumentShare | null {
  const share = getShareById(shareId);
  if (share) void pushShareToServer(share);
  return share;
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
  syncShareToServer(shareId);
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

  updateShare(shareId, {
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

  return syncShareToServer(shareId);
}

export function returnShareCorrection(
  shareId: string,
  comment: string,
  reviewer: { email: string; name: string }
): DocumentShare | null {
  const trimmed = comment.trim();
  if (!trimmed) return null;
  recordShareAudit(shareId, "correction_requested", {
    actorEmail: reviewer.email,
    actorName: reviewer.name,
    details: trimmed,
  });
  return syncShareToServer(shareId);
}

export function keepShare(
  shareId: string,
  keeper: { email: string; name: string }
): DocumentShare | null {
  const share = getShareById(shareId);
  if (!share || share.completedAt) return null;

  updateShare(shareId, { completedAt: new Date().toISOString() });
  recordShareAudit(shareId, "kept", {
    actorEmail: keeper.email,
    actorName: keeper.name,
    details: "Document kept on file",
  });
  return syncShareToServer(shareId);
}

export function shareWasReturnedBy(
  share: DocumentShare,
  email: string
): boolean {
  const key = email.trim().toLowerCase();
  if (!key) return false;
  return (share.auditLog ?? []).some(
    (e) => e.type === "correction_requested" && e.actorEmail?.trim().toLowerCase() === key
  );
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
    case "correction_requested":
      return "Correction requested";
    case "kept":
      return "Kept";
    default:
      return event.type;
  }
}
