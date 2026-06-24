import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@doc-solid/database";
import { getAuthUserFromRequest } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Cloud database not configured", mode: "local" }, { status: 503 });
  }

  const auth = await getAuthUserFromRequest(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    mode: "server" as const,
    user: auth.user,
    session: auth.session,
  });
}
