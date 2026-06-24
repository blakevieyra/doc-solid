import { NextRequest, NextResponse } from "next/server";
import { prisma, isDatabaseConfigured } from "@doc-solid/database";
import { isEmailConfigured } from "@/lib/email/config";
import { sendDocumentEmail } from "@/lib/email/notify";
import { isActiveProSubscriber } from "@/lib/server/subscription-verify";
import { enforceRateLimit, rejectIfBodyTooLarge } from "@/lib/server/rate-limit";
export const runtime = "nodejs";
export const maxDuration = 30;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 10;
const MAX_PDF_BYTES = 7 * 1024 * 1024;
/** Align with Vercel serverless request body limit (~4.5 MB). */
const MAX_BODY_BYTES = 4.5 * 1024 * 1024;

interface EmailDocumentRequest {
  recipients: { email: string; name?: string }[];
  senderName: string;
  senderEmail: string;
  documentTitle: string;
  documentType?: string;
  documentNumber?: string;
  message?: string;
  pdfBase64?: string;
  pdfFilename?: string;
}

export async function POST(req: NextRequest) {
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Email is not configured on this server. Add SendGrid keys in Vercel." },
      { status: 503 }
    );
  }

  const rl = await enforceRateLimit(req, "documents-email", 20, 3600);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many email requests. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec ?? 3600) } }
    );
  }

  if (rejectIfBodyTooLarge(req, MAX_BODY_BYTES)) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  try {
    const body = await req.json() as EmailDocumentRequest;

    if (!body.documentTitle?.trim()) {
      return NextResponse.json({ error: "Document title is required" }, { status: 400 });
    }
    if (!body.senderName?.trim() || !body.senderEmail?.trim()) {
      return NextResponse.json({ error: "Sender name and email are required" }, { status: 400 });
    }
    if (!EMAIL_RE.test(body.senderEmail)) {
      return NextResponse.json({ error: "Invalid sender email" }, { status: 400 });
    }

    const recipients = (body.recipients ?? [])
      .filter((r) => r.email?.trim())
      .map((r) => ({ email: r.email.trim().toLowerCase(), name: r.name?.trim() }));

    if (recipients.length === 0) {
      return NextResponse.json({ error: "At least one recipient is required" }, { status: 400 });
    }
    if (recipients.length > MAX_RECIPIENTS) {
      return NextResponse.json({ error: `Maximum ${MAX_RECIPIENTS} recipients per send` }, { status: 400 });
    }

    for (const r of recipients) {
      if (!EMAIL_RE.test(r.email)) {
        return NextResponse.json({ error: `Invalid email: ${r.email}` }, { status: 400 });
      }
    }

    const senderEmail = body.senderEmail.trim().toLowerCase();
    const isPro = await isActiveProSubscriber(senderEmail);

    if (!isPro) {
      const nonSelf = recipients.filter((r) => r.email !== senderEmail);
      if (nonSelf.length > 0) {
        return NextResponse.json(
          { error: "Free plan can email documents to yourself only. Upgrade to Pro to email team members and others." },
          { status: 403 }
        );
      }
    } else if (isDatabaseConfigured()) {
      const nonSelf = recipients.filter((r) => r.email !== senderEmail);
      for (const r of nonSelf) {
        const user = await prisma.user.findUnique({
          where: { email: r.email },
          select: { id: true },
        });
        if (!user) {
          return NextResponse.json(
            {
              error: `${r.email} does not have a Doc Solid account yet. Ask them to sign up at docsolid.app, then add them as a team member or contact.`,
            },
            { status: 400 }
          );
        }
      }
    }

    if (body.pdfBase64) {
      const approxBytes = Math.ceil(body.pdfBase64.length * 0.75);
      if (approxBytes > MAX_PDF_BYTES) {
        return NextResponse.json({ error: "PDF attachment is too large (max 7 MB)" }, { status: 413 });
      }
    }

    if (body.message && body.message.length > 2000) {
      return NextResponse.json({ error: "Message is too long (max 2000 characters)" }, { status: 400 });
    }

    const { sent, failed } = await sendDocumentEmail({
      recipients,
      senderName: body.senderName.trim(),
      senderEmail,
      documentTitle: body.documentTitle.trim(),
      documentType: body.documentType?.trim(),
      documentNumber: body.documentNumber?.trim(),
      message: body.message?.trim(),
      pdfBase64: body.pdfBase64,
      pdfFilename: body.pdfFilename ?? "document.pdf",
    });

    if (sent === 0) {
      return NextResponse.json({ error: "Failed to send email. Try again later." }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      message: sent === 1 ? "Email sent" : `Sent to ${sent} recipients`,
    });
  } catch {
    return NextResponse.json({ error: "Failed to send document email" }, { status: 500 });
  }
}
