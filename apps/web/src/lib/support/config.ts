export const SUPPORT_EMAIL = "info@operone2i.com";
export const SALES_EMAIL = "info@operone2i.com";

export const FAQ_ITEMS = [
  {
    q: "How do I create my first document?",
    a: "Go to Documents, pick a template (like Invoice or Service Agreement), fill in the fields — your profile auto-fills business info — then save, print, or download as PDF.",
  },
  {
    q: "What's the difference between Free and Pro?",
    a: "Free includes 10 documents per month with watermarked PDFs. Pro unlocks unlimited documents, clean PDF export, security scan with optional redaction, team profile sharing, email/share links, and cloud sync.",
  },
  {
    q: "Is my data secure?",
    a: "Sensitive fields like Tax ID are encrypted locally with AES-256-GCM. Optional PIN lock adds another layer. Your data stays on your device until you enable cloud sync.",
  },
  {
    q: "Can my team use the same business info?",
    a: "Yes — Pro plans include team profile sharing. Invite members on the Team page and they'll auto-fill from your shared business profile.",
  },
  {
    q: "How do I add my logo to documents?",
    a: "Upload your logo in Profile → Business or during onboarding. It appears on invoices, proposals, and letterhead documents automatically.",
  },
  {
    q: "Can I import existing business info?",
    a: "Yes — Profile → Import supports JSON profile exports and CSV files with field,value rows like business.name,Acme Corp.",
  },
  {
    q: "How do line items work on invoices?",
    a: "Open an invoice template, use the line item table to add rows with description, quantity, and rate. Totals calculate automatically.",
  },
  {
    q: "How do I cancel my subscription?",
    a: "Contact support or manage billing through your Stripe customer portal (coming soon). Your data remains accessible on the Free plan.",
  },
  {
    q: "Do you offer Enterprise pricing?",
    a: "Yes — Enterprise includes unlimited team members, SSO, custom templates, dedicated support, and invoice billing. Contact sales at info@operone2i.com for a custom quote.",
  },
];

export const SUPPORT_CATEGORIES = [
  "General question",
  "Billing & subscription",
  "Technical issue",
  "Feature request",
  "Account & security",
  "Document templates",
];

export function generateAccountId(): string {
  return `DS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export const CURRENCIES = [
  { code: "USD", label: "US Dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "CAD", label: "Canadian Dollar (C$)" },
  { code: "AUD", label: "Australian Dollar (A$)" },
];
