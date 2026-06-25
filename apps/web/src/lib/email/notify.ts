import { getEmailConfig } from "./config";
import { sendEmail } from "./sendgrid";
import {
  welcomeEmail,
  teamSignupAlert,
  supportTeamEmail,
  supportConfirmationEmail,
  proWelcomeEmail,
  paymentFailedEmail,
  subscriptionCanceledEmail,
  documentSharedEmail,
  teamMemberInviteEmail,
} from "./templates";

export async function notifySignup(payload: { name: string; email: string }): Promise<void> {
  const config = getEmailConfig();
  if (!config) return;

  const welcome = welcomeEmail(payload.name, config.appUrl);
  await sendEmail({
    to: payload.email,
    subject: welcome.subject,
    html: welcome.html,
  });

  const alert = teamSignupAlert(payload.name, payload.email);
  await sendEmail({
    to: config.supportTo,
    subject: alert.subject,
    html: alert.html,
    replyTo: payload.email,
  });
}

export async function notifySupportTicket(ticket: {
  ticketId: string;
  subject: string;
  category: string;
  message: string;
  email?: string;
  accountId?: string;
  plan?: string;
}): Promise<boolean> {
  const config = getEmailConfig();
  if (!config) return false;

  const team = supportTeamEmail(ticket);
  const sentToTeam = await sendEmail({
    to: config.supportTo,
    subject: team.subject,
    html: team.html,
    replyTo: ticket.email,
  });

  if (ticket.email) {
    const confirm = supportConfirmationEmail(ticket.subject, ticket.ticketId);
    await sendEmail({
      to: ticket.email,
      subject: confirm.subject,
      html: confirm.html,
    });
  }

  return sentToTeam;
}

export async function notifyProSubscription(payload: {
  email: string;
  plan: string;
}): Promise<void> {
  const config = getEmailConfig();
  if (!config || !payload.email) return;

  const mail = proWelcomeEmail(payload.plan, config.appUrl);
  await sendEmail({
    to: payload.email,
    subject: mail.subject,
    html: mail.html,
  });
}

export async function notifyPaymentFailed(email: string): Promise<void> {
  const config = getEmailConfig();
  if (!config || !email) return;

  const mail = paymentFailedEmail(config.appUrl);
  await sendEmail({
    to: email,
    subject: mail.subject,
    html: mail.html,
  });
}

export async function notifySubscriptionCanceled(email: string): Promise<void> {
  if (!email) return;

  const mail = subscriptionCanceledEmail();
  await sendEmail({
    to: email,
    subject: mail.subject,
    html: mail.html,
  });
}

export async function notifyTeamInternal(subject: string, html: string): Promise<void> {
  const config = getEmailConfig();
  if (!config) return;

  await sendEmail({
    to: config.supportTo,
    subject,
    html,
  });
}

export async function sendDocumentEmail(payload: {
  recipients: { email: string; name?: string }[];
  senderName: string;
  senderEmail: string;
  documentTitle: string;
  documentType?: string;
  documentNumber?: string;
  message?: string;
  pdfBase64?: string;
  pdfFilename?: string;
}): Promise<{ sent: number; failed: number }> {
  const config = getEmailConfig();
  if (!config) return { sent: 0, failed: payload.recipients.length };

  let sent = 0;
  let failed = 0;

  const attachment =
    payload.pdfBase64 && payload.pdfFilename
      ? [{
          content: payload.pdfBase64,
          filename: payload.pdfFilename,
          type: "application/pdf",
        }]
      : undefined;

  for (const recipient of payload.recipients) {
    const mail = documentSharedEmail({
      recipientName: recipient.name,
      senderName: payload.senderName,
      documentTitle: payload.documentTitle,
      documentType: payload.documentType,
      documentNumber: payload.documentNumber,
      message: payload.message,
      appUrl: config.appUrl,
    });

    const ok = await sendEmail({
      to: recipient.email,
      subject: mail.subject,
      html: mail.html,
      replyTo: payload.senderEmail,
      attachments: attachment,
    });

    if (ok) sent++;
    else failed++;
  }

  return { sent, failed };
}

export async function notifyTeamMemberInvite(payload: {
  inviteeEmail: string;
  inviteeName: string;
  inviterName: string;
  orgName: string;
  inviteId: string;
}): Promise<boolean> {
  const config = getEmailConfig();
  if (!config || !payload.inviteeEmail) return false;

  const acceptUrl = `${config.appUrl.replace(/\/$/, "")}/team?invite=${encodeURIComponent(payload.inviteId)}`;
  const signupUrl = `${config.appUrl.replace(/\/$/, "")}/signup?email=${encodeURIComponent(payload.inviteeEmail)}`;

  const mail = teamMemberInviteEmail({
    inviteeName: payload.inviteeName,
    inviterName: payload.inviterName,
    orgName: payload.orgName,
    acceptUrl,
    signupUrl,
  });

  return sendEmail({
    to: payload.inviteeEmail,
    subject: mail.subject,
    html: mail.html,
  });
}
