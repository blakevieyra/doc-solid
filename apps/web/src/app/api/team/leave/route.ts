import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@doc-solid/database";
import { requireAuth } from "@/lib/server/session";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getTeamRoster, saveTeamRoster } from "@/lib/server/team-roster";
import { getUserProfile, saveUserProfile } from "@/lib/server/users";
import { pushServerNotification } from "@/lib/server/share-notifications";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const rl = await enforceRateLimit(req, "team-leave", 20, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = (await req.json()) as { teamId?: string };
    const teamId = body.teamId?.trim();
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 });
    }

    const email = auth.user.email.trim().toLowerCase();
    const roster = await getTeamRoster(teamId);
    if (!roster) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    if (roster.ownerEmail.toLowerCase() === email) {
      return NextResponse.json({ error: "Team owners cannot leave — transfer ownership or delete the team first" }, { status: 400 });
    }

    const wasMember = roster.members.some((m) => m.email.toLowerCase() === email);
    if (!wasMember) {
      return NextResponse.json({ error: "You are not a member of this team" }, { status: 404 });
    }

    roster.members = roster.members.filter((m) => m.email.toLowerCase() !== email);
    roster.updatedAt = new Date().toISOString();
    await saveTeamRoster(roster);

    const profile = await getUserProfile(auth.user.id);
    if (profile) {
      const memberships = (profile.team.memberships ?? []).filter((m) => m.teamId !== teamId);
      const isActiveTeam = profile.team.teamId === teamId;
      const fallback = memberships[0];

      await saveUserProfile(auth.user.id, {
        ...profile,
        team: isActiveTeam
          ? {
              ...profile.team,
              enabled: memberships.length > 0,
              teamId: fallback?.teamId ?? null,
              orgName: fallback?.orgName ?? "",
              ownerEmail: fallback?.ownerEmail ?? null,
              ownerName: fallback?.ownerName ?? null,
              myRole: fallback?.myRole ?? null,
              members: isActiveTeam ? [] : profile.team.members.filter((m) => m.email.toLowerCase() !== email),
              memberships,
            }
          : {
              ...profile.team,
              members: profile.team.members.filter((m) => m.email.toLowerCase() !== email),
              memberships,
            },
        updatedAt: new Date().toISOString(),
      });
    }

    const owner = await prisma.user.findUnique({ where: { email: roster.ownerEmail.toLowerCase() } });
    if (owner) {
      const ownerProfile = await getUserProfile(owner.id);
      if (ownerProfile) {
        await saveUserProfile(owner.id, {
          ...ownerProfile,
          team: {
            ...ownerProfile.team,
            members: ownerProfile.team.members.filter((m) => m.email.toLowerCase() !== email),
          },
          updatedAt: new Date().toISOString(),
        });
      }
    }

    await pushServerNotification(roster.ownerEmail, {
      id: `team_leave_${teamId}_${email}_${Date.now()}`,
      type: "team",
      title: "Member left team",
      message: `${auth.user.name || email} left ${roster.orgName}`,
      link: "/team",
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to leave team" }, { status: 500 });
  }
}
