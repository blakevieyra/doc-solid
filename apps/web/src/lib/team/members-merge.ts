import type { TeamMember } from "@/lib/profile/types";

/** Merge team members by email — keeps pending invites and the richest name/role data. */
export function mergeTeamMembersByEmail(...lists: TeamMember[][]): TeamMember[] {
  const byEmail = new Map<string, TeamMember>();

  for (const list of lists) {
    for (const m of list) {
      const key = m.email.trim().toLowerCase();
      if (!key) continue;
      const prev = byEmail.get(key);
      if (!prev) {
        byEmail.set(key, { ...m, email: m.email.trim().toLowerCase() });
        continue;
      }

      const pending = prev.status === "pending" || m.status === "pending";
      byEmail.set(key, {
        ...prev,
        ...m,
        id: prev.id || m.id,
        email: key,
        name: m.name || prev.name,
        role: prev.role === "owner" || m.role === "owner" ? "owner" : m.role || prev.role,
        username: m.username ?? prev.username,
        avatarUrl: m.avatarUrl ?? prev.avatarUrl,
        invitedAt: prev.invitedAt && prev.invitedAt <= m.invitedAt ? prev.invitedAt : m.invitedAt,
        acceptedAt: pending ? undefined : m.acceptedAt ?? prev.acceptedAt,
        status: pending ? "pending" : m.acceptedAt || prev.acceptedAt ? "active" : m.status ?? prev.status ?? "active",
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
