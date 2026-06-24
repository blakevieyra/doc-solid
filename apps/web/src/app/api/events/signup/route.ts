import { NextRequest, NextResponse } from "next/server";
import { notifySignup } from "@/lib/email/notify";
import { isEmailConfigured } from "@/lib/email/config";
import { enforceRateLimit, rejectIfBodyTooLarge } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, "signup-event", 10, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (rejectIfBodyTooLarge(req, 4096)) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  try {
    const { name, email } = await req.json() as { name?: string; email?: string };

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    if (name.trim().length > 120) {
      return NextResponse.json({ error: "Name too long" }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    if (isEmailConfigured()) {
      await notifySignup({ name: name.trim(), email: normalizedEmail });
    } else {
      console.info("[Doc Solid Signup]", { name: name.trim(), email: normalizedEmail });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to process signup notification" }, { status: 500 });
  }
}
