import Link from "next/link";
import { CATALOG_STATS } from "@doc-solid/documents";
import { BrandLogo } from "@/components/BrandLogo";
import { LandingHeroIntro } from "@/components/landing/LandingHeroIntro";
import { LandingHeroCta } from "@/components/landing/LandingHeroCta";
import { LandingHeaderActions } from "@/components/landing/LandingHeaderActions";
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

function buildFeatures() {
  return [
    {
      icon: IconBuilder,
      title: "Custom Builder",
      desc: `Start from ${CATALOG_STATS.total}+ professional templates or build your own forms with text, dates, tables, line items, and signatures.`,
    },
    {
      icon: IconAutofill,
      title: "Auto-Fill Profile",
      desc: "Save business, personal, or organization info once — logo, address, and tax IDs flow into every document automatically.",
    },
    {
      icon: IconPdf,
      title: "Print, PDF & Email",
      desc: "Pro: clean, watermark-free PDFs, print-ready layouts, and email documents to clients or teammates — not just yourself.",
      pro: true,
    },
    {
      icon: IconTeam,
      title: "Team Sharing",
      desc: "Pro: invite colleagues, join multiple teams, send signature requests, and share completed files instantly.",
      pro: true,
    },
    {
      icon: IconShield,
      title: "AI Security Scan",
      desc: "Pro: scan for SSNs, tax IDs, and payment data locally in your browser — then redact before you share.",
      pro: true,
    },
    {
      icon: IconLock,
      title: "Security Center",
      desc: "AES-256-GCM encryption for sensitive profile fields, optional PIN lock, password management, and one-click delete-all-data.",
      encryption: true,
    },
    {
      icon: IconCloud,
      title: "Cloud + Local",
      desc: "Pro: sync documents and profile across devices with offline access — work locally, catch up when you're back online.",
      pro: true,
    },
    {
      icon: IconPackets,
      title: "Document Packets",
      desc: "Bundle related forms into packets — reorder items, export combined PDFs, and email the full set. Unlimited on Pro.",
    },
  ] as const;
}

export default function HomePage() {
  const monthly = getPlan("monthly");
  const yearly = getPlan("yearly");
  const features = buildFeatures();

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="container landing-header-inner">
          <BrandLogo href="/" size="sm" />
          <LandingHeaderActions />
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="container">
            <LandingHeroIntro />
            <h1>Professional documents<br />for your business</h1>
            <p>
              Build, fill, print, email, and save {CATALOG_STATS.total}+ document types.
              Cloud sync with offline access. Multi-user teams supported.
            </p>
            <LandingHeroCta />
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
              From {CATALOG_STATS.total}+ templates to AES-256-GCM encrypted profiles and Pro-only AI redaction —
              DocSolid keeps your workflow fast, shareable, and protected.
            </p>
            <div className="landing-features-grid">
              {features.map((f) => (
                <FeatureCard key={f.title} {...f} />
              ))}
            </div>
          </div>
        </section>

        <section className="landing-pricing">
          <div className="container landing-pricing-inner">
            <h2>Simple pricing</h2>
            <p>
              Free to start with watermarked PDFs. Pro unlocks clean exports, AI scan & redaction, team sharing,
              cloud sync, unlimited documents, and priority support.
            </p>
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
                <span>AI security scan · Clean PDFs · Team sharing · Cloud sync · Priority support</span>
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
  encryption,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  pro?: boolean;
  encryption?: boolean;
}) {
  return (
    <div className={`card landing-feature-card${encryption ? " landing-feature-card-encryption" : ""}`}>
      <div className="landing-feature-icon-wrap">
        <span className="landing-feature-icon" aria-hidden>
          <Icon className="landing-feature-svg" />
        </span>
        {pro && <span className="landing-feature-pro">Pro</span>}
        {encryption && <span className="landing-feature-encryption">AES-256</span>}
      </div>
      <h3>{title}</h3>
      <p>{desc}</p>
    </div>
  );
}
