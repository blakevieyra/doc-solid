import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/session";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { createTeamMemberInvite } from "@/lib/server/team-member-invites";
import { getTeamRoster } from "@/lib/server/team-roster";
import type { TeamRole } from "@/lib/profile/types";

export const runtime = "nodejs";

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

    const teamId = body.teamId?.trim();
    const inviteeEmail = body.inviteeEmail?.trim().toLowerCase();
    const inviteeName = body.inviteeName?.trim();
    const orgName = body.orgName?.trim() || "Team";

    if (!teamId || !inviteeEmail || !inviteeName) {
      return NextResponse.json({ error: "teamId, inviteeEmail, and inviteeName are required" }, { status: 400 });
    }

    const inviterEmail = auth.user.email.trim().toLowerCase();
    if (inviteeEmail === inviterEmail) {
      return NextResponse.json({ error: "You cannot invite yourself" }, { status: 400 });
    }

    const roster = await getTeamRoster(teamId);
    if (roster) {
      const isOwner = roster.ownerEmail.toLowerCase() === inviterEmail;
      const isAdmin = roster.members.some(
        (m) => m.email.toLowerCase() === inviterEmail && (m.role === "owner" || m.role === "admin")
      );
      if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: "Only team owners or admins can invite members" }, { status: 403 });
      }
    }

    const invite = await createTeamMemberInvite({
      teamId,
      orgName,
      inviterName: auth.user.name,
      inviterEmail,
      inviteeEmail,
      inviteeName,
      role: body.role ?? "editor",
    });

    return NextResponse.json({
      invite: {
        id: invite.id,
        inviteeEmail: invite.inviteeEmail,
        inviteeName: invite.inviteeName,
        status: invite.status,
        code: invite.code,
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to send team invite" }, { status: 500 });
  }
}
