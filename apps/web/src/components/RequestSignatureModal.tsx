"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { IndexedDBStorage } from "@doc-solid/storage";
import { generateTemplate, getDocumentById } from "@doc-solid/documents";
import { useProfile } from "./ProfileProvider";
import { useAuth } from "./AuthProvider";
import { useNotifications } from "./NotificationProvider";
import { saveShareWithDocument } from "@/lib/team/share-document";
import { recordDocumentShareAudit } from "@/lib/documents/share-audit";
import { getEmailRecipients } from "@/lib/team/recipients";
import { canUseFeature } from "@/lib/subscription/plans";
import { emptyCounterpartySignatureFields, countCounterpartySignatureFields } from "@/lib/documents/signature-access";
import { TeamMemberPickerRow } from "@/components/TeamMemberPickerRow";
import { SignatureFieldPickerRow } from "@/components/SignatureFieldPickerRow";
import { AddRecipientForm } from "@/components/AddRecipientForm";
import {
  SignatureRequestBlockedNotice,
  type SignatureRequestBlockedReason,
} from "@/components/SignatureRequestBlockedNotice";

export interface RequestSignatureModalProps {
  documentTitle: string;
  documentId: string;
  documentTemplateId?: string;
  onClose: () => void;
}

export function RequestSignatureModal({
  documentTitle,
  documentId,
  documentTemplateId,
  onClose,
}: RequestSignatureModalProps) {
  const { profile, documentProfile } = useProfile();
  const { session } = useAuth();
  const { notify } = useNotifications();
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [availableFields, setAvailableFields] = useState<{ id: string; label: string }[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [blockedReason, setBlockedReason] = useState<SignatureRequestBlockedReason | null>(null);
  const [resolvedTemplateId, setResolvedTemplateId] = useState<string | undefined>(documentTemplateId);
  const [message, setMessage] = useState("Please review this document and add your signature.");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const teamAllowed = canUseFeature(profile.subscription, "teamSharing");
  const selfEmail = session?.email ?? profile.account.email ?? "";
  const members = useMemo(
    () => getEmailRecipients(profile, selfEmail),
    [profile, selfEmail]
  );

  useEffect(() => {
    async function loadFields() {
      setFieldsLoading(true);
      const storage = new IndexedDBStorage();
      const doc = await storage.getDocument(documentId);
      const templateId = documentTemplateId ?? doc?.templateId;
      if (!templateId) {
        setFieldsLoading(false);
        return;
      }
      setResolvedTemplateId(templateId);
      const meta = getDocumentById(templateId);
      if (!meta) {
        setFieldsLoading(false);
        return;
      }
      const template = generateTemplate(meta);
      const values = (doc?.fieldData ?? {}) as Record<string, string>;
      const empty = emptyCounterpartySignatureFields(template, values);
      const counterpartyCount = countCounterpartySignatureFields(template);
      setAvailableFields(empty.map((f) => ({ id: f.id, label: f.label })));
      setSelectedFields(empty.map((f) => f.id));
      if (counterpartyCount === 0) {
        setBlockedReason("none-on-template");
      } else if (empty.length === 0) {
        setBlockedReason("all-complete");
      } else {
        setBlockedReason(null);
      }
      setFieldsLoading(false);
    }
    void loadFields();
  }, [documentId, documentTemplateId]);

  const canRequestSignatures = teamAllowed && !fieldsLoading && availableFields.length > 0;

  function toggleMember(email: string) {
    setSelectedMembers((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  }

  function toggleField(fieldId: string) {
    setSelectedFields((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  }

  function handleRecipientAdded(email: string) {
    setSelectedMembers((prev) => (prev.includes(email) ? prev : [...prev, email]));
    setError("");
  }

  async function handleSend() {
    setError("");
    if (!teamAllowed) {
      setError("Team sharing is a Pro feature. Upgrade to request signatures from team members.");
      return;
    }
    if (selectedMembers.length === 0) {
      setError("Select at least one recipient, or add one below.");
      return;
    }
    if (selectedFields.length === 0) {
      setError(
        blockedReason === "none-on-template"
          ? "This document has no recipient signature fields to request."
          : "All recipient signature fields are already signed.",
      );
      return;
    }

    const fromName = session?.name ?? profile.account.displayName ?? "DocSolid User";
    const fromEmail = session?.email ?? profile.account.email ?? "";

    for (const email of selectedMembers) {
      const member = members.find((m) => m.email === email);
      await saveShareWithDocument({
        documentTitle,
        documentId,
        documentTemplateId: resolvedTemplateId,
        fromName,
        fromEmail,
        toEmail: email,
        toName: member?.name ?? email,
        message: message.trim() || "Signature requested",
        shareType: "signature_request",
        signatureFieldIds: selectedFields,
      }, { senderProfile: documentProfile });
    }

    await recordDocumentShareAudit(documentId, selectedMembers, fromEmail, fromName, "signature");

    notify({
      type: "share",
      title: "Signature requested",
      message: `Sent "${documentTitle}" to ${selectedMembers.length} team member(s) for signature`,
    });

    setSent(true);
    setTimeout(onClose, 1400);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Request Signature</h2>
        <p className="field-help">
          Send &quot;{documentTitle}&quot; to a team member&apos;s inbox with specific signature fields
          they need to complete.
        </p>

        {!teamAllowed && (
          <div className="email-doc-notice">
            Pro required for team signature requests.{" "}
            <Link href="/profile?tab=billing">Upgrade</Link>
          </div>
        )}

        {!fieldsLoading && blockedReason && (
          <SignatureRequestBlockedNotice
            reason={blockedReason}
            documentTemplateId={resolvedTemplateId}
            documentLocalId={documentId}
          />
        )}

        {canRequestSignatures && (
          <>
            <p className="field-help" style={{ marginBottom: "0.5rem", fontWeight: 500, color: "var(--text)" }}>
              Signature fields to request
            </p>
            <ul className="team-share-list" style={{ marginTop: 0 }}>
              {availableFields.map((f) => (
                <li key={f.id}>
                  <SignatureFieldPickerRow
                    label={f.label}
                    checked={selectedFields.includes(f.id)}
                    onToggle={() => toggleField(f.id)}
                  />
                </li>
              ))}
            </ul>
          </>
        )}

        {canRequestSignatures && (
          <>
        {members.length === 0 ? (
          <p className="field-help">No recipients yet — add a contact or team member below.</p>
        ) : (
          <>
            <p className="field-help" style={{ marginBottom: "0.5rem" }}>
              Select who should sign ({members.length} available).
            </p>
            <ul className="team-share-list">
              {members.map((m) => (
                <li key={m.id}>
                  <TeamMemberPickerRow
                    recipient={m}
                    checked={selectedMembers.includes(m.email)}
                    onToggle={() => toggleMember(m.email)}
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
          compact={members.length > 0}
        />

        <div className="field-group">
          <label>Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add instructions for the signer..."
            rows={3}
            disabled={!teamAllowed}
          />
        </div>
          </>
        )}

        {error && <p className="field-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {canRequestSignatures ? "Cancel" : "Close"}
          </button>
          {canRequestSignatures && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={selectedMembers.length === 0 || selectedFields.length === 0 || sent}
            onClick={() => void handleSend()}
          >
            {sent ? "Sent ✓" : `Request Signature (${selectedMembers.length || 0})`}
          </button>
          )}
        </div>
      </div>
    </div>
  );
}
