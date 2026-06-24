import type { UserProfile } from "@/lib/profile/types";
import { resolveMemberAvatarUrl } from "./member-avatar";

export type RecipientSource = "team" | "contact";

export interface EmailRecipient {
  id: string;
  email: string;
  name: string;
  username?: string;
  avatarUrl?: string | null;
  source: RecipientSource;
  role?: string;
}

/** Team members + document contacts, deduped, excluding the signed-in user. */
export function getEmailRecipients(profile: UserProfile, selfEmail: string): EmailRecipient[] {
  const self = selfEmail.trim().toLowerCase();
  const map = new Map<string, EmailRecipient>();

  for (const m of profile.team.members) {
    const key = m.email.trim().toLowerCase();
    if (!key || key === self) continue;
    map.set(key, {
      id: m.id,
      email: m.email,
      name: m.name,
      username: m.username,
      avatarUrl: resolveMemberAvatarUrl(profile, m.email, m.avatarUrl, selfEmail),
      source: "team",
      role: m.role,
    });
  }

  for (const c of profile.library?.contacts ?? []) {
    const key = c.email.trim().toLowerCase();
    if (!key || key === self) continue;
    if (!map.has(key)) {
      map.set(key, {
        id: c.id,
        email: c.email,
        name: c.name,
        username: c.username,
        avatarUrl: resolveMemberAvatarUrl(profile, c.email, c.avatarUrl, selfEmail),
        source: "contact",
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}
