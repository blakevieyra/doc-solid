import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@doc-solid/database";
import { registerUser } from "@/lib/server/users";
import { consumeSignupToken, isEmailVerificationRequired } from "@/lib/server/email-verification";
import {
  createServerSession,
  setSessionCookie,
  sessionExpiryDate,
} from "@/lib/server/session";
import { enforceRateLimit, rejectIfBodyTooLarge } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, "auth-register", 10, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many registration attempts" }, { status: 429 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Cloud database not configured", mode: "local" }, { status: 503 });
  }

  if (rejectIfBodyTooLarge(req, 8192)) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  try {
    const { email, password, name, signupToken } = await req.json() as {
      email?: string;
      password?: string;
      name?: string;
      signupToken?: string;
    };

    if (!email?.trim() || !password || !name?.trim()) {
      return NextResponse.json({ error: "Email, password, and name are required" }, { status: 400 });
    }

    if (!signupToken) {
      return NextResponse.json({ error: "Enter the verification code sent to your email first" }, { status: 400 });
    }
    const verified = await consumeSignupToken(email, signupToken);
    if (!verified) {
      return NextResponse.json({
        error: isEmailVerificationRequired()
          ? "Email verification expired. Verify your email again."
          : "Verification expired. Request a new code.",
      }, { status: 400 });
    }

    const user = await registerUser(email, password, name);
    const token = await createServerSession(user.id);
    const expiresAt = sessionExpiryDate().toISOString();

    const res = NextResponse.json({
      mode: "server" as const,
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? "",
        createdAt: user.createdAt.toISOString(),
      },
      session: {
        userId: user.id,
        email: user.email,
        name: user.name ?? "",
        expiresAt,
      },
    });
    setSessionCookie(res, token);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
