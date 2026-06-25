import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/session";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { createTeamMemberInvite } from "@/lib/server/team-member-invites";
import { getTeamRoster, saveTeamRoster, resolveTeamRoster, type TeamRoster } from "@/lib/server/team-roster";
import { getUserProfile, saveUserProfile } from "@/lib/server/users";
import { mergeTeamMembersByEmail } from "@/lib/team/members-merge";
import { notifyTeamMemberInvite } from "@/lib/email/notify";
import { getEmailConfig } from "@/lib/email/config";
import { loadPublicIdentityForEmail } from "@/lib/server/public-identity";
import type { TeamMember, TeamRole } from "@/lib/profile/types";

export const runtime = "nodejs";

function resolveTeamId(
  requested: string | undefined,
  profile: Awaited<ReturnType<typeof getUserProfile>>,
  userId: string
): string {
  return (
    requested?.trim() ||
    profile?.team.teamId?.trim() ||
    profile?.account.accountId?.trim() ||
    userId
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const rl = await enforceRateLimit(req, "team-member-invite", 30, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many invite requests" }, { status: 429 });
  }

  try {
    const body = (await req.json()) as {
      teamId?: string;
      orgName?: string;
      inviteeEmail?: string;
      inviteeName?: string;
      role?: TeamRole;
    };

    const inviteeEmail = body.inviteeEmail?.trim().toLowerCase();
    const orgName = body.orgName?.trim() || "Team";

    if (!inviteeEmail) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const inviterEmail = auth.user.email.trim().toLowerCase();
    if (inviteeEmail === inviterEmail) {
      return NextResponse.json({ error: "You cannot invite yourself" }, { status: 400 });
    }

    const identity = await loadPublicIdentityForEmail(inviteeEmail);
    if (!identity) {
      return NextResponse.json({
        error: "No Doc Solid account found for this email. They must sign up before you can invite them.",
      }, { status: 404 });
    }

    const inviteeName = identity.name;

    const ownerProfile = await getUserProfile(auth.user.id);
    const teamId = resolveTeamId(body.teamId, ownerProfile, auth.user.id);

    const roster = await resolveTeamRoster(ownerProfile, inviterEmail);
    if (roster) {
      const isOwner = roster.ownerEmail.toLowerCase() === inviterEmail;
      const isAdmin = roster.members.some(
        (m) => m.email.toLowerCase() === inviterEmail && (m.role === "owner" || m.role === "admin")
      );
      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: "Only team owners or admins can invite members" }, { status: 403 });
      }
    }

    const now = new Date().toISOString();
    const baseRoster: TeamRoster =
      roster ?? {
        teamId,
        orgName,
        ownerEmail: inviterEmail,
        ownerName: auth.user.name,
        shareBusinessProfile: ownerProfile?.team.shareBusinessProfile ?? true,
        shareOrganizationProfile: ownerProfile?.team.shareOrganizationProfile ?? true,
        createdAt: ownerProfile?.team.createdAt ?? ownerProfile?.createdAt ?? now,
        members: [
          {
            email: inviterEmail,
            name: auth.user.name,
            role: "owner",
            joinedAt: ownerProfile?.createdAt ?? now,
            userId: auth.user.id,
          },
        ],
        updatedAt: now,
      };
    await saveTeamRoster(roster ?? baseRoster);

    const invite = await createTeamMemberInvite({
      teamId,
      orgName,
      inviterName: auth.user.name,
      inviterEmail,
      inviteeEmail,
      inviteeName,
      role: body.role ?? "editor",
    });

    if (ownerProfile) {
      const now = new Date().toISOString();
      const ownerMember: TeamMember = {
        id: `tm_${inviterEmail.replace(/[^a-z0-9]/g, "_")}`,
        email: inviterEmail,
        name: auth.user.name,
        role: "owner",
        shareProfile: true,
        invitedAt: ownerProfile.createdAt ?? now,
        acceptedAt: ownerProfile.createdAt ?? now,
        status: "active",
      };
      const pendingMember: TeamMember = {
        id: `tm_${inviteeEmail.replace(/[^a-z0-9]/g, "_")}`,
        email: inviteeEmail,
        name: inviteeName,
        username: identity.username,
        avatarUrl: identity.avatarUrl,
        role: body.role ?? "editor",
        shareProfile: true,
        invitedAt: now,
        status: "pending",
      };
      const members = mergeTeamMembersByEmail(inviterEmail, ownerProfile.team.members, [ownerMember, pendingMember]);

      await saveUserProfile(auth.user.id, {
        ...ownerProfile,
        account: {
          ...ownerProfile.account,
          accountId: ownerProfile.account.accountId?.trim() || teamId,
        },
        team: {
          ...ownerProfile.team,
          enabled: true,
          teamId,
          orgName,
          ownerEmail: inviterEmail,
          ownerName: auth.user.name,
          myRole: "owner",
          members,
        },
        updatedAt: now,
      });
    }

    const emailConfig = getEmailConfig();
    const inviteLink = emailConfig
      ? `${emailConfig.appUrl.replace(/\/$/, "")}/team?invite=${encodeURIComponent(invite.id)}`
      : null;

    const emailSent = await notifyTeamMemberInvite({
      inviteeEmail,
      inviteeName,
      inviterName: auth.user.name,
      orgName,
      inviteId: invite.id,
    });

    return NextResponse.json({
      invite: {
        id: invite.id,
        inviteeEmail: invite.inviteeEmail,
        inviteeName: invite.inviteeName,
        inviteeUsername: identity.username,
        inviteeAvatarUrl: identity.avatarUrl,
        status: invite.status,
        code: invite.code,
      },
      teamId,
      emailSent,
      inviteLink,
    });
  } catch {
    return NextResponse.json({ error: "Failed to send team invite" }, { status: 500 });
  }
}
