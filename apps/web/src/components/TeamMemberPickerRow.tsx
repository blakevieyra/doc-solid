"use client";

import type { EmailRecipient } from "@/lib/team/recipients";
import type { UserProfile } from "@/lib/profile/types";
import { resolveMemberAvatarUrl } from "@/lib/team/member-avatar";

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
  profile,
  selfEmail,
}: {
  recipient: RecipientPick;
  profile?: UserProfile;
  selfEmail?: string;
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

  const avatarUrl =
    profile != null
      ? resolveMemberAvatarUrl(profile, recipient.email, recipient.avatarUrl, selfEmail)
      : recipient.avatarUrl ?? null;

  const selfKey = selfEmail?.trim().toLowerCase();
  const isSelf = selfKey && recipient.email.trim().toLowerCase() === selfKey;
  const displayName =
    isSelf && profile
      ? profile.personal.fullName || profile.account.displayName || recipient.name
      : recipient.name;

  return (
    <div className="team-member-picker-body">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="team-member-avatar" />
      ) : (
        <span className="team-member-avatar team-member-avatar-fallback" aria-hidden>
          {memberInitials(recipient.name)}
        </span>
      )}
      <div className="team-member-picker-text">
        <strong>{displayName}</strong>
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
  profile,
  selfEmail,
}: {
  recipient: RecipientPick;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
  profile?: UserProfile;
  selfEmail?: string;
}) {
  return (
    <label className="security-toggle team-member-picker-row">
      <input type="checkbox" checked={checked} onChange={onToggle} disabled={disabled} />
      <TeamMemberIdentity recipient={recipient} profile={profile} selfEmail={selfEmail} />
    </label>
  );
}
