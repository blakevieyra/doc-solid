import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@doc-solid/database";
import { requireAuth } from "@/lib/server/session";
import { verifyPassword, hashPassword } from "@/lib/server/password";
import { enforceRateLimit, rejectIfBodyTooLarge } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest) {
  const rl = await enforceRateLimit(req, "auth-password", 10, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  if (rejectIfBodyTooLarge(req, 4096)) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  const { currentPassword, newPassword } = await req.json() as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current and new password are required" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: auth.user.id } });
  if (!user?.passwordHash) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  return NextResponse.json({ success: true });
}
