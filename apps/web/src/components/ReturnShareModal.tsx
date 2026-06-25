"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { useProfile } from "./ProfileProvider";
import { useNotifications } from "./NotificationProvider";
import { returnShareCorrection } from "@/lib/team/share-document";
import type { DocumentShare } from "@/lib/team/invites";

export interface ReturnShareModalProps {
  share: DocumentShare;
  onClose: () => void;
  onReturned?: () => void;
}

export function ReturnShareModal({ share, onClose, onReturned }: ReturnShareModalProps) {
  const { session } = useAuth();
  const { profile } = useProfile();
  const { notify } = useNotifications();
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const userEmail = session?.email ?? profile.account.email ?? "";
  const userName = session?.name ?? profile.account.displayName ?? "Recipient";

  async function handleReturn() {
    setError("");
    if (!comment.trim()) {
      setError("Add a comment before sending back to the sender.");
      return;
    }
    const updated = await returnShareCorrection(share.id, comment, { email: userEmail, name: userName });
    if (!updated) {
      setError("Could not return this document. Try again.");
      return;
    }
    notify({
      type: "share",
      title: "Returned to sender",
      message: `"${share.documentTitle}" was returned to ${share.fromName} with your comments.`,
    });
    setSent(true);
    onReturned?.();
    setTimeout(onClose, 1200);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Return with comment</h2>
        <p className="field-help">
          Share remarks or feedback with {share.fromName} about &quot;{share.documentTitle}&quot;.
        </p>
        <div className="field-group">
          <label>Comments</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add your remarks or feedback…"
            rows={4}
            autoFocus
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
            disabled={!comment.trim() || sent}
            onClick={handleReturn}
          >
            {sent ? "Returned ✓" : "Send comment"}
          </button>
        </div>
      </div>
    </div>
  );
}
