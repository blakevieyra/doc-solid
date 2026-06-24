import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/session";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getServerNotifications } from "@/lib/server/share-notifications";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const rl = await enforceRateLimit(req, "notifications", 120, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const email = auth.user.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ notifications: [] });
  }

  const notifications = await getServerNotifications(email);
  return NextResponse.json({ notifications });
}
