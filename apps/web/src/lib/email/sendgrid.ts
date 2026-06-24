import { getEmailConfig } from "./config";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  content: string;
  filename: string;
  type?: string;
  disposition?: "attachment" | "inline";
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const config = getEmailConfig();
  if (!config) {
    console.warn("[Email] SendGrid not configured — skipping send:", options.subject);
    return false;
  }

  const recipients = (Array.isArray(options.to) ? options.to : [options.to]).map((email) => ({ email }));

  const payload: Record<string, unknown> = {
    personalizations: [{ to: recipients }],
    from: { email: config.fromEmail, name: config.fromName },
    subject: options.subject,
    content: [
      { type: "text/plain", value: options.text ?? stripHtml(options.html) },
      { type: "text/html", value: options.html },
    ],
  };

  if (options.replyTo) {
    payload.reply_to = { email: options.replyTo };
  }

  if (options.attachments?.length) {
    payload.attachments = options.attachments.map((a) => ({
      content: a.content,
      filename: a.filename,
      type: a.type ?? "application/pdf",
      disposition: a.disposition ?? "attachment",
    }));
  }

  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Email] SendGrid error:", res.status, err);
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Email] Send failed:", err);
    return false;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
