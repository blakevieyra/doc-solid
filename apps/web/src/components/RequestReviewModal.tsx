"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useProfile } from "./ProfileProvider";
import { useAuth } from "./AuthProvider";
import { useNotifications } from "./NotificationProvider";
import { saveShare } from "@/lib/team/invites";
import { canUseFeature } from "@/lib/subscription/plans";

export interface RequestReviewModalProps {
  documentTitle: string;
  documentId: string;
  onClose: () => void;
}

type Recipient = { email: string; name: string; source: "team" | "contact" };

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

  const recipients = useMemo(() => {
    const map = new Map<string, Recipient>();
    for (const m of profile.team.members) {
      if (m.email.toLowerCase() === selfEmail) continue;
      map.set(m.email.toLowerCase(), { email: m.email, name: m.name, source: "team" });
    }
    for (const c of profile.library?.contacts ?? []) {
      if (c.email.toLowerCase() === selfEmail) continue;
      if (!map.has(c.email.toLowerCase())) {
        map.set(c.email.toLowerCase(), { email: c.email, name: c.name, source: "contact" });
      }
    }
    return Array.from(map.values());
  }, [profile.team.members, profile.library?.contacts, selfEmail]);

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

    for (const email of selected) {
      const recipient = recipients.find((r) => r.email === email);
      saveShare({
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

    notify({
      type: "share",
      title: "Review requested",
      message: `Sent "${documentTitle}" to ${selected.length} reviewer(s)`,
    });

    setSent(true);
    setTimeout(onClose, 1400);
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
                <li key={r.email}>
                  <label className="security-toggle">
                    <input
                      type="checkbox"
                      checked={selected.includes(r.email)}
                      onChange={() => toggle(r.email)}
                      disabled={!teamAllowed}
                    />
                    <div>
                      <strong>{r.name}</strong>
                      <span>
                        {r.email} · {r.source === "team" ? "Team" : "Contact"}
                      </span>
                    </div>
                  </label>
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
