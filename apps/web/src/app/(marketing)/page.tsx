import Link from "next/link";
import { CATALOG_STATS } from "@doc-solid/documents";
import { BrandLogo } from "@/components/BrandLogo";
import { PLANS, getPlan, ENTERPRISE_PLAN } from "@/lib/subscription/plans";
import { FAQ_ITEMS, SALES_EMAIL, SUPPORT_EMAIL } from "@/lib/support/config";
import {
  IconAutofill,
  IconBuilder,
  IconCloud,
  IconLock,
  IconPackets,
  IconPdf,
  IconShield,
  IconTeam,
} from "@/components/landing/FeatureIcons";

const FEATURES = [
  {
    icon: IconBuilder,
    title: "Custom Builder",
    desc: "Start from 120+ templates or build your own forms with text, dates, tables, and signatures.",
  },
  {
    icon: IconAutofill,
    title: "Auto-Fill Profile",
    desc: "Save your business or personal info once — it fills every document automatically.",
  },
  {
    icon: IconPdf,
    title: "Print, PDF & Email",
    desc: "Generate clean, professional PDFs ready to print or attach to email.",
  },
  {
    icon: IconTeam,
    title: "Team Sharing",
    desc: "Invite colleagues, join teams, and send completed documents to members instantly.",
  },
  {
    icon: IconShield,
    title: "AI Security Scan",
    desc: "Pro-only scan for sensitive data with optional redaction and privacy-safe profile storage.",
    pro: true,
  },
  {
    icon: IconLock,
    title: "Security Center",
    desc: "PIN lock, AES-256 encryption, password management, and safe delete-all-data.",
  },
  {
    icon: IconCloud,
    title: "Cloud + Local",
    desc: "Work offline on mobile or desktop. Changes sync when you're back online.",
  },
  {
    icon: IconPackets,
    title: "Document Packets",
    desc: "Bundle related forms into packets — reorder items, export combined PDFs, and email the full set to your team.",
  },
] as const;

export default function HomePage() {
  const monthly = getPlan("monthly");
  const yearly = getPlan("yearly");

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="container landing-header-inner">
          <BrandLogo href="/" size="xs" />
          <nav className="landing-nav">
            <Link href="/help">Help</Link>
            <a href="#faq">FAQ</a>
            <Link href="/login">Sign In</Link>
            <Link href="/signup" className="btn btn-primary">Start Free</Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="container">
            <div className="landing-hero-badge">Trusted document workflow</div>
            <h1>Professional documents<br />for your business</h1>
            <p>
              Build, fill, print, email, and save {CATALOG_STATS.total}+ document types.
              Cloud sync with offline access. Multi-user teams supported.
            </p>
            <div className="landing-cta-row">
              <Link href="/signup" className="btn btn-primary btn-lg">Create Free Account</Link>
              <Link href="/login" className="btn btn-secondary btn-lg">Sign In</Link>
            </div>
          </div>
        </section>

        <section className="landing-stats">
          <div className="container">
            <div className="grid-3 landing-stats-grid">
              <StatCard label="Document Types" value={String(CATALOG_STATS.total)} />
              <StatCard label="Business Templates" value={String(CATALOG_STATS.business)} />
              <StatCard label="Individual Templates" value={String(CATALOG_STATS.individual)} />
              <StatCard label="Organization Templates" value={String(CATALOG_STATS.organization)} />
              <StatCard label="Essential Documents" value={String(CATALOG_STATS.essential)} />
              <StatCard label="Ready-to-Use Templates" value={String(CATALOG_STATS.withTemplates)} />
            </div>
          </div>
        </section>

        <section className="landing-features">
          <div className="container">
            <h2>Everything you need to ship documents today</h2>
            <p className="landing-section-lead">
              From templates to AI security scanning — DocSolid keeps your workflow fast and protected.
            </p>
            <div className="landing-features-grid">
              {FEATURES.map((f) => (
                <FeatureCard key={f.title} {...f} />
              ))}
            </div>
          </div>
        </section>

        <section className="landing-pricing">
          <div className="container landing-pricing-inner">
            <h2>Simple pricing</h2>
            <p>Free to start. Upgrade when you need clean PDFs, AI security scan, team sharing, and priority support.</p>
            <div className="landing-pricing-cards">
              <div className="card landing-price-card">
                <strong>{PLANS[0].name}</strong>
                <span className="landing-price">$0</span>
                <span>Watermarked PDFs · 120+ templates · Local storage</span>
                <Link href="/signup" className="btn btn-secondary">Get Started</Link>
              </div>
              <div className="card landing-price-card highlighted">
                <span className="landing-pro-badge">Most Popular</span>
                <strong>Pro Monthly</strong>
                <span className="landing-price">${monthly.price}/mo</span>
                <span>AI security scan · Clean PDFs · Team sharing · Priority support</span>
                <Link href="/signup" className="btn btn-primary">Start Pro Trial</Link>
              </div>
              <div className="card landing-price-card">
                <span className="landing-save-badge">{yearly.savings}</span>
                <strong>Pro Yearly</strong>
                <span className="landing-price">${yearly.price}/yr</span>
                <span>Everything in Pro · Best value for teams</span>
                <Link href="/signup" className="btn btn-secondary">Choose Yearly</Link>
              </div>
              <div className="card landing-price-card landing-price-enterprise">
                <strong>{ENTERPRISE_PLAN.name}</strong>
                <span className="landing-price">{ENTERPRISE_PLAN.priceLabel}</span>
                <span>{ENTERPRISE_PLAN.description}</span>
                <ul className="landing-price-features">
                  {ENTERPRISE_PLAN.features.slice(0, 4).map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <a href={`mailto:${SALES_EMAIL}?subject=DocSolid%20Enterprise%20inquiry`} className="btn btn-secondary">
                  Contact Sales
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="landing-faq">
          <div className="container landing-faq-inner">
            <h2>Frequently asked questions</h2>
            <p className="landing-section-lead">
              Quick answers about plans, security, and getting started.
            </p>
            <div className="faq-list landing-faq-list">
              {FAQ_ITEMS.map((item) => (
                <details key={item.q} className="faq-item">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
            <p className="landing-faq-more">
              Need more help? <Link href="/help">Visit the Help Center</Link> or{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`}>email support</a>.
            </p>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <div className="container app-footer-inner">
          <BrandLogo href="/" size="lg" />
          <span>© {new Date().getFullYear()} DocSolid</span>
          <nav className="app-footer-nav">
            <Link href="/help">Help</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`}>Support</a>
            <Link href="/legal/terms">Terms</Link>
            <Link href="/legal/privacy">Privacy</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card landing-stat-card">
      <div className="landing-stat-value">{value}</div>
      <div className="landing-stat-label">{label}</div>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
  pro,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  pro?: boolean;
}) {
  return (
    <div className="card landing-feature-card">
      <div className="landing-feature-icon-wrap">
        <span className="landing-feature-icon" aria-hidden>
          <Icon className="landing-feature-svg" />
        </span>
        {pro && <span className="landing-feature-pro">Pro</span>}
      </div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}
