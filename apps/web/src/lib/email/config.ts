export interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  supportTo: string;
  appUrl: string;
}

export function getEmailConfig(): EmailConfig | null {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) return null;

  return {
    apiKey,
    fromEmail,
    fromName: process.env.SENDGRID_FROM_NAME ?? "DocSolid",
    supportTo: process.env.SENDGRID_SUPPORT_TO ?? process.env.SUPPORT_EMAIL ?? "info@operone2i.com",
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? (process.env.NODE_ENV === "production" ? "https://docsolid.app" : "http://localhost:3000"),
  };
}

export function isEmailConfigured(): boolean {
  return getEmailConfig() !== null;
}
