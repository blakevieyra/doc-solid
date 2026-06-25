import type { UserProfile } from "@/lib/profile/types";

/** Photo or logo from profile, then stored member/contact avatar. */
export function resolveMemberAvatarUrl(
  profile: UserProfile,
  email: string,
  stored?: string | null,
  selfEmail?: string
): string | null {
  const key = email.trim().toLowerCase();
  const self = (
    selfEmail ??
    profile.account.email ??
    profile.personal.email ??
    profile.business.email ??
    ""
  )
    .trim()
    .toLowerCase();

  if (key === self) {
    return (
      profile.personal.photo ||
      profile.business.logo ||
      profile.organization.logo ||
      stored?.trim() ||
      null
    );
  }

  if (stored?.trim()) return stored.trim();

  const member = profile.team.members.find((m) => m.email.trim().toLowerCase() === key);
  if (member?.avatarUrl) return member.avatarUrl;

  const contact = profile.library?.contacts?.find((c) => c.email.trim().toLowerCase() === key);
  return contact?.avatarUrl ?? null;
}
