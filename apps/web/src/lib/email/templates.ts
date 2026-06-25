import { getEmailConfig } from "./config";

const BRAND_NAVY = "#1a2744";
const BRAND_ACCENT = "#5b9fd4";
/** Compact logo for email headers — app UI uses much larger branding. */
const EMAIL_LOGO_WIDTH = 120;

function emailLogoUrl(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/logo.png`;
}

function emailLogoBlock(appUrl: string, width: number): string {
  const src = emailLogoUrl(appUrl);
  return `<a href="${appUrl}" style="text-decoration:none;display:inline-block;">
  <img src="${src}" alt="DocSolid" width="${width}" style="display:block;margin:0 auto;width:${width}px;max-width:100%;height:auto;border:0;" />
</a>`;
}

function layout(content: string): string {
  const config = getEmailConfig();
  const appUrl = config?.appUrl ?? "https://docsolid.app";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="background:#ffffff;padding:24px 28px 20px;text-align:center;border-bottom:1px solid #e2e8f0;">
          ${emailLogoBlock(appUrl, EMAIL_LOGO_WIDTH)}
        </td></tr>
        <tr><td style="padding:28px;color:#1e293b;font-size:15px;line-height:1.6;">${content}</td></tr>
        <tr><td style="padding:20px 28px 28px;border-top:1px solid #e2e8f0;text-align:center;color:#64748b;font-size:12px;line-height:1.5;">
          <a href="${appUrl}" style="color:${BRAND_ACCENT};text-decoration:none;font-weight:600;">docsolid.app</a>
          · Professional documents for your business
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function btn(href: string, label: string): string {
  return `<p style="margin:24px 0 8px;"><a href="${href}" style="display:inline-block;background:${BRAND_NAVY};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">${label}</a></p>`;
}

export function welcomeEmail(name: string, appUrl: string): { subject: string; html: string } {
  return {
    subject: "Welcome to DocSolid",
    html: layout(`
      <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Welcome, ${escapeHtml(name)}!</h1>
      <p>Your account is ready. Here is what you can do next:</p>
      <ul style="padding-left:20px;color:#475569;">
        <li>Complete your profile for auto-fill on 120+ templates</li>
        <li>Create invoices, contracts, and business forms</li>
        <li>Print or export PDFs from any document</li>
      </ul>
      ${btn(`${appUrl}/onboarding`, "Complete Setup")}
      <p style="color:#64748b;font-size:13px;">Need help? Reply to this email or visit Profile → Support.</p>
    `),
  };
}

export function emailVerificationCodeEmail(code: string): { subject: string; html: string } {
  return {
    subject: "Verify your email for DocSolid",
    html: layout(`
      <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Verify your email</h1>
      <p>Enter this code to continue creating your DocSolid account:</p>
      <p style="margin:24px 0;font-size:32px;font-weight:700;letter-spacing:0.25em;color:${BRAND_NAVY};text-align:center;">${escapeHtml(code)}</p>
      <p style="color:#64748b;font-size:13px;">This code expires in 15 minutes. If you did not request this, you can ignore this email.</p>
    `),
  };
}

export function passwordResetCodeEmail(code: string): { subject: string; html: string } {
  return {
    subject: "Your DocSolid password reset code",
    html: layout(`
      <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Reset your password</h1>
      <p>Enter this one-time code to reset your DocSolid password:</p>
      <p style="margin:24px 0;font-size:32px;font-weight:700;letter-spacing:0.25em;color:${BRAND_NAVY};text-align:center;">${escapeHtml(code)}</p>
      <p style="color:#64748b;font-size:13px;">This code expires in 15 minutes. If you did not request a reset, you can ignore this email.</p>
    `),
  };
}

export function teamSignupAlert(name: string, email: string): { subject: string; html: string } {
  return {
    subject: `[DocSolid] New signup: ${name}`,
    html: layout(`
      <h1 style="margin:0 0 12px;font-size:20px;">New account created</h1>
      <table style="width:100%;font-size:14px;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#64748b;width:100px;">Name</td><td style="padding:8px 0;"><strong>${escapeHtml(name)}</strong></td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Email</td><td style="padding:8px 0;">${escapeHtml(email)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b;">Time</td><td style="padding:8px 0;">${new Date().toLocaleString()}</td></tr>
      </table>
    `),
  };
}

export function supportTeamEmail(ticket: {
  ticketId: string;
  subject: string;
  category: string;
  message: string;
  email?: string;
  accountId?: string;
  plan?: string;
}): { subject: string; html: string } {
  return {
    subject: `[Support] ${ticket.category}: ${ticket.subject}`,
    html: layout(`
      <h1 style="margin:0 0 12px;font-size:20px;">Support request</h1>
      <p style="color:#64748b;font-size:13px;">Ticket ${escapeHtml(ticket.ticketId)}</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:6px 0;color:#64748b;width:110px;">From</td><td>${escapeHtml(ticket.email ?? "unknown")}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Category</td><td>${escapeHtml(ticket.category)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Account ID</td><td>${escapeHtml(ticket.accountId ?? "—")}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Plan</td><td>${escapeHtml(ticket.plan ?? "—")}</td></tr>
      </table>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;white-space:pre-wrap;font-size:14px;">${escapeHtml(ticket.message)}</div>
    `),
  };
}

export function supportConfirmationEmail(subject: string, ticketId: string): { subject: string; html: string } {
  return {
    subject: `We received your message: ${subject}`,
    html: layout(`
      <h1 style="margin:0 0 12px;font-size:20px;">Message received</h1>
      <p>Thanks for contacting DocSolid support. We received your request and typically respond within one business day.</p>
      <p style="font-size:13px;color:#64748b;">Reference: <strong>${escapeHtml(ticketId)}</strong></p>
      <p>Pro subscribers receive priority support. You can track updates in Profile → Support.</p>
    `),
  };
}

export function proWelcomeEmail(plan: string, appUrl: string): { subject: string; html: string } {
  const planLabel = plan === "yearly" ? "Pro Yearly" : "Pro Monthly";
  return {
    subject: `You're on ${planLabel} — DocSolid Pro`,
    html: layout(`
      <h1 style="margin:0 0 12px;font-size:22px;">Welcome to DocSolid Pro!</h1>
      <p>Your <strong>${escapeHtml(planLabel)}</strong> subscription is active. You now have:</p>
      <ul style="padding-left:20px;color:#475569;">
        <li>Unlimited documents</li>
        <li>Clean PDF export (no watermark)</li>
        <li>Team profile sharing</li>
        <li>Priority support</li>
      </ul>
      ${btn(`${appUrl}/documents`, "Start Creating Documents")}
      ${btn(`${appUrl}/profile?tab=billing`, "Manage Billing")}
    `),
  };
}

export function paymentFailedEmail(appUrl: string): { subject: string; html: string } {
  return {
    subject: "Action needed: payment failed — DocSolid",
    html: layout(`
      <h1 style="margin:0 0 12px;font-size:20px;color:#dc2626;">Payment failed</h1>
      <p>We couldn't process your latest DocSolid Pro payment. Update your payment method to keep Pro features active.</p>
      ${btn(`${appUrl}/profile?tab=billing`, "Update Payment Method")}
      <p style="color:#64748b;font-size:13px;">Questions? Contact support from your profile.</p>
    `),
  };
}

export function subscriptionCanceledEmail(): { subject: string; html: string } {
  return {
    subject: "Your DocSolid Pro subscription ended",
    html: layout(`
      <h1 style="margin:0 0 12px;font-size:20px;">Subscription canceled</h1>
      <p>Your Pro subscription has ended. You can still use DocSolid on the Free plan with your saved documents and profile.</p>
      <p>You can resubscribe anytime from Profile → Billing.</p>
    `),
  };
}

export function teamMemberInviteEmail(payload: {
  inviteeName: string;
  inviterName: string;
  orgName: string;
  acceptUrl: string;
  signupUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `${payload.inviterName} invited you to ${payload.orgName} on DocSolid`,
    html: layout(`
      <h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">You're invited to a team</h1>
      <p>Hi ${escapeHtml(payload.inviteeName)},</p>
      <p><strong>${escapeHtml(payload.inviterName)}</strong> invited you to join <strong>${escapeHtml(payload.orgName)}</strong> on DocSolid.</p>
      <p>Accept the invitation to share business profile auto-fill, receive documents, and collaborate with your team.</p>
      ${btn(payload.acceptUrl, "Accept invitation")}
      <p style="color:#64748b;font-size:13px;margin-top:20px;">Don't have a DocSolid account yet? <a href="${payload.signupUrl}" style="color:${BRAND_ACCENT};">Create a free account</a> using this email address, then open the accept link again.</p>
      <p style="color:#64748b;font-size:13px;">This invitation expires in 7 days.</p>
    `),
  };
}

export function documentSharedEmail(payload: {
  recipientName?: string;
  senderName: string;
  documentTitle: string;
  documentType?: string;
  documentNumber?: string;
  message?: string;
  appUrl: string;
}): { subject: string; html: string } {
  const greeting = payload.recipientName
    ? `Hi ${escapeHtml(payload.recipientName)},`
    : "Hello,";

  return {
    subject: `${payload.senderName} sent you: ${payload.documentTitle}`,
    html: layout(`
      <h1 style="margin:0 0 12px;font-size:20px;">Document shared with you</h1>
      <p>${greeting}</p>
      <p><strong>${escapeHtml(payload.senderName)}</strong> sent you a document from DocSolid.</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse;margin:16px 0;background:#f8fafc;border-radius:8px;">
        <tr><td style="padding:12px 16px;color:#64748b;width:120px;">Document</td><td style="padding:12px 16px;"><strong>${escapeHtml(payload.documentTitle)}</strong></td></tr>
        ${payload.documentType ? `<tr><td style="padding:12px 16px;color:#64748b;">Type</td><td style="padding:12px 16px;">${escapeHtml(payload.documentType)}</td></tr>` : ""}
        ${payload.documentNumber ? `<tr><td style="padding:12px 16px;color:#64748b;">Number</td><td style="padding:12px 16px;"><code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;">${escapeHtml(payload.documentNumber)}</code></td></tr>` : ""}
      </table>
      ${payload.message ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;font-size:14px;"><strong>Message:</strong><br/>${escapeHtml(payload.message)}</div>` : ""}
      <p>The document is attached as a PDF. Open it from your email client or sign in to DocSolid to manage your files.</p>
      ${btn(`${payload.appUrl}/portal`, "Open My Files")}
    `),
  };
}

export function wrapEmailLayout(content: string): string {
  return layout(content);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
