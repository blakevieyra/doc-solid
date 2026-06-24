import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/server/kv";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { kvRequiredForProd } from "@/lib/server/env";

export const runtime = "nodejs";

export interface TeamInviteRecord {
  code: string;
  teamId: string;
  orgName: string;
  inviterName: string;
  inviterEmail: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

const INVITE_TTL_SEC = 60 * 60 * 24 * 8; // 8 days
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function inviteKey(code: string) {
  return `invite:${code.trim().toUpperCase()}`;
}

function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const part = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 8).toUpperCase();
  return `DS-${part.slice(0, 4)}-${part.slice(4, 8)}`;
}

export async function POST(req: NextRequest) {
  if (kvRequiredForProd()) {
    return NextResponse.json({ error: "Team invites require KV in production" }, { status: 503 });
  }

  const rl = await enforceRateLimit(req, "team-invite-create", 20, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many invite requests" }, { status: 429 });
  }

  try {
    const body = await req.json() as {
      teamId?: string;
      orgName?: string;
      inviterName?: string;
      inviterEmail?: string;
      role?: string;
    };

    if (!body.teamId?.trim() || !body.orgName?.trim() || !body.inviterName?.trim() || !body.inviterEmail?.trim()) {
      return NextResponse.json({ error: "teamId, orgName, inviterName, and inviterEmail are required" }, { status: 400 });
    }

    if (!EMAIL_RE.test(body.inviterEmail.trim())) {
      return NextResponse.json({ error: "Invalid inviter email" }, { status: 400 });
    }

    const expires = new Date();
    expires.setDate(expires.getDate() + 7);

    const invite: TeamInviteRecord = {
      code: generateInviteCode(),
      teamId: body.teamId.trim(),
      orgName: body.orgName.trim(),
      inviterName: body.inviterName.trim(),
      inviterEmail: body.inviterEmail.trim().toLowerCase(),
      role: body.role?.trim() || "editor",
      createdAt: new Date().toISOString(),
      expiresAt: expires.toISOString(),
    };

    await kvSet(inviteKey(invite.code), JSON.stringify(invite), INVITE_TTL_SEC);
    return NextResponse.json({ invite });
  } catch {
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const rl = await enforceRateLimit(req, "team-invite-lookup", 60, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many lookup requests" }, { status: 429 });
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code?.trim()) {
    return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
  }

  const raw = await kvGet(inviteKey(code));
  if (!raw) {
    return NextResponse.json({ invite: null }, { status: 404 });
  }

  try {
    const invite = JSON.parse(raw) as TeamInviteRecord;
    if (new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ invite: null, expired: true }, { status: 410 });
    }
    return NextResponse.json({ invite });
  } catch {
    return NextResponse.json({ error: "Invalid invite record" }, { status: 500 });
  }
}
