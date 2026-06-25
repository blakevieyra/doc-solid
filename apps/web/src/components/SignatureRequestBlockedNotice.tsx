"use client";

import Link from "next/link";

export type SignatureRequestBlockedReason = "none-on-template" | "all-complete";

export function SignatureRequestBlockedNotice({
  reason,
  documentTemplateId,
  documentLocalId,
}: {
  reason: SignatureRequestBlockedReason;
  documentTemplateId?: string;
  documentLocalId?: string;
}) {
  const isNone = reason === "none-on-template";
  const editHref =
    documentTemplateId && documentLocalId
      ? `/documents/${documentTemplateId}?localId=${documentLocalId}`
      : documentTemplateId
        ? `/documents/${documentTemplateId}`
        : null;

  return (
    <div className="signature-request-blocked" role="alert">
      <strong>{isNone ? "This document can't be sent for signature" : "Nothing left to sign"}</strong>
      <p>
        {isNone
          ? "This template has no recipient signature fields. To request a signature, open the document and add a counterparty signature field — or use Send / Share to deliver it without signing."
          : "Every recipient signature field on this document is already signed or locked. You can't request another signature until you add a new unsigned field or start a fresh copy."}
      </p>
      {editHref && (
        <p className="signature-request-blocked-actions">
          <Link href={editHref} className="btn btn-secondary btn-sm">
            Open document
          </Link>
        </p>
      )}
    </div>
  );
}
