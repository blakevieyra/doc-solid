import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/session";import { enforceRateLimit } from "@/lib/server/rate-limit";
import {
  getTeamMemberInvite,
  updateTeamMemberInvite,
} from "@/lib/server/team-member-invites";
import { syncOwnerProfileFromRoster } from "@/lib/server/team-profile-sync";
import { getTeamRoster, saveTeamRoster, resolveTeamRoster, type TeamRoster } from "@/lib/server/team-roster";
import { loadPublicIdentityForEmail } from "@/lib/server/public-identity";
import { getUserProfile, saveUserProfile } from "@/lib/server/users";
import { pushServerNotification } from "@/lib/server/share-notifications";
import type { TeamMember, TeamMembership, TeamRole, UserProfile } from "@/lib/profile/types";

export const runtime = "nodejs";

function memberKey(email: string): string {
  return `tm_${email.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
}

function applyMembership(profile: UserProfile, roster: TeamRoster, myRole: TeamRole): UserProfile {
  const membership: TeamMembership = {
    teamId: roster.teamId,
    orgName: roster.orgName,
    ownerEmail: roster.ownerEmail,
    ownerName: roster.ownerName,
    myRole,
    joinedAt: new Date().toISOString(),
  };

  const memberships = profile.team.memberships ?? [];
  const without = memberships.filter((m) => m.teamId !== roster.teamId);
  const ownerKey = roster.ownerEmail.toLowerCase();
  const rosterMembers: TeamMember[] = roster.members.map((m) => {
    const key = m.email.toLowerCase();
    const role: TeamRole = key === ownerKey ? "owner" : m.role === "owner" ? "editor" : m.role;
    return {
      id: memberKey(m.email),
      email: m.email,
      name: m.name,
      role,
      shareProfile: true,
      invitedAt: m.joinedAt,
      acceptedAt: m.joinedAt,
      status: "active",
    };
  });

  return {
    ...profile,
    team: {
      ...profile.team,
      enabled: true,
      teamId: roster.teamId,
      orgName: roster.orgName,
      ownerEmail: roster.ownerEmail,
      ownerName: roster.ownerName,
      myRole,
      members: rosterMembers,
      shareBusinessProfile: roster.shareBusinessProfile,
      shareOrganizationProfile: roster.shareOrganizationProfile,
      memberships: [membership, ...without],
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const rl = await enforceRateLimit(req, "team-member-respond", 30, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = (await req.json()) as { inviteId?: string; action?: "accept" | "decline" };
    const inviteId = body.inviteId?.trim();
    const action = body.action;

    if (!inviteId || (action !== "accept" && action !== "decline")) {
      return NextResponse.json({ error: "inviteId and action (accept|decline) are required" }, { status: 400 });
    }

    const invite = await getTeamMemberInvite(inviteId);
    if (!invite || invite.status !== "pending") {
      return NextResponse.json({ error: "Invite not found or already handled" }, { status: 404 });
    }

    const email = auth.user.email.trim().toLowerCase();
    if (invite.inviteeEmail !== email) {
      return NextResponse.json({ error: "This invite is for a different account" }, { status: 403 });
    }

    if (new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Invite has expired" }, { status: 410 });
    }

    if (action === "decline") {
      invite.status = "declined";
      await updateTeamMemberInvite(invite);
      await pushServerNotification(invite.inviterEmail, {
        id: `team_decline_${invite.id}`,
        type: "team",
        title: "Team invite declined",
        message: `${auth.user.name || email} declined your invitation to ${invite.orgName}`,
        link: "/team",
        createdAt: new Date().toISOString(),
      });
      return NextResponse.json({ ok: true, status: "declined" });
    }

    const now = new Date().toISOString();
    let roster = await resolveTeamRoster(await getUserProfile(auth.user.id), invite.inviterEmail);
    if (!roster) roster = await getTeamRoster(invite.teamId);
    if (!roster) {
      roster = {
        teamId: invite.teamId,
        orgName: invite.orgName,
        ownerEmail: invite.inviterEmail,
        ownerName: invite.inviterName,
        shareBusinessProfile: true,
        shareOrganizationProfile: true,
        createdAt: invite.createdAt,
        members: [
          {
            email: invite.inviterEmail,
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
        role: invite.role,
        joinedAt: now,
        userId: auth.user.id,
      },
    ];
    roster.updatedAt = now;
    await saveTeamRoster(roster);

    invite.status = "accepted";
    await updateTeamMemberInvite(invite);

    await syncOwnerProfileFromRoster(roster);

    const joinerProfile = await getUserProfile(auth.user.id);
    if (joinerProfile) {
      const joinerIdentity = await loadPublicIdentityForEmail(email).catch(() => null);
      const enrichedRoster: TeamRoster = {
        ...roster,
        members: roster.members.map((m) =>
          m.email.toLowerCase() === email
            ? { ...m, name: auth.user.name || m.name, userId: auth.user.id }
            : m
        ),
      };
      const nextProfile = applyMembership(joinerProfile, enrichedRoster, invite.role);
      if (joinerIdentity) {
        const selfKey = email;
        nextProfile.team.members = nextProfile.team.members.map((m) =>
          m.email.toLowerCase() === selfKey
            ? {
                ...m,
                username: joinerIdentity.username,
                avatarUrl: joinerIdentity.avatarUrl ?? m.avatarUrl,
              }
            : m
        );
      }
      await saveUserProfile(auth.user.id, nextProfile);
    }

    await pushServerNotification(invite.inviterEmail, {
      id: `team_accept_${invite.id}`,
      type: "team",
      title: "Team invite accepted",
      message: `${auth.user.name || email} joined ${invite.orgName}`,
      link: "/team",
      createdAt: now,
    });

    return NextResponse.json({
      ok: true,
      status: "accepted",
      team: {
        teamId: roster.teamId,
        orgName: roster.orgName,
        myRole: invite.role,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to respond to invite" }, { status: 500 });
  }
}
