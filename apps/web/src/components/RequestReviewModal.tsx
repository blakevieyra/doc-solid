"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useProfile } from "./ProfileProvider";
import { useAuth } from "./AuthProvider";
import { useNotifications } from "./NotificationProvider";
import { saveShareWithDocument } from "@/lib/team/share-document";
import { recordDocumentShareAudit } from "@/lib/documents/share-audit";
import { TeamMemberPickerRow } from "@/components/TeamMemberPickerRow";
import { getEmailRecipients } from "@/lib/team/recipients";
import { canUseFeature } from "@/lib/subscription/plans";

export interface RequestReviewModalProps {
  documentTitle: string;
  documentId: string;
  onClose: () => void;
}

export function RequestReviewModal({
  documentTitle,
  documentId,
  onClose,
}: RequestReviewModalProps) {
  const { profile } = useProfile();
  const { session } = useAuth();
  const { notify } = useNotifications();
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("Please review this document and share any feedback.");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const selfEmail = (session?.email ?? profile.account.email ?? "").toLowerCase();
  const teamAllowed = canUseFeature(profile.subscription, "teamSharing");

  const recipients = useMemo(
    () => getEmailRecipients(profile, selfEmail),
    [profile, selfEmail]
  );

  function toggle(email: string) {
    setSelected((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  }

  function handleSend() {
    setError("");
    if (!teamAllowed) {
      setError("Team sharing is a Pro feature. Upgrade to request reviews from others.");
      return;
    }
    if (selected.length === 0) {
      setError("Select at least one reviewer.");
      return;
    }

    const fromName = session?.name ?? profile.account.displayName ?? "DocSolid User";
    const fromEmail = session?.email ?? profile.account.email ?? "";

    void (async () => {
      for (const email of selected) {
        const recipient = recipients.find((r) => r.email === email);
        await saveShareWithDocument({
          documentTitle,
          documentId,
          fromName,
          fromEmail,
          toEmail: email,
          toName: recipient?.name ?? email,
          message: message.trim() || "Review requested",
          shareType: "review_request",
        });
      }
      await recordDocumentShareAudit(documentId, selected, fromEmail, fromName, "share");

      notify({
        type: "share",
        title: "Review requested",
        message: `Sent "${documentTitle}" to ${selected.length} reviewer(s)`,
      });

      setSent(true);
      setTimeout(onClose, 1400);
    })();
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Request Review</h2>
        <p className="field-help">
          Send &quot;{documentTitle}&quot; to a team member or contact for feedback before you finalize or sign.
        </p>

        {!teamAllowed && (
          <div className="email-doc-notice">
            Pro required for review requests.{" "}
            <Link href="/profile?tab=billing">Upgrade</Link>
          </div>
        )}

        {recipients.length === 0 ? (
          <p className="field-help">
            Add team members on <Link href="/team">Team</Link> or contacts in{" "}
            <Link href="/profile?tab=library">Profile → Library</Link>.
          </p>
        ) : (
          <>
            <ul className="team-share-list">
              {recipients.map((r) => (
                <li key={r.id}>
                  <TeamMemberPickerRow
                    recipient={r}
                    checked={selected.includes(r.email)}
                    disabled={!teamAllowed}
                    onToggle={() => toggle(r.email)}
                  />
                </li>
              ))}
            </ul>
            <div className="field-group">
              <label>Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What should they focus on?"
                rows={3}
                disabled={!teamAllowed}
              />
            </div>
            {error && <p className="field-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={selected.length === 0 || sent || !teamAllowed}
                onClick={handleSend}
              >
                {sent ? "Sent ✓" : `Request Review (${selected.length || 0})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
