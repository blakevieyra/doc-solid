import { NextRequest, NextResponse } from "next/server";
import {
  clearSessionCookie,
  deleteServerSession,
  getTokenFromRequest,
} from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = getTokenFromRequest(req);
  if (token) await deleteServerSession(token).catch(() => null);

  const res = NextResponse.json({ success: true });
  clearSessionCookie(res);
  return res;
}
