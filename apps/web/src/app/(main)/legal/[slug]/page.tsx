import Link from "next/link";
import { AppShell } from "@/components/AppShell";

const LEGAL_CONTENT: Record<string, { title: string; sections: { heading: string; body: string }[] }> = {
  terms: {
    title: "Terms of Service",
    sections: [
      { heading: "Acceptance", body: "By using Doc Solid, you agree to these Terms of Service. If you do not agree, do not use the service." },
      { heading: "Service Description", body: "Doc Solid provides document and form templates for business and personal use. Templates are starting points, not legal advice." },
      { heading: "Accounts", body: "You are responsible for maintaining the security of your account and profile data. You must provide accurate information." },
      { heading: "Subscriptions", body: "Paid plans renew automatically unless canceled. Refunds are handled per our billing policy. Free tier limits apply as described at signup." },
      { heading: "Acceptable Use", body: "You may not use Doc Solid for unlawful purposes, to generate fraudulent documents, or to violate others' rights." },
      { heading: "Limitation of Liability", body: "Doc Solid is provided \"as is.\" We are not liable for damages arising from use of generated documents. Consult qualified professionals for legal matters." },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    sections: [
      { heading: "Data We Collect", body: "Profile information you enter, documents you create, usage analytics, and billing data for paid accounts." },
      { heading: "Local Storage", body: "By default, profile and document data is stored locally on your device. Sensitive fields may be encrypted with your PIN." },
      { heading: "Cloud Sync", body: "When enabled, data syncs to our secure cloud infrastructure. You control when cloud sync is activated." },
      { heading: "Third Parties", body: "We use Stripe for payments. We do not sell your personal information to third parties." },
      { heading: "Your Rights", body: "You may export or delete your data at any time from Profile settings. Contact support for additional requests." },
      { heading: "Contact", body: "Privacy inquiries: privacy@docsolid.app" },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    sections: [
      { heading: "What We Use", body: "Essential cookies for session management and preferences. Analytics cookies to improve the product (optional)." },
      { heading: "Your Choices", body: "You can disable non-essential cookies in your browser settings. Core functionality requires essential cookies." },
    ],
  },
  "acceptable-use": {
    title: "Acceptable Use Policy",
    sections: [
      { heading: "Permitted Use", body: "Create legitimate business and personal documents using provided templates." },
      { heading: "Prohibited Use", body: "No fraudulent documents, impersonation, harassment, malware distribution, or circumventing subscription limits." },
      { heading: "Enforcement", body: "Violations may result in account suspension or termination." },
    ],
  },
};

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = LEGAL_CONTENT[slug];

  if (!content) {
    return (
      <AppShell title="Not Found">
        <p>Page not found.</p>
        <Link href="/">Return home</Link>
      </AppShell>
    );
  }

  return (
    <AppShell title={content.title}>
      <p className="page-lead">Last updated: June 2026</p>
      <article className="legal-content card" style={{ padding: "2rem" }}>
        {content.sections.map((s) => (
          <section key={s.heading} style={{ marginBottom: "1.75rem" }}>
            <h2 style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>{s.heading}</h2>
            <p style={{ color: "var(--text-muted)", lineHeight: 1.7 }}>{s.body}</p>
          </section>
        ))}
      </article>
      <div style={{ marginTop: "1.5rem" }}>
        <Link href="/help" className="btn btn-secondary">← Back to Help</Link>
      </div>
    </AppShell>
  );
}
