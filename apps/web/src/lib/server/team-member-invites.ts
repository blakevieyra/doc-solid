import { kvGet, kvSet } from "./kv";
import { pushServerNotification } from "./share-notifications";
import type { TeamRole } from "@/lib/profile/types";

export interface PendingTeamMemberInvite {
  id: string;
  teamId: string;
  orgName: string;
  inviterName: string;
  inviterEmail: string;
  inviteeEmail: string;
  inviteeName: string;
  role: TeamRole;
  code: string;
  createdAt: string;
  expiresAt: string;
  status: "pending" | "accepted" | "declined";
}

const INVITE_TTL_SEC = 60 * 60 * 24 * 14;

function inviteKey(id: string) {
  return `team-member-invite:${id}`;
}

function userInvitesKey(email: string) {
  return `user-team-invites:${email.trim().toLowerCase()}`;
}

function teamPendingKey(teamId: string) {
  return `team-pending-invites:${teamId.trim()}`;
}

async function readIdList(key: string): Promise<string[]> {
  const raw = await kvGet(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

async function writeIdList(key: string, ids: string[]): Promise<void> {
  await kvSet(key, JSON.stringify(ids.slice(0, 100)), INVITE_TTL_SEC);
}

function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const part = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 8).toUpperCase();
  return `DS-${part.slice(0, 4)}-${part.slice(4, 8)}`;
}

export async function createTeamMemberInvite(input: {
  teamId: string;
  orgName: string;
  inviterName: string;
  inviterEmail: string;
  inviteeEmail: string;
  inviteeName: string;
  role: TeamRole;
}): Promise<PendingTeamMemberInvite> {
  const inviteeEmail = input.inviteeEmail.trim().toLowerCase();
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);

  const invite: PendingTeamMemberInvite = {
    id: `tmi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    teamId: input.teamId.trim(),
    orgName: input.orgName.trim(),
    inviterName: input.inviterName.trim(),
    inviterEmail: input.inviterEmail.trim().toLowerCase(),
    inviteeEmail,
    inviteeName: input.inviteeName.trim(),
    role: input.role,
    code: generateInviteCode(),
    createdAt: new Date().toISOString(),
    expiresAt: expires.toISOString(),
    status: "pending",
  };

  await kvSet(inviteKey(invite.id), JSON.stringify(invite), INVITE_TTL_SEC);

  const userIds = await readIdList(userInvitesKey(inviteeEmail));
  await writeIdList(userInvitesKey(inviteeEmail), [invite.id, ...userIds.filter((id) => id !== invite.id)]);

  const teamIds = await readIdList(teamPendingKey(invite.teamId));
  await writeIdList(teamPendingKey(invite.teamId), [invite.id, ...teamIds.filter((id) => id !== invite.id)]);

  await pushServerNotification(inviteeEmail, {
    id: `team_invite_${invite.id}`,
    type: "team",
    title: "Team invitation",
    message: `${invite.inviterName} invited you to join ${invite.orgName}`,
    link: `/team?invite=${invite.id}`,
    createdAt: invite.createdAt,
  });

  return invite;
}

export async function getTeamMemberInvite(id: string): Promise<PendingTeamMemberInvite | null> {
  const raw = await kvGet(inviteKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingTeamMemberInvite;
  } catch {
    return null;
  }
}

export async function getPendingInvitesForUser(email: string): Promise<PendingTeamMemberInvite[]> {
  const ids = await readIdList(userInvitesKey(email));
  const invites: PendingTeamMemberInvite[] = [];
  for (const id of ids) {
    const invite = await getTeamMemberInvite(id);
    if (!invite || invite.status !== "pending") continue;
    if (new Date(invite.expiresAt) < new Date()) continue;
    invites.push(invite);
  }
  return invites.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateTeamMemberInvite(invite: PendingTeamMemberInvite): Promise<void> {
  await kvSet(inviteKey(invite.id), JSON.stringify(invite), INVITE_TTL_SEC);
}
