import { prisma } from "@doc-solid/database";
import { getUserProfile, saveUserProfile } from "@/lib/server/users";
import { loadPublicIdentityForEmail } from "@/lib/server/public-identity";
import type { TeamRoster } from "@/lib/server/team-roster";
import type { TeamMember, TeamRole } from "@/lib/profile/types";

function memberKey(email: string): string {
  return `tm_${email.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
}

/** Rewrite the team owner's saved profile from the authoritative roster. */
export async function syncOwnerProfileFromRoster(roster: TeamRoster): Promise<void> {
  const owner = await prisma.user.findUnique({ where: { email: roster.ownerEmail.toLowerCase() } });
  if (!owner) return;
  const profile = await getUserProfile(owner.id);
  if (!profile) return;

  const ownerKey = roster.ownerEmail.toLowerCase();
  const members: TeamMember[] = await Promise.all(
    roster.members.map(async (m) => {
      const key = m.email.toLowerCase();
      const identity = await loadPublicIdentityForEmail(m.email).catch(() => null);
      const role: TeamRole = key === ownerKey ? "owner" : m.role === "owner" ? "editor" : m.role;
      return {
        id: memberKey(m.email),
        email: m.email,
        name: m.name || identity?.name || m.email,
        username: identity?.username,
        avatarUrl: identity?.avatarUrl ?? null,
        role,
        shareProfile: true,
        invitedAt: m.joinedAt,
        acceptedAt: m.joinedAt,
        status: "active" as const,
      };
    })
  );

  await saveUserProfile(owner.id, {
    ...profile,
    team: {
      ...profile.team,
      enabled: true,
      teamId: roster.teamId,
      orgName: roster.orgName,
      ownerEmail: roster.ownerEmail,
      ownerName: roster.ownerName,
      myRole: "owner",
      members,
    },
    updatedAt: new Date().toISOString(),
  });
}

export function ownerProfileNeedsRosterHeal(
  roster: TeamRoster,
  members: TeamMember[]
): boolean {
  const rosterEmails = new Set(roster.members.map((m) => m.email.toLowerCase()));
  const ownerKey = roster.ownerEmail.toLowerCase();
  return members.some((m) => {
    const key = m.email.toLowerCase();
    if (m.status === "pending" && rosterEmails.has(key)) return true;
    if (m.role === "owner" && key !== ownerKey) return true;
    return false;
  });
}
