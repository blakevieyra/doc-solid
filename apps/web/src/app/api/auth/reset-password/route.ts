import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@doc-solid/database";
import { enforceRateLimit, rejectIfBodyTooLarge } from "@/lib/server/rate-limit";
import { resetPasswordWithToken } from "@/lib/server/password-reset";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, "auth-reset-password", 10, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Cloud accounts are not available in this environment." }, { status: 503 });
  }

  if (rejectIfBodyTooLarge(req, 4096)) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  try {
    const { email, token, newPassword } = await req.json() as {
      email?: string;
      token?: string;
      newPassword?: string;
    };

    if (!email?.trim() || !token?.trim() || !newPassword) {
      return NextResponse.json({ error: "Email, reset token, and new password are required" }, { status: 400 });
    }

    const result = await resetPasswordWithToken(email, token, newPassword);
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Reset failed" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: "Password updated. You can sign in now." });
  } catch {
    return NextResponse.json({ error: "Could not reset password" }, { status: 500 });
  }
}
