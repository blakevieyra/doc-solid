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

import type { UserProfile } from "@/lib/profile/types";
import { snapshotBrandingIntoValues } from "@/lib/profile/document-branding";

export async function buildSharePayloadFromDocument(
  documentId: string,
  documentTemplateId?: string,
  senderProfile?: UserProfile,
): Promise<{
  documentTemplateId?: string;
  fieldDataSnapshot?: Record<string, string>;
}> {
  const storage = new IndexedDBStorage();
  const doc = await storage.getDocument(documentId);
  if (!doc) {
    return { documentTemplateId };
  }
  const raw = doc.fieldData as Record<string, string>;
  return {
    documentTemplateId: documentTemplateId ?? doc.templateId,
    fieldDataSnapshot: senderProfile
      ? snapshotBrandingIntoValues(senderProfile, raw, { freezeLetterhead: true })
      : raw,
  };
}

export async function saveShareWithDocument(
  share: Omit<DocumentShare, "id" | "createdAt" | "auditLog">,
  options?: { auditType?: ShareAuditEvent["type"]; senderProfile?: UserProfile },
): Promise<DocumentShare> {
  const snapshot = await buildSharePayloadFromDocument(
    share.documentId,
    share.documentTemplateId,
    options?.senderProfile,
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

async function syncShareToServer(shareId: string): Promise<DocumentShare | null> {
  const share = getShareById(shareId);
  if (!share) return null;
  await pushShareToServer(share);
  return getShareById(shareId) ?? share;
}

export function markShareOpened(shareId: string, viewer: { email: string; name: string }): void {
  const share = getShareById(shareId);
  if (!share) return;
  const viewerKey = viewer.email.trim().toLowerCase();
  const recipientKey = share.toEmail.trim().toLowerCase();
  if (viewerKey !== recipientKey) return;
  const alreadyOpened = share.auditLog?.some(
    (e) => e.type === "opened" && e.actorEmail?.trim().toLowerCase() === viewerKey,
  );
  if (alreadyOpened) return;
  recordShareAudit(shareId, "opened", {
    actorEmail: viewer.email,
    actorName: viewer.name,
    details: "Recipient opened the document",
  });
  syncShareToServer(shareId);
}

export async function completeShareSigning(
  shareId: string,
  fieldData: Record<string, string>,
  signer: { email: string; name: string }
): Promise<DocumentShare | null> {
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

export async function returnShareCorrection(
  shareId: string,
  comment: string,
  reviewer: { email: string; name: string }
): Promise<DocumentShare | null> {
  const trimmed = comment.trim();
  if (!trimmed) return null;
  recordShareAudit(shareId, "correction_requested", {
    actorEmail: reviewer.email,
    actorName: reviewer.name,
    details: trimmed,
  });
  return syncShareToServer(shareId);
}

export async function markShareComplete(
  shareId: string,
  actor: { email: string; name: string },
): Promise<DocumentShare | null> {
  const share = getShareById(shareId);
  if (!share || share.completedAt) return null;

  updateShare(shareId, { completedAt: new Date().toISOString() });
  recordShareAudit(shareId, "completed", {
    actorEmail: actor.email,
    actorName: actor.name,
    details: "Marked complete by recipient",
  });
  return syncShareToServer(shareId);
}

export async function keepShare(
  shareId: string,
  keeper: { email: string; name: string }
): Promise<DocumentShare | null> {
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

export function shareNeedsSigningFlow(share: DocumentShare): boolean {
  return share.shareType === "signature_request" || share.shareType === "review_request";
}

export function getShareSigningHref(share: DocumentShare): string | null {
  if (!share.documentTemplateId || !share.fieldDataSnapshot) return null;
  if (!shareNeedsSigningFlow(share)) return null;
  return `/documents/${share.documentTemplateId}?localId=${share.documentId}&sign=1&shareId=${share.id}`;
}

export function getSharePreviewHref(share: DocumentShare): string {
  return `/portal/view/${share.documentId}?shareId=${share.id}`;
}

export function shareWasOpened(share: DocumentShare): boolean {
  const recipientKey = share.toEmail.trim().toLowerCase();
  return (share.auditLog ?? []).some(
    (e) => e.type === "opened" && e.actorEmail?.trim().toLowerCase() === recipientKey,
  );
}

export function getShareReturnComments(share: DocumentShare): ShareAuditEvent[] {
  return (share.auditLog ?? []).filter(
    (e) => e.type === "correction_requested" && Boolean(e.details?.trim()),
  );
}

export function formatShareReturnCommentLine(event: ShareAuditEvent): string {
  const when = new Date(event.timestamp).toLocaleString();
  const name = event.actorName?.trim() || "Recipient";
  const body = event.details?.trim() ?? "";
  return `${when} · ${name} · ${body}`;
}

export function shareHasReturnComments(share: DocumentShare): boolean {
  return getShareReturnComments(share).length > 0;
}

/** Status badge for shares the current user sent */
export function getSentShareStatusLabel(share: DocumentShare): string {
  if (share.completedAt) {
    if (share.shareType === "signature_request") return "Signed & returned";
    if (share.shareType === "review_request") return "Review completed";
    return "Completed";
  }
  const audit = share.auditLog ?? [];
  if (audit.some((e) => e.type === "correction_requested")) return "Returned with comments";
  const opened = shareWasOpened(share);

  if (share.shareType === "share") {
    return opened ? "Received" : "Sent";
  }
  if (share.shareType === "review_request") {
    return opened ? "Received" : "Awaiting review";
  }
  if (audit.some((e) => e.type === "signed")) return "Partially signed";
  return opened ? "Opened — awaiting signature" : "Awaiting response";
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
      return "Received";
    case "signed":
      return "Signed";
    case "completed":
      return "Completed";
    case "correction_requested":
      return "Returned with comments";
    case "kept":
      return "Kept";
    default:
      return event.type;
  }
}
