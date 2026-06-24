import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/server/kv";
import { requireAuth } from "@/lib/server/session";
import { enforceRateLimit, rejectIfBodyTooLarge } from "@/lib/server/rate-limit";
import type { DocumentShare, ShareAuditEvent } from "@/lib/team/invites";

export const runtime = "nodejs";

const SHARE_TTL_SEC = 60 * 60 * 24 * 90; // 90 days
const MAX_INBOX = 200;

function shareKey(id: string) {
  return `share:${id}`;
}

function inboxKey(email: string) {
  return `shares:inbox:${email.trim().toLowerCase()}`;
}

async function readInbox(email: string): Promise<string[]> {
  const raw = await kvGet(inboxKey(email));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

async function writeInbox(email: string, ids: string[]): Promise<void> {
  await kvSet(inboxKey(email), JSON.stringify(ids.slice(0, MAX_INBOX)), SHARE_TTL_SEC);
}

async function readShare(id: string): Promise<DocumentShare | null> {
  const raw = await kvGet(shareKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DocumentShare;
  } catch {
    return null;
  }
}

async function writeShare(share: DocumentShare): Promise<void> {
  await kvSet(shareKey(share.id), JSON.stringify(share), SHARE_TTL_SEC);
}

export async function GET(req: NextRequest) {
  const rl = await enforceRateLimit(req, "shares-inbox", 120, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const email = auth.user.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ shares: [] });
  }

  const ids = await readInbox(email);
  const shares: DocumentShare[] = [];
  for (const id of ids) {
    const share = await readShare(id);
    if (share && share.toEmail.trim().toLowerCase() === email) {
      shares.push(share);
    }
  }

  shares.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return NextResponse.json({ shares });
}

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, "shares-create", 60, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many share requests" }, { status: 429 });
  }

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  if (rejectIfBodyTooLarge(req, 2_000_000)) {
    return NextResponse.json({ error: "Share payload too large" }, { status: 413 });
  }

  try {
    const body = await req.json() as { share?: DocumentShare };
    const share = body.share;
    if (!share?.id || !share.documentTitle || !share.documentId || !share.toEmail || !share.fromEmail) {
      return NextResponse.json({ error: "Valid share is required" }, { status: 400 });
    }

    const senderEmail = auth.user.email?.trim().toLowerCase();
    if (senderEmail && share.fromEmail.trim().toLowerCase() !== senderEmail) {
      return NextResponse.json({ error: "Sender email mismatch" }, { status: 403 });
    }

    await writeShare(share);

    const recipient = share.toEmail.trim().toLowerCase();
    const inbox = await readInbox(recipient);
    const nextInbox = [share.id, ...inbox.filter((id) => id !== share.id)];
    await writeInbox(recipient, nextInbox);

    return NextResponse.json({ share });
  } catch {
    return NextResponse.json({ error: "Failed to save share" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const rl = await enforceRateLimit(req, "shares-update", 120, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  if (rejectIfBodyTooLarge(req, 500_000)) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  try {
    const body = await req.json() as {
      shareId?: string;
      auditEvent?: ShareAuditEvent;
      completedAt?: string | null;
      signedAt?: string | null;
      fieldDataSnapshot?: Record<string, string>;
    };

    if (!body.shareId) {
      return NextResponse.json({ error: "shareId is required" }, { status: 400 });
    }

    const share = await readShare(body.shareId);
    if (!share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    const userEmail = auth.user.email?.trim().toLowerCase() ?? "";
    const isRecipient = share.toEmail.trim().toLowerCase() === userEmail;
    const isSender = share.fromEmail.trim().toLowerCase() === userEmail;
    if (!isRecipient && !isSender) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated: DocumentShare = {
      ...share,
      ...(body.completedAt !== undefined ? { completedAt: body.completedAt ?? undefined } : {}),
      ...(body.signedAt !== undefined ? { signedAt: body.signedAt ?? undefined } : {}),
      ...(body.fieldDataSnapshot ? { fieldDataSnapshot: body.fieldDataSnapshot } : {}),
      auditLog: body.auditEvent
        ? [...(share.auditLog ?? []), body.auditEvent]
        : share.auditLog,
    };

    await writeShare(updated);
    return NextResponse.json({ share: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update share" }, { status: 500 });
  }
}
