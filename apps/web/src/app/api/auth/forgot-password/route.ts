import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@doc-solid/database";
import { enforceRateLimit, rejectIfBodyTooLarge } from "@/lib/server/rate-limit";
import {
  confirmPasswordResetCode,
  sendPasswordResetCode,
} from "@/lib/server/password-reset";
import { isEmailConfigured } from "@/lib/email/config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, "auth-forgot-password", 12, 3600);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many reset requests. Try again later or contact support." },
      { status: 429 }
    );
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Cloud accounts are not available in this environment." }, { status: 503 });
  }

  if (rejectIfBodyTooLarge(req, 4096)) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  try {
    const body = await req.json() as {
      action?: "send" | "confirm";
      email?: string;
      code?: string;
    };

    const email = body.email?.trim();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (body.action === "send") {
      const result = await sendPasswordResetCode(email);
      if (!result.ok) {
        return NextResponse.json({ error: result.error ?? "Could not send reset code" }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        message: "If an account exists for that email, we sent a 6-digit reset code.",
        codeRequired: isEmailConfigured(),
        ...(result.devCode ? { devCode: result.devCode } : {}),
      });
    }

    if (body.action === "confirm") {
      if (!body.code?.trim()) {
        return NextResponse.json({ error: "Reset code is required" }, { status: 400 });
      }
      const result = await confirmPasswordResetCode(email, body.code);
      if (!result.ok) {
        return NextResponse.json({ error: result.error ?? "Invalid code" }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        resetToken: result.resetToken,
        message: "Code verified. Choose your new password.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Could not process reset request" }, { status: 500 });
  }
}
