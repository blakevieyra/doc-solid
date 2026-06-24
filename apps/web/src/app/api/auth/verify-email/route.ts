import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit, rejectIfBodyTooLarge } from "@/lib/server/rate-limit";
import {
  confirmSignupVerificationCode,
  isEmailVerificationRequired,
  sendSignupVerificationCode,
} from "@/lib/server/email-verification";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, "auth-verify-email", 15, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
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
      const result = await sendSignupVerificationCode(email);
      if (!result.ok) {
        return NextResponse.json({ error: result.error ?? "Could not send code" }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        verificationRequired: true,
        message: "Verification code sent",
        ...(result.devCode ? { devCode: result.devCode } : {}),
      });
    }

    if (body.action === "confirm") {
      if (!body.code?.trim()) {
        return NextResponse.json({ error: "Verification code is required" }, { status: 400 });
      }
      const result = await confirmSignupVerificationCode(email, body.code);
      if (!result.ok) {
        return NextResponse.json({ error: result.error ?? "Verification failed" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, signupToken: result.signupToken });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Verification request failed" }, { status: 500 });
  }
}
