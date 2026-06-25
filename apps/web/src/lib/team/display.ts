import type { AppContact, TeamMember, TeamRole, UserProfile } from "@/lib/profile/types";

export function roleLabel(role: TeamRole): string {
  const labels: Record<TeamRole, string> = {
    owner: "Owner",
    admin: "Admin",
    editor: "Editor",
    viewer: "Viewer",
  };
  return labels[role];
}

export interface TeamMemberDisplay {
  id: string;
  email: string;
  name: string;
  username?: string;
  avatarUrl?: string | null;
  role: TeamRole;
  joinedAt: string;
  isYou: boolean;
  status?: "pending" | "active";
}

export function mergeTeamMemberDisplays(
  selfEmail: string,
  ...lists: Array<TeamMemberDisplay[] | undefined>
): TeamMemberDisplay[] {
  const self = selfEmail.toLowerCase();
  const byEmail = new Map<string, TeamMemberDisplay>();

  for (const list of lists) {
    if (!list) continue;
    for (const m of list) {
      const key = m.email.trim().toLowerCase();
      if (!key) continue;
      const prev = byEmail.get(key);
      byEmail.set(key, {
        id: m.id || prev?.id || `tm_${key.replace(/[^a-z0-9]/g, "_")}`,
        email: m.email,
        name: m.name || prev?.name || m.email,
        username: m.username || prev?.username,
        avatarUrl: m.avatarUrl ?? prev?.avatarUrl ?? null,
        role: m.role === "owner" || prev?.role === "owner" ? "owner" : m.role || prev?.role || "editor",
        joinedAt: prev?.joinedAt && prev.joinedAt <= m.joinedAt ? prev.joinedAt : m.joinedAt,
        isYou: key === self,
        status:
          m.status === "pending" || prev?.status === "pending"
            ? "pending"
            : m.status ?? prev?.status ?? "active",
      });
    }
  }

  return [...byEmail.values()].sort((a, b) => {
    if (a.role === "owner") return -1;
    if (b.role === "owner") return 1;
    return a.joinedAt.localeCompare(b.joinedAt);
  });
}

export function profileMembersToDisplay(profile: UserProfile, selfEmail: string): TeamMemberDisplay[] {
  return profile.team.members.map((m) => ({
    id: m.id,
    email: m.email,
    name: m.name,
    username: m.username,
    avatarUrl: m.avatarUrl,
    role: m.role,
    joinedAt: m.acceptedAt ?? m.invitedAt,
    isYou: m.email.toLowerCase() === selfEmail.toLowerCase(),
    status: m.status ?? (m.acceptedAt ? "active" : "pending"),
  }));
}

export function contactsToDisplay(contacts: AppContact[], selfEmail: string): TeamMemberDisplay[] {
  return contacts.map((c) => ({
    id: c.id,
    email: c.email,
    name: c.name,
    username: c.username,
    avatarUrl: c.avatarUrl,
    role: "editor" as TeamRole,
    joinedAt: c.addedAt,
    isYou: c.email.toLowerCase() === selfEmail.toLowerCase(),
  }));
}

export function teamMembersToDisplay(members: TeamMember[], selfEmail: string): TeamMemberDisplay[] {
  return members.map((m) => ({
    id: m.id,
    email: m.email,
    name: m.name,
    username: m.username,
    avatarUrl: m.avatarUrl,
    role: m.role,
    joinedAt: m.acceptedAt ?? m.invitedAt,
    isYou: m.email.toLowerCase() === selfEmail.toLowerCase(),
  }));
}
