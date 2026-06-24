import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@doc-solid/database";
import {
  requireAuth,
  clearSessionCookie,
  deleteAllUserSessions,
} from "@/lib/server/session";
import { verifyPassword } from "@/lib/server/password";
import { deleteUserAccount } from "@/lib/server/users";
import { enforceRateLimit, rejectIfBodyTooLarge } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function DELETE(req: NextRequest) {
  const rl = await enforceRateLimit(req, "auth-delete", 5, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  if (rejectIfBodyTooLarge(req, 4096)) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  const { password } = await req.json() as { password?: string };
  if (!password) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: auth.user.id } });
  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  await deleteAllUserSessions(auth.user.id);
  await deleteUserAccount(auth.user.id);

  const res = NextResponse.json({ success: true });
  clearSessionCookie(res);
  return res;
}
