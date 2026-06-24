import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/session";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getPendingInvitesForUser } from "@/lib/server/team-member-invites";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const rl = await enforceRateLimit(req, "team-pending-invites", 60, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const email = auth.user.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ invites: [] });
  }

  const invites = await getPendingInvitesForUser(email);
  return NextResponse.json({
    invites: invites.map((i) => ({
      id: i.id,
      teamId: i.teamId,
      orgName: i.orgName,
      inviterName: i.inviterName,
      inviterEmail: i.inviterEmail,
      role: i.role,
      createdAt: i.createdAt,
      expiresAt: i.expiresAt,
    })),
  });
}
