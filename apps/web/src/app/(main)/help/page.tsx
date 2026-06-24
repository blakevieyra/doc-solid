import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { FAQ_ITEMS, SUPPORT_EMAIL } from "@/lib/support/config";

export default function HelpPage() {
  return (
    <AppShell title="Help Center">
      <p className="page-lead">
        Guides, answers, and resources to get the most out of Doc Solid.
      </p>

      <div className="help-grid">
        <section className="card help-section">
          <h2>Getting Started</h2>
          <ul className="help-links">
            <li><Link href="/onboarding">Run setup wizard</Link></li>
            <li><Link href="/documents">Browse document templates</Link></li>
            <li><Link href="/profile">Set up your profile & logo</Link></li>
            <li><Link href="/documents/invoice">Create your first invoice</Link></li>
          </ul>
        </section>

        <section className="card help-section">
          <h2>Account & Billing</h2>
          <ul className="help-links">
            <li><Link href="/profile">Manage account settings</Link></li>
            <li><Link href="/profile?tab=billing">Subscription & plans</Link></li>
            <li><Link href="/team">Team sharing (Pro)</Link></li>
            <li><a href={`mailto:${SUPPORT_EMAIL}`}>Contact billing support</a></li>
          </ul>
        </section>

        <section className="card help-section">
          <h2>Documents & Features</h2>
          <ul className="help-links">
            <li>Auto-fill from profile</li>
            <li>Line items on invoices</li>
            <li>PDF export & printing</li>
            <li>Import profile from CSV/JSON</li>
          </ul>
        </section>

        <section className="card help-section">
          <h2>Security & Privacy</h2>
          <ul className="help-links">
            <li>Local encryption for Tax ID</li>
            <li>PIN lock for sensitive data</li>
            <li><Link href="/legal/privacy">Privacy Policy</Link></li>
            <li>Export or delete your data anytime</li>
          </ul>
        </section>
      </div>

      <section className="card help-faq" style={{ marginTop: "2rem", padding: "1.75rem" }}>
        <h2 style={{ marginBottom: "1.25rem" }}>Frequently Asked Questions</h2>
        <div className="faq-list">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="help-cta card" style={{ marginTop: "2rem", padding: "2rem", textAlign: "center" }}>
        <h3>Still need help?</h3>
        <p className="field-help" style={{ margin: "0.5rem 0 1.25rem" }}>
          Our support team is here for you.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/profile?tab=support" className="btn btn-primary">Contact Support</Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="btn btn-secondary">{SUPPORT_EMAIL}</a>
        </div>
      </div>
    </AppShell>
  );
}
