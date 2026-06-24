import { NextRequest, NextResponse } from "next/server";
import { kvGet } from "@/lib/server/kv";
import { prisma } from "@doc-solid/database";
import { requireAuth } from "@/lib/server/session";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getUserProfile, saveUserProfile } from "@/lib/server/users";
import type { TeamInviteRecord } from "@/app/api/team/invites/route";
import {
  getTeamRoster,
  saveTeamRoster,
  mapDbRole,
  type TeamRoster,
} from "@/lib/server/team-roster";
import type { TeamRole, UserProfile, TeamMember } from "@/lib/profile/types";

export const runtime = "nodejs";

function inviteKey(code: string) {
  return `invite:${code.trim().toUpperCase()}`;
}

function memberId(email: string): string {
  return `tm_${email.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
}

function toTeamView(roster: TeamRoster, selfEmail: string) {
  const myMember = roster.members.find((m) => m.email.toLowerCase() === selfEmail.toLowerCase());
  const isOwner = roster.ownerEmail.toLowerCase() === selfEmail.toLowerCase();

  return {
    source: "roster" as const,
    teamId: roster.teamId,
    orgName: roster.orgName,
    ownerEmail: roster.ownerEmail,
    ownerName: roster.ownerName,
    myRole: (myMember?.role ?? "editor") as TeamRole,
    isOwner,
    shareBusinessProfile: roster.shareBusinessProfile,
    shareOrganizationProfile: roster.shareOrganizationProfile,
    createdAt: roster.createdAt ?? null,
    members: roster.members.map((m) => ({
      id: memberId(m.email),
      email: m.email,
      name: m.name,
      role: m.role,
      joinedAt: m.joinedAt,
      isYou: m.email.toLowerCase() === selfEmail.toLowerCase(),
    })),
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const rl = await enforceRateLimit(req, "team-join", 30, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many join attempts" }, { status: 429 });
  }

  const body = (await req.json()) as { code?: string };
  const code = body.code?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
  }

  const raw = await kvGet(inviteKey(code));
  if (!raw) {
    return NextResponse.json({ error: "Invalid or expired invite code" }, { status: 404 });
  }

  let invite: TeamInviteRecord;
  try {
    invite = JSON.parse(raw) as TeamInviteRecord;
  } catch {
    return NextResponse.json({ error: "Invalid invite record" }, { status: 500 });
  }

  if (new Date(invite.expiresAt) < new Date()) {
    return NextResponse.json({ error: "Invite code has expired" }, { status: 410 });
  }

  const teamId = invite.teamId?.trim();
  if (!teamId) {
    return NextResponse.json({ error: "Invite is missing team information" }, { status: 400 });
  }

  const email = auth.user.email.toLowerCase();
  const role = mapDbRole(invite.role) as TeamRole;
  const now = new Date().toISOString();

  let roster = await getTeamRoster(teamId);
  if (!roster) {
    roster = {
      teamId,
      orgName: invite.orgName,
      ownerEmail: invite.inviterEmail.toLowerCase(),
      ownerName: invite.inviterName,
      shareBusinessProfile: true,
      shareOrganizationProfile: true,
      createdAt: invite.createdAt,
      members: [
        {
          email: invite.inviterEmail.toLowerCase(),
          name: invite.inviterName,
          role: "owner",
          joinedAt: invite.createdAt,
        },
      ],
      updatedAt: now,
    };
  }

  const withoutSelf = roster.members.filter((m) => m.email.toLowerCase() !== email);
  roster.members = [
    ...withoutSelf,
    {
      email,
      name: auth.user.name,
      role: email === roster.ownerEmail ? "owner" : role,
      joinedAt: now,
      userId: auth.user.id,
    },
  ];
  roster.orgName = invite.orgName;
  roster.updatedAt = now;

  await saveTeamRoster(roster);

  await syncOwnerProfile(invite, roster, {
    email,
    name: auth.user.name,
    role: email === roster.ownerEmail ? "owner" : role,
    joinedAt: now,
  });

  return NextResponse.json({ team: toTeamView(roster, email) });
}

function memberKey(email: string): string {
  return `tm_${email.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
}

async function syncOwnerProfile(
  invite: TeamInviteRecord,
  roster: TeamRoster,
  joiner: { email: string; name: string; role: TeamRole; joinedAt: string }
): Promise<void> {
  const owner = await prisma.user.findUnique({
    where: { email: invite.inviterEmail.toLowerCase() },
  });
  if (!owner) return;

  const profile = await getUserProfile(owner.id);
  if (!profile) return;

  const withoutJoiner = profile.team.members.filter(
    (m) => m.email.toLowerCase() !== joiner.email.toLowerCase()
  );
  const joinerMember: TeamMember = {
    id: memberKey(joiner.email),
    email: joiner.email,
    name: joiner.name,
    role: joiner.role,
    shareProfile: true,
    invitedAt: joiner.joinedAt,
    acceptedAt: joiner.joinedAt,
  };

  const rosterMembers: TeamMember[] = roster.members.map((m) => ({
    id: memberKey(m.email),
    email: m.email,
    name: m.name,
    role: m.role,
    shareProfile: true,
    invitedAt: m.joinedAt,
    acceptedAt: m.joinedAt,
  }));

  const byEmail = new Map<string, TeamMember>();
  for (const m of [...withoutJoiner, joinerMember, ...rosterMembers]) {
    byEmail.set(m.email.toLowerCase(), m);
  }

  const next: UserProfile = {
    ...profile,
    team: {
      ...profile.team,
      enabled: true,
      teamId: roster.teamId,
      orgName: roster.orgName,
      ownerEmail: roster.ownerEmail,
      ownerName: roster.ownerName,
      myRole: "owner",
      members: [...byEmail.values()],
    },
    updatedAt: new Date().toISOString(),
  };

  await saveUserProfile(owner.id, next);
}
