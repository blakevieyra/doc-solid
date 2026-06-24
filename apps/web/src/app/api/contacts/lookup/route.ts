import { NextRequest, NextResponse } from "next/server";
import { isDatabaseConfigured } from "@doc-solid/database";
import { requireAuth } from "@/lib/server/session";
import { loadPublicIdentityForEmail } from "@/lib/server/public-identity";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    const body = await req.json() as { email?: string };
    const normalized = body.email?.trim().toLowerCase() ?? "";
    if (!EMAIL_RE.test(normalized)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    const identity = await loadPublicIdentityForEmail(normalized);
    if (!identity) {
      return NextResponse.json({
        registered: false,
        error: "No Doc Solid account found for this email. They must sign up before you can add them as a contact.",
      });
    }

    return NextResponse.json({
      registered: true,
      email: identity.email,
      name: identity.name,
      username: identity.username,
      avatarUrl: identity.avatarUrl,
    });
  } catch {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
