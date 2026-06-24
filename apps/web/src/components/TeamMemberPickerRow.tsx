"use client";

import type { EmailRecipient } from "@/lib/team/recipients";

function memberInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

type RecipientPick = Pick<
  EmailRecipient,
  "name" | "email" | "username" | "avatarUrl" | "source" | "role"
>;

export function TeamMemberIdentity({
  recipient,
  badge,
}: {
  recipient: RecipientPick;
  badge?: React.ReactNode;
}) {
  const handle = recipient.username?.trim();
  const subtitle = [
    handle ? `@${handle.replace(/^@/, "")}` : null,
    recipient.email,
    recipient.source === "team" && recipient.role
      ? recipient.role
      : recipient.source === "contact"
        ? "Contact"
        : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="team-member-picker-body">
      {recipient.avatarUrl ? (
        <img src={recipient.avatarUrl} alt="" className="team-member-avatar" />
      ) : (
        <span className="team-member-avatar team-member-avatar-fallback" aria-hidden>
          {memberInitials(recipient.name)}
        </span>
      )}
      <div>
        <strong>
          {recipient.name}
          {badge}
        </strong>
        <span>{subtitle}</span>
      </div>
    </div>
  );
}

export function TeamMemberPickerRow({
  recipient,
  checked,
  disabled,
  onToggle,
}: {
  recipient: RecipientPick;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="security-toggle team-member-picker-row">
      <input type="checkbox" checked={checked} onChange={onToggle} disabled={disabled} />
      <TeamMemberIdentity recipient={recipient} />
    </label>
  );
}
