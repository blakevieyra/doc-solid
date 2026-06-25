"use client";

import Link from "next/link";
import { useState } from "react";
import { useProfile } from "./ProfileProvider";
import { useAuth } from "./AuthProvider";
import { useNotifications } from "./NotificationProvider";
import { saveShareWithDocument } from "@/lib/team/share-document";

interface TeamShareModalProps {
  documentTitle: string;
  documentId: string;
  onClose: () => void;
}

export function TeamShareModal({ documentTitle, documentId, onClose }: TeamShareModalProps) {
  const { profile, documentProfile } = useProfile();
  const { session } = useAuth();
  const { notify } = useNotifications();
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const members = profile.team.members;

  function toggle(email: string) {
    setSelected((prev) => prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]);
  }

  async function handleSend() {
    const fromName = session?.name ?? profile.account.displayName;
    const fromEmail = session?.email ?? profile.account.email;

    for (const email of selected) {
      const member = members.find((m) => m.email === email);
      await saveShareWithDocument({
        documentTitle,
        documentId,
        fromName,
        fromEmail,
        toEmail: email,
        toName: member?.name ?? email,
        message,
        shareType: "share",
      }, { senderProfile: documentProfile });
      notify({
        type: "share",
        title: "Document shared",
        message: `Sent "${documentTitle}" to ${member?.name ?? email}`,
      });
    }
    setSent(true);
    setTimeout(onClose, 1200);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Send to Team</h2>
        <p className="field-help">Share &quot;{documentTitle}&quot; with team members</p>

        {members.length === 0 ? (
          <p className="field-help">No team members yet. <Link href="/team">Invite members on Team</Link> first.</p>
        ) : (
          <>
            <ul className="team-share-list">
              {members.map((m) => (
                <li key={m.id}>
                  <label className="security-toggle">
                    <input type="checkbox" checked={selected.includes(m.email)} onChange={() => toggle(m.email)} />
                    <div>
                      <strong>{m.name}</strong>
                      <span>{m.email} · {m.role}</span>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
            <div className="field-group">
              <label>Message (optional)</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Add a note..." rows={3} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={selected.length === 0 || sent} onClick={handleSend}>
                {sent ? "Sent ✓" : `Send to ${selected.length} member${selected.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
