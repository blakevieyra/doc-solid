import { kvGet, kvSet } from "./kv";
import type { TeamRole } from "@/lib/profile/types";

export interface TeamRosterMember {
  email: string;
  name: string;
  role: TeamRole;
  joinedAt: string;
  userId?: string;
}

export interface TeamRoster {
  teamId: string;
  orgName: string;
  ownerEmail: string;
  ownerName: string;
  shareBusinessProfile: boolean;
  shareOrganizationProfile: boolean;
  members: TeamRosterMember[];
  /** When the team workspace was first created */
  createdAt?: string;
  updatedAt: string;
}

export function rosterKey(teamId: string): string {
  return `team-roster:${teamId.trim()}`;
}

function rosterOwnerKey(ownerEmail: string): string {
  return `team-roster-owner:${ownerEmail.trim().toLowerCase()}`;
}

export function candidateTeamIds(
  profile: {
    team?: { teamId?: string | null };
    account?: { accountId?: string };
  } | null,
  userId?: string | null
): string[] {
  const ids = new Set<string>();
  const teamId = profile?.team?.teamId?.trim();
  const accountId = profile?.account?.accountId?.trim();
  if (teamId) ids.add(teamId);
  if (accountId) ids.add(accountId);
  if (userId?.trim()) ids.add(userId.trim());
  return [...ids];
}

export async function resolveTeamRoster(
  profile: {
    team?: { teamId?: string | null };
    account?: { accountId?: string };
  } | null,
  ownerEmail?: string | null,
  userId?: string | null
): Promise<TeamRoster | null> {
  for (const id of candidateTeamIds(profile, userId)) {
    const roster = await getTeamRoster(id);
    if (roster) return roster;
  }
  if (ownerEmail) {
    const mappedId = await kvGet(rosterOwnerKey(ownerEmail));
    if (mappedId) {
      const roster = await getTeamRoster(mappedId);
      if (roster) return roster;
    }
  }
  return null;
}

export async function getTeamRoster(teamId: string): Promise<TeamRoster | null> {
  const raw = await kvGet(rosterKey(teamId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TeamRoster;
  } catch {
    return null;
  }
}

function earliestJoinedAt(members: TeamRosterMember[]): string {
  if (members.length === 0) return new Date().toISOString();
  return members.reduce(
    (min, m) => (m.joinedAt < min ? m.joinedAt : min),
    members[0]!.joinedAt
  );
}

export async function saveTeamRoster(roster: TeamRoster): Promise<void> {
  const existing = await getTeamRoster(roster.teamId);
  roster.createdAt =
    roster.createdAt ??
    existing?.createdAt ??
    earliestJoinedAt(roster.members);
  roster.updatedAt = new Date().toISOString();
  await kvSet(rosterKey(roster.teamId), JSON.stringify(roster), 60 * 60 * 24 * 365);
  await kvSet(rosterOwnerKey(roster.ownerEmail), roster.teamId, 60 * 60 * 24 * 365);
}

export function mapDbRole(role: string): TeamRole {
  const normalized = role.toLowerCase();
  if (normalized === "owner" || normalized === "admin" || normalized === "editor" || normalized === "viewer") {
    return normalized;
  }
  return "editor";
}
