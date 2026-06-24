import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/server/kv";
import { requireAuth } from "@/lib/server/session";
import { enforceRateLimit, rejectIfBodyTooLarge } from "@/lib/server/rate-limit";
import type { DocumentShare, ShareAuditEvent } from "@/lib/team/invites";
import { fanOutShareNotifications } from "@/lib/server/share-notifications";

export const runtime = "nodejs";

const SHARE_TTL_SEC = 60 * 60 * 24 * 90; // 90 days
const MAX_INBOX = 200;

function shareKey(id: string) {
  return `share:${id}`;
}

function inboxKey(email: string) {
  return `shares:inbox:${email.trim().toLowerCase()}`;
}

function sentKey(email: string) {
  return `shares:sent:${email.trim().toLowerCase()}`;
}

async function readIdList(key: string): Promise<string[]> {
  const raw = await kvGet(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

async function writeIdList(key: string, ids: string[]): Promise<void> {
  await kvSet(key, JSON.stringify(ids.slice(0, MAX_INBOX)), SHARE_TTL_SEC);
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

  const inboxIds = await readIdList(inboxKey(email));
  const sentIds = await readIdList(sentKey(email));
  const allIds = [...new Set([...inboxIds, ...sentIds])];

  const shares: DocumentShare[] = [];
  for (const id of allIds) {
    const share = await readShare(id);
    if (!share) continue;
    const isRecipient = share.toEmail.trim().toLowerCase() === email;
    const isSender = share.fromEmail.trim().toLowerCase() === email;
    if (isRecipient || isSender) {
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

    const userEmail = auth.user.email?.trim().toLowerCase() ?? "";
    const isSender = share.fromEmail.trim().toLowerCase() === userEmail;
    const isRecipient = share.toEmail.trim().toLowerCase() === userEmail;
    const existing = await readShare(share.id);

    if (existing) {
      if (!isSender && !isRecipient) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else if (!isSender) {
      return NextResponse.json({ error: "Only the sender can create a new share" }, { status: 403 });
    }

    await writeShare(share);

    const recipient = share.toEmail.trim().toLowerCase();
    const sender = share.fromEmail.trim().toLowerCase();

    const recipientInbox = await readIdList(inboxKey(recipient));
    await writeIdList(inboxKey(recipient), [share.id, ...recipientInbox.filter((id) => id !== share.id)]);

    const senderSent = await readIdList(sentKey(sender));
    await writeIdList(sentKey(sender), [share.id, ...senderSent.filter((id) => id !== share.id)]);

    await fanOutShareNotifications(existing, share);

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
      share?: DocumentShare;
    };

    if (!body.shareId && !body.share?.id) {
      return NextResponse.json({ error: "shareId is required" }, { status: 400 });
    }

    const shareId = body.shareId ?? body.share!.id;
    const existing = await readShare(shareId);
    if (!existing) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    const userEmail = auth.user.email?.trim().toLowerCase() ?? "";
    const isRecipient = existing.toEmail.trim().toLowerCase() === userEmail;
    const isSender = existing.fromEmail.trim().toLowerCase() === userEmail;
    if (!isRecipient && !isSender) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated: DocumentShare = body.share
      ? { ...existing, ...body.share, id: existing.id, createdAt: existing.createdAt }
      : {
          ...existing,
          ...(body.completedAt !== undefined ? { completedAt: body.completedAt ?? undefined } : {}),
          ...(body.signedAt !== undefined ? { signedAt: body.signedAt ?? undefined } : {}),
          ...(body.fieldDataSnapshot ? { fieldDataSnapshot: body.fieldDataSnapshot } : {}),
          auditLog: body.auditEvent
            ? [...(existing.auditLog ?? []), body.auditEvent]
            : existing.auditLog,
        };

    await writeShare(updated);
    await fanOutShareNotifications(existing, updated);
    return NextResponse.json({ share: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update share" }, { status: 500 });
  }
}
