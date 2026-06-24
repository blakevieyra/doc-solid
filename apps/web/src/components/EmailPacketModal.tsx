"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useProfile } from "./ProfileProvider";
import { useNotifications } from "./NotificationProvider";
import { EmailRecipientPicker, useEmailRecipientSelection } from "@/components/EmailRecipientPicker";
import { canUseFeature } from "@/lib/subscription/plans";
import {
  exportMultipleElementsPdfBase64,
  packetPdfFilename,
} from "@/lib/pdf/exportDocument";
import { parseJsonApiResponse } from "@/lib/api/parseResponse";

const MAX_EMAIL_PDF_BYTES = 4 * 1024 * 1024;

export interface EmailPacketModalProps {
  packetName: string;
  previewElementIds: string[];
  onClose: () => void;
}

export function EmailPacketModal({
  packetName,
  previewElementIds,
  onClose,
}: EmailPacketModalProps) {
  const { profile } = useProfile();
  const { notify } = useNotifications();
  const { senderEmail, senderName, buildRecipientPayload } = useEmailRecipientSelection();

  const canEmailOthers = canUseFeature(profile.subscription, "emailShare");
  const cleanPdf = canUseFeature(profile.subscription, "pdfClean");

  const [sendToSelf, setSendToSelf] = useState(!!senderEmail);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [message, setMessage] = useState("");
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
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      let pdfBase64: string;
      try {
        pdfBase64 = await exportMultipleElementsPdfBase64(previewElementIds, {
          watermark: !cleanPdf,
          forEmail: true,
        });
      } catch {
        setError("Could not build the packet PDF. Try downloading first, then email again.");
        setSending(false);
        return;
      }

      const pdfBytes = Math.ceil(pdfBase64.length * 0.75);
      if (pdfBytes > MAX_EMAIL_PDF_BYTES) {
        setError("Packet PDF is too large to email. Download it instead or remove documents from the packet.");
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
          documentTitle: packetName,
          documentType: "Document Packet",
          message: message.trim() || `Attached: ${packetName} (${previewElementIds.length} document${previewElementIds.length !== 1 ? "s" : ""})`,
          pdfBase64,
          pdfFilename: packetPdfFilename(packetName),
        }),
      });

      const data = await parseJsonApiResponse<{ error?: string; message?: string; sent?: number }>(res, {
        503: "Email is not configured on this server. Contact support if this persists.",
        413: "PDF attachment is too large to email.",
      });

      if (!res.ok) {
        setError(data.error ?? "Failed to send email.");
        setSending(false);
        return;
      }

      try {
        notify({
          type: "share",
          title: "Packet emailed",
          message: data.message ?? `Sent "${packetName}" to ${data.sent} recipient(s)`,
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
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="email-packet-title" onClick={onClose}>
      <div className="modal-card email-doc-modal" onClick={(e) => e.stopPropagation()}>
        <h2 id="email-packet-title">Email Packet</h2>
        <p className="field-help">
          Send &quot;{packetName}&quot; as one combined PDF ({previewElementIds.length} document{previewElementIds.length !== 1 ? "s" : ""})
        </p>

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
        />

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
          Combined PDF attachment{cleanPdf ? "" : " (watermarked on Free plan)"} · {recipientCount} recipient{recipientCount !== 1 ? "s" : ""} selected
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
            {sending ? "Sending…" : `Send Packet${recipientCount > 0 ? ` (${recipientCount})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
