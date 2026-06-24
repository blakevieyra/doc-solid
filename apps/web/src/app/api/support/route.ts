import { NextRequest, NextResponse } from "next/server";
import { notifySupportTicket } from "@/lib/email/notify";
import { isEmailConfigured } from "@/lib/email/config";
import { SUPPORT_EMAIL } from "@/lib/support/config";
import { enforceRateLimit, rejectIfBodyTooLarge } from "@/lib/server/rate-limit";

interface SupportRequest {
  subject: string;
  category: string;
  message: string;
  email?: string;
  accountId?: string;
  plan?: string;
}

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 5000;

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, "support", 5, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many support requests. Try again later." }, { status: 429 });
  }

  if (rejectIfBodyTooLarge(req, 64_000)) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  try {
    const body = await req.json() as SupportRequest;

    if (!body.subject?.trim() || !body.message?.trim()) {
      return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
    }

    if (body.subject.trim().length > MAX_SUBJECT) {
      return NextResponse.json({ error: `Subject too long (max ${MAX_SUBJECT} characters)` }, { status: 400 });
    }

    if (body.message.trim().length > MAX_MESSAGE) {
      return NextResponse.json({ error: `Message too long (max ${MAX_MESSAGE} characters)` }, { status: 400 });
    }

    if (body.email && !EMAIL_RE.test(body.email.trim())) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const ticket = {
      id: `ticket_${Date.now()}`,
      ...body,
      status: "open" as const,
      createdAt: new Date().toISOString(),
    };

    const webhook = process.env.SUPPORT_WEBHOOK_URL;
    if (webhook) {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `New support ticket from ${body.email ?? "unknown"}\n*${body.subject}*\n${body.message}\nAccount: ${body.accountId}`,
        }),
      }).catch(() => null);
    }

    if (isEmailConfigured()) {
      const sent = await notifySupportTicket({
        ticketId: ticket.id,
        subject: body.subject.trim(),
        category: body.category || "General question",
        message: body.message.trim(),
        email: body.email,
        accountId: body.accountId,
        plan: body.plan,
      });

      if (!sent) {
        return NextResponse.json(
          { error: `Could not deliver message. Email ${SUPPORT_EMAIL} directly.` },
          { status: 503 }
        );
      }
    } else {
      console.info("[Doc Solid Support]", JSON.stringify(ticket));
    }

    return NextResponse.json({ success: true, ticketId: ticket.id });
  } catch {
    return NextResponse.json({ error: "Failed to submit support request" }, { status: 500 });
  }
}
