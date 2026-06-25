"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IndexedDBStorage } from "@doc-solid/storage";
import { generateTemplate, getDocumentById } from "@doc-solid/documents";
import { useProfile } from "./ProfileProvider";
import { useAuth } from "./AuthProvider";
import { useNotifications } from "./NotificationProvider";
import { getEmailRecipients } from "@/lib/team/recipients";
import { saveShareWithDocument } from "@/lib/team/share-document";
import { recordDocumentShareAudit } from "@/lib/documents/share-audit";
import { canUseFeature } from "@/lib/subscription/plans";
import { emptyCounterpartySignatureFields } from "@/lib/documents/signature-access";
import { TeamMemberPickerRow } from "@/components/TeamMemberPickerRow";
import { AddRecipientForm } from "@/components/AddRecipientForm";

export type SendToContactMode = "share" | "signature";

export interface SendToContactModalProps {
  mode: SendToContactMode;
  documentTitle: string;
  documentId: string;
  documentTemplateId?: string;
  onClose: () => void;
}

export function SendToContactModal({
  mode,
  documentTitle,
  documentId,
  documentTemplateId,
  onClose,
}: SendToContactModalProps) {
  const { profile } = useProfile();
  const { session } = useAuth();
  const { notify } = useNotifications();
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [availableFields, setAvailableFields] = useState<{ id: string; label: string }[]>([]);
  const [resolvedTemplateId, setResolvedTemplateId] = useState<string | undefined>(documentTemplateId);
  const [message, setMessage] = useState(
    mode === "signature"
      ? "Please review this document and add your signature."
      : "Please review this document."
  );
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const selfEmail = session?.email ?? profile.account.email ?? "";
  const teamAllowed = canUseFeature(profile.subscription, "teamSharing");

  const recipients = useMemo(
    () => getEmailRecipients(profile, selfEmail),
    [profile, selfEmail]
  );

  useEffect(() => {
    if (mode !== "signature") return;
    async function loadFields() {
      const storage = new IndexedDBStorage();
      const doc = await storage.getDocument(documentId);
      const templateId = documentTemplateId ?? doc?.templateId;
      if (!templateId) return;
      setResolvedTemplateId(templateId);
      const meta = getDocumentById(templateId);
      if (!meta) return;
      const template = generateTemplate(meta);
      const values = (doc?.fieldData ?? {}) as Record<string, string>;
      const empty = emptyCounterpartySignatureFields(template, values);
      setAvailableFields(empty.map((f) => ({ id: f.id, label: f.label })));
      setSelectedFields(empty.map((f) => f.id));
    }
    void loadFields();
  }, [documentId, documentTemplateId, mode]);

  function toggle(email: string) {
    setSelected((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  }

  function toggleField(fieldId: string) {
    setSelectedFields((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  }

  function handleRecipientAdded(email: string) {
    setSelected((prev) => (prev.includes(email) ? prev : [...prev, email]));
    setError("");
  }

  async function handleSend() {
    setError("");
    if (!teamAllowed) {
      setError("Sharing with contacts is a Pro feature. Upgrade to send documents in-app.");
      return;
    }
    if (selected.length === 0) {
      setError("Select at least one recipient, or add one below.");
      return;
    }
    if (mode === "signature" && selectedFields.length === 0) {
      setError("Select at least one signature field.");
      return;
    }

    const fromName = session?.name ?? profile.account.displayName ?? "DocSolid User";
    const fromEmail = session?.email ?? profile.account.email ?? "";

    for (const email of selected) {
      const recipient = recipients.find((r) => r.email === email);
      await saveShareWithDocument({
        documentTitle,
        documentId,
        documentTemplateId: resolvedTemplateId,
        fromName,
        fromEmail,
        toEmail: email,
        toName: recipient?.name ?? email,
        message: message.trim() || (mode === "signature" ? "Signature requested" : "Document shared"),
        shareType: mode === "signature" ? "signature_request" : "share",
        ...(mode === "signature" ? { signatureFieldIds: selectedFields } : {}),
      });
    }

    await recordDocumentShareAudit(documentId, selected, fromEmail, fromName, mode);

    notify({
      type: "share",
      title: mode === "signature" ? "Signature requested" : "Document sent",
      message: `Sent "${documentTitle}" to ${selected.length} recipient(s)`,
    });

    setSent(true);
    setTimeout(onClose, 1400);
  }

  const title = mode === "signature" ? "Request signature" : "Send to contact";

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="field-help">
          Send &quot;{documentTitle}&quot; to a registered team member or document contact.
        </p>

        {!teamAllowed && (
          <div className="email-doc-notice">
            Pro required for in-app sharing.{" "}
            <Link href="/profile?tab=billing">Upgrade</Link>
          </div>
        )}

        {mode === "signature" && availableFields.length > 0 && (
          <div className="field-group">
            <label>Signature fields to request</label>
            <ul className="team-share-list">
              {availableFields.map((f) => (
                <li key={f.id}>
                  <label className="security-toggle">
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(f.id)}
                      onChange={() => toggleField(f.id)}
                      disabled={!teamAllowed}
                    />
                    <div>
                      <strong>{f.label}</strong>
                      <span>{f.id}</span>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {recipients.length === 0 ? (
          <p className="field-help">No recipients yet — add a contact or team member below.</p>
        ) : (
          <>
            <p className="field-help" style={{ marginBottom: "0.5rem" }}>
              Select who should receive this document ({recipients.length} available).
            </p>
            <ul className="team-share-list">
              {recipients.map((r) => (
                <li key={r.id}>
                  <TeamMemberPickerRow
                    recipient={r}
                    checked={selected.includes(r.email)}
                    disabled={!teamAllowed}
                    onToggle={() => toggle(r.email)}
                    profile={profile}
                    selfEmail={selfEmail}
                  />
                </li>
              ))}
            </ul>
          </>
        )}

        <AddRecipientForm
          onAdded={handleRecipientAdded}
          disabled={!teamAllowed}
          compact={recipients.length > 0}
        />

        <div className="field-group">
          <label>Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            disabled={!teamAllowed}
          />
        </div>

        {error && <p className="field-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={selected.length === 0 || sent || !teamAllowed}
            onClick={() => void handleSend()}
          >
            {sent ? "Sent ✓" : `${title} (${selected.length || 0})`}
          </button>
        </div>
      </div>
    </div>
  );
}
