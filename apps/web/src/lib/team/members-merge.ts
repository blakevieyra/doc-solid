import type { TeamMember } from "@/lib/profile/types";
import { mergeMemberRole, mergeMemberStatus } from "./member-merge-utils";

/** Merge team members by email — active beats pending; only ownerEmail gets owner role. */
export function mergeTeamMembersByEmail(
  ownerEmail: string | null | undefined,
  ...lists: TeamMember[][]
): TeamMember[] {
  const byEmail = new Map<string, TeamMember>();

  for (const list of lists) {
    for (const m of list) {
      const key = m.email.trim().toLowerCase();
      if (!key) continue;
      const prev = byEmail.get(key);
      if (!prev) {
        byEmail.set(key, {
          ...m,
          email: key,
          role: mergeMemberRole(key, ownerEmail, m.role),
          status: mergeMemberStatus(m.status, undefined, m.acceptedAt),
        });
        continue;
      }

      const acceptedAt = m.acceptedAt ?? prev.acceptedAt;
      byEmail.set(key, {
        ...prev,
        ...m,
        id: prev.id || m.id,
        email: key,
        name: m.name || prev.name,
        role: mergeMemberRole(key, ownerEmail, m.role, prev.role),
        username: m.username ?? prev.username,
        avatarUrl: m.avatarUrl ?? prev.avatarUrl,
        invitedAt: prev.invitedAt && prev.invitedAt <= m.invitedAt ? prev.invitedAt : m.invitedAt,
        acceptedAt,
        status: mergeMemberStatus(m.status, prev.status, acceptedAt),
      });
    }
  }

  return [...byEmail.values()].sort((a, b) => {
    if (a.role === "owner") return -1;
    if (b.role === "owner") return 1;
    const aTime = a.acceptedAt ?? a.invitedAt;
    const bTime = b.acceptedAt ?? b.invitedAt;
    return aTime.localeCompare(bTime);
  });
}
