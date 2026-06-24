"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useProfile } from "@/components/ProfileProvider";
import { useAuth } from "@/components/AuthProvider";
import { getEmailRecipients } from "@/lib/team/recipients";
import { TeamMemberPickerRow } from "@/components/TeamMemberPickerRow";

interface EmailRecipientPickerProps {
  canEmailOthers: boolean;
  selectedEmails: string[];
  onChange: (emails: string[]) => void;
  sendToSelf: boolean;
  onSendToSelfChange: (value: boolean) => void;
  /** Pre-check all recipients when the modal opens */
  autoSelectAll?: boolean;
  children?: React.ReactNode;
}

export function EmailRecipientPicker({
  canEmailOthers,
  selectedEmails,
  onChange,
  sendToSelf,
  onSendToSelfChange,
  autoSelectAll = true,
  children,
}: EmailRecipientPickerProps) {
  const { profile } = useProfile();
  const { session } = useAuth();
  const [didAutoSelect, setDidAutoSelect] = useState(false);

  const senderEmail = session?.email ?? profile.account.email ?? profile.business.email ?? profile.personal.email;
  const senderName = session?.name ?? profile.account.displayName ?? profile.business.name ?? "DocSolid User";

  const recipients = useMemo(
    () => getEmailRecipients(profile, senderEmail ?? ""),
    [profile, senderEmail]
  );

  useEffect(() => {
    if (!autoSelectAll || didAutoSelect || !canEmailOthers || recipients.length === 0) return;
    onChange(recipients.map((r) => r.email));
    setDidAutoSelect(true);
  }, [autoSelectAll, canEmailOthers, didAutoSelect, onChange, recipients]);

  function toggle(email: string) {
    const key = email.toLowerCase();
    onChange(
      selectedEmails.some((e) => e.toLowerCase() === key)
        ? selectedEmails.filter((e) => e.toLowerCase() !== key)
        : [...selectedEmails, email]
    );
  }

  function selectAll() {
    onChange(recipients.map((r) => r.email));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <>
      <div className="email-doc-section">
        <h3 className="email-doc-section-title">Yourself</h3>
        <label className="security-toggle">
          <input
            type="checkbox"
            checked={sendToSelf}
            onChange={(e) => onSendToSelfChange(e.target.checked)}
            disabled={!senderEmail}
          />
          <div>
            <strong>{senderName}</strong>
            <span>{senderEmail || "Add email in Profile → Account"}</span>
          </div>
        </label>
      </div>

      <div className="email-doc-section">
        <div className="email-recipient-toolbar">
          <h3 className="email-doc-section-title">Team & contacts</h3>
          {recipients.length > 0 && canEmailOthers && (
            <div className="email-recipient-toolbar-actions">
              <button type="button" className="btn-link" onClick={selectAll}>
                Select all
              </button>
              <button type="button" className="btn-link" onClick={clearAll}>
                Clear
              </button>
            </div>
          )}
        </div>

        {!canEmailOthers && (
          <p className="field-help">Pro required to email team members and contacts.</p>
        )}

        {recipients.length === 0 ? (
          <p className="field-help">
            No recipients yet.{" "}
            <Link href="/team">Add team members or contacts</Link> on the Team page, then return here to send.
          </p>
        ) : (
          <ul className="team-share-list">
            {recipients.map((r) => (
              <li key={r.id}>
                <TeamMemberPickerRow
                  recipient={r}
                  checked={selectedEmails.some((e) => e.toLowerCase() === r.email.toLowerCase())}
                  disabled={!canEmailOthers}
                  onToggle={() => toggle(r.email)}
                  profile={profile}
                  selfEmail={senderEmail ?? undefined}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {children}
    </>
  );
}

export function useEmailRecipientSelection() {
  const { profile } = useProfile();
  const { session } = useAuth();
  const senderEmail = session?.email ?? profile.account.email ?? profile.business.email ?? profile.personal.email;
  const senderName = session?.name ?? profile.account.displayName ?? profile.business.name ?? "DocSolid User";

  function buildRecipientPayload(selectedEmails: string[], sendToSelf: boolean) {
    const recipients: { email: string; name?: string }[] = [];
    const seen = new Set<string>();
    const all = getEmailRecipients(profile, senderEmail ?? "");

    function add(email: string, name?: string) {
      const key = email.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      recipients.push({ email: key, name });
    }

    if (sendToSelf && senderEmail) add(senderEmail, senderName);
    for (const email of selectedEmails) {
      const match = all.find((r) => r.email.toLowerCase() === email.toLowerCase());
      add(email, match?.name);
    }

    return recipients;
  }

  return { senderEmail, senderName, buildRecipientPayload };
}
