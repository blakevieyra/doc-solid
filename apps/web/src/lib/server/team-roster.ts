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
}

export function mapDbRole(role: string): TeamRole {
  const normalized = role.toLowerCase();
  if (normalized === "owner" || normalized === "admin" || normalized === "editor" || normalized === "viewer") {
    return normalized;
  }
  return "editor";
}
