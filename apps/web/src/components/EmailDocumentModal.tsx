"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useProfile } from "./ProfileProvider";
import { useNotifications } from "./NotificationProvider";
import { EmailRecipientPicker, useEmailRecipientSelection } from "@/components/EmailRecipientPicker";
import { saveShareWithDocument } from "@/lib/team/share-document";
import { canUseFeature } from "@/lib/subscription/plans";
import {
  documentPdfFilename,
  exportDocumentPdfBase64,
} from "@/lib/pdf/exportDocument";
import { parseJsonApiResponse } from "@/lib/api/parseResponse";

/** Vercel serverless body limit (~4.5 MB); keep base64 under ~4 MB decoded. */
const MAX_EMAIL_PDF_BYTES = 4 * 1024 * 1024;

export interface EmailDocumentModalProps {
  documentTitle: string;
  documentType?: string;
  documentNumber?: string;
  documentId?: string;
  previewElementId?: string;
  onClose: () => void;
}

export function EmailDocumentModal({
  documentTitle,
  documentType,
  documentNumber,
  documentId,
  previewElementId = "document-preview",
  onClose,
}: EmailDocumentModalProps) {
  const { profile, documentProfile } = useProfile();
  const { notify } = useNotifications();
  const { senderEmail, senderName, buildRecipientPayload } = useEmailRecipientSelection();

  const canEmailOthers = canUseFeature(profile.subscription, "emailShare");
  const cleanPdf = canUseFeature(profile.subscription, "pdfClean");

  const [sendToSelf, setSendToSelf] = useState(!!senderEmail);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [alsoShareInApp, setAlsoShareInApp] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const recipientCount = useMemo(() => {
    const emails = new Set<string>();
    if (sendToSelf && senderEmail) emails.add(senderEmail.toLowerCase());
    selectedEmails.forEach((e) => emails.add(e.toLowerCase()));
    return emails.size;
  }, [sendToSelf, senderEmail, selectedEmails]);

  async function handleSend() {
    setError("");
    setSuccess("");

    if (recipientCount === 0) {
      setError("Select at least one recipient.");
      return;
    }

    const recipients = buildRecipientPayload(selectedEmails, sendToSelf);

    if (!canEmailOthers && recipients.some((r) => r.email !== senderEmail?.toLowerCase())) {
      setError("Upgrade to Pro to email team members and external recipients.");
      return;
    }

    setSending(true);
    try {
      let pdfBase64: string | undefined;
      try {
        pdfBase64 = await exportDocumentPdfBase64(previewElementId, {
          watermark: !cleanPdf,
          forEmail: true,
        });
      } catch {
        setError("Could not generate PDF preview. Scroll to the document preview and try again.");
        setSending(false);
        return;
      }

      const pdfBytes = Math.ceil(pdfBase64.length * 0.75);
      if (pdfBytes > MAX_EMAIL_PDF_BYTES) {
        setError(
          "PDF attachment is too large to email. Download the PDF instead, or remove extra content and try again."
        );
        setSending(false);
        return;
      }

      const res = await fetch("/api/documents/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients,
          senderName,
          senderEmail,
          documentTitle,
          documentType,
          documentNumber,
          message: message.trim() || undefined,
          pdfBase64,
          pdfFilename: documentPdfFilename(documentTitle),
        }),
      });

      const data = await parseJsonApiResponse<{ error?: string; message?: string; sent?: number }>(res, {
        503: "Email is not configured on this server. Contact support if this persists.",
        413: "PDF attachment is too large to email. Download the PDF instead or shorten the document.",
      });

      if (!res.ok) {
        setError(data.error ?? "Failed to send email.");
        setSending(false);
        return;
      }

      if (alsoShareInApp && documentId) {
        for (const email of selectedEmails) {
          const member = profile.team.members.find((m) => m.email.toLowerCase() === email.toLowerCase())
            ?? profile.library?.contacts?.find((c) => c.email.toLowerCase() === email.toLowerCase());
          await saveShareWithDocument({
            documentTitle,
            documentId,
            fromName: senderName,
            fromEmail: senderEmail ?? "",
            toEmail: email,
            toName: member?.name ?? email,
            message: message.trim() || undefined,
            shareType: "share",
          }, { senderProfile: documentProfile });
        }
      }

      try {
        notify({
          type: "share",
          title: "Document emailed",
          message: data.message ?? `Sent "${documentTitle}" to ${data.sent} recipient(s)`,
        });
      } catch {
        /* notification is optional */
      }

      setSuccess(data.message ?? "Email sent successfully.");
      setTimeout(onClose, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg.includes("Failed to fetch") || msg.includes("NetworkError")
          ? "Network error. Check your connection and try again."
          : msg || "Something went wrong while sending. Please try again."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="email-doc-title" onClick={onClose}>
      <div className="modal-card email-doc-modal" onClick={(e) => e.stopPropagation()}>
        <h2 id="email-doc-title">Email Document</h2>
        <p className="field-help">Send &quot;{documentTitle}&quot; as a PDF attachment</p>

        {!canEmailOthers && (
          <div className="email-doc-notice">
            Free plan: email to yourself only.{" "}
            <Link href="/profile?tab=billing">Upgrade to Pro</Link> to email your team and others.
          </div>
        )}

        <EmailRecipientPicker
          canEmailOthers={canEmailOthers}
          selectedEmails={selectedEmails}
          onChange={setSelectedEmails}
          sendToSelf={sendToSelf}
          onSendToSelfChange={setSendToSelf}
        >
          {documentId && selectedEmails.length > 0 && canEmailOthers && (
            <label className="security-toggle email-doc-inapp">
              <input
                type="checkbox"
                checked={alsoShareInApp}
                onChange={(e) => setAlsoShareInApp(e.target.checked)}
              />
              <div>
                <strong>Also add to team portal inbox</strong>
                <span>Recipients can open the document in My Files → Shared with you</span>
              </div>
            </label>
          )}
        </EmailRecipientPicker>

        <div className="field-group">
          <label>Message (optional)</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a note for recipients..."
            rows={3}
          />
        </div>

        <p className="field-help email-doc-attach-note">
          PDF attachment{cleanPdf ? "" : " (watermarked on Free plan)"} · {recipientCount} recipient{recipientCount !== 1 ? "s" : ""} selected
        </p>

        {error && <p className="field-error">{error}</p>}
        {success && <p className="field-success">{success}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={sending}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={sending || recipientCount === 0}
            onClick={handleSend}
          >
            {sending ? "Sending…" : `Send Email${recipientCount > 0 ? ` (${recipientCount})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
