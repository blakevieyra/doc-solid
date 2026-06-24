import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@doc-solid/database";
import { authenticateUser, getUserProfile, saveUserProfile } from "@/lib/server/users";
import { resolveOnboardingComplete } from "@/lib/profile/onboarding";
import {
  createServerSession,
  setSessionCookie,
  sessionExpiryDate,
} from "@/lib/server/session";
import { enforceRateLimit, rejectIfBodyTooLarge } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, "auth-login", 20, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many login attempts" }, { status: 429 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Cloud database not configured", mode: "local" }, { status: 503 });
  }

  if (rejectIfBodyTooLarge(req, 8192)) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  try {
    const { email, password } = await req.json() as { email?: string; password?: string };
    if (!email?.trim() || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await authenticateUser(email, password);

    const profile = await getUserProfile(user.id);
    if (
      profile &&
      resolveOnboardingComplete(profile, { userCreatedAt: user.createdAt }) &&
      !profile.onboardingComplete
    ) {
      await saveUserProfile(user.id, {
        ...profile,
        onboardingComplete: true,
        updatedAt: new Date().toISOString(),
      });
    }

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
    const message = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
