"use client";

import { useRef, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { LogoUploader } from "@/components/LogoUploader";
import { ProfileLockScreen } from "@/components/AppGate";
import { SecurityCenter } from "@/components/SecurityCenter";
import { useProfile } from "@/components/ProfileProvider";
import type { Address } from "@/lib/profile/types";
import { sanitizeImportData } from "@/lib/profile/security";
import { PlanSelector, type PlanChoice } from "@/components/PlanSelector";
import { getPlan } from "@/lib/subscription/plans";
import { useSubscription } from "@/lib/subscription/useSubscription";
import type { SubscriptionPlan } from "@/lib/profile/types";
import { applySubscriptionFromStripe, fetchSubscriptionStatus } from "@/lib/stripe/sync-client";

import { ProfileAccountTab } from "@/components/profile/ProfileAccountTab";
import { ProfilePreferencesTab, ProfileSupportTab } from "@/components/profile/ProfilePreferencesTab";
import { useAuth } from "@/components/AuthProvider";
import { IndustrySelect, RecommendedDocuments } from "@/components/RecommendedDocuments";
import { OwnerSignatureSettings } from "@/components/SignatureField";
import {
  getRecommendedDocuments,
  getRecommendationHeading,
} from "@/lib/documents/recommendations";

type Tab = "account" | "business" | "personal" | "organization" | "preferences" | "billing" | "security" | "import" | "support";

const TABS: { id: Tab; label: string; group: string }[] = [
  { id: "account", label: "Account", group: "Account" },
  { id: "billing", label: "Billing", group: "Account" },
  { id: "support", label: "Support", group: "Account" },
  { id: "business", label: "Business", group: "Profiles" },
  { id: "personal", label: "Personal", group: "Profiles" },
  { id: "organization", label: "Organization", group: "Profiles" },
  { id: "preferences", label: "Preferences", group: "Settings" },
  { id: "security", label: "Security", group: "Settings" },
  { id: "import", label: "Import", group: "Settings" },
];

export default function ProfilePage() {
  const { profile, updateProfile, exportData, importData, importCsv, locked } = useProfile();
  const { session } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("account");

  useEffect(() => {
    const t = searchParams?.get("tab");
    if (t === "team") {
      router.replace("/team");
      return;
    }
    if (t && TABS.some((x) => x.id === t)) setTab(t as Tab);
  }, [searchParams, router]);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [billingChoice, setBillingChoice] = useState<SubscriptionPlan | null>(null);
  const [billingUpdating, setBillingUpdating] = useState(false);
  const [billingRefreshing, setBillingRefreshing] = useState(false);
  const [billingMsg, setBillingMsg] = useState("");
  const { effective } = useSubscription();

  const { plan, status } = profile.subscription;
  const checkoutPlan = billingChoice ?? plan;
  const currentPaidPlan: SubscriptionPlan = effective.isProActive
    ? profile.subscription.plan === "yearly"
      ? "yearly"
      : "monthly"
    : "free";
  const planChangeTarget = checkoutPlan;
  const wantsPlanChange =
    effective.isProActive &&
    planChangeTarget !== null &&
    planChangeTarget !== currentPaidPlan;

  async function openBillingPortal() {
    const res = await fetch("/api/stripe/portal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: profile.subscription.stripeCustomerId,
        email: profile.account.email || session?.email || profile.business.email || profile.personal.email,
        returnUrl: `${window.location.origin}/profile?tab=billing`,
      }),
    });
    const data = await res.json() as { url?: string; error?: string };
    if (data.url) window.location.href = data.url;
    else alert(data.error ?? "Billing portal unavailable");
  }

  async function handleUpdatePlan() {
    if (planChangeTarget === "free") {
      await openBillingPortal();
      return;
    }
    if (!profile.subscription.stripeCustomerId) {
      setBillingMsg("No billing account found. Contact support.");
      return;
    }
    setBillingUpdating(true);
    setBillingMsg("");
    try {
      const res = await fetch("/api/stripe/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: planChangeTarget,
          customerId: profile.subscription.stripeCustomerId,
          subscriptionId: profile.subscription.stripeSubscriptionId,
          email: profile.account.email || session?.email || profile.business.email || profile.personal.email,
        }),
      });
      const data = await res.json() as {
        error?: string;
        message?: string;
        subscription?: {
          plan: SubscriptionPlan;
          status: typeof profile.subscription.status;
          currentPeriodEnd?: string;
          stripeCustomerId: string;
          stripeSubscriptionId: string;
        };
      };
      if (!res.ok) {
        setBillingMsg(data.error ?? "Could not update plan.");
        return;
      }
      if (data.subscription) {
        await updateProfile({
          subscription: {
            ...profile.subscription,
            plan: data.subscription.plan,
            status: data.subscription.status,
            currentPeriodEnd: data.subscription.currentPeriodEnd,
            stripeCustomerId: data.subscription.stripeCustomerId,
            stripeSubscriptionId: data.subscription.stripeSubscriptionId,
          },
        });
        setBillingChoice(null);
      }
      setBillingMsg(data.message ?? "Plan updated.");
    } catch {
      setBillingMsg("Could not update plan. Try Manage Subscription & Payment.");
    } finally {
      setBillingUpdating(false);
    }
  }

  async function refreshBillingStatus() {
    const email = profile.account.email || session?.email || profile.business.email || profile.personal.email;
    if (!email && !profile.subscription.stripeCustomerId) {
      setBillingMsg("Add an account email to refresh billing status.");
      return;
    }
    setBillingRefreshing(true);
    setBillingMsg("");
    try {
      const result = await fetchSubscriptionStatus({
        customerId: profile.subscription.stripeCustomerId,
        email,
      });
      const resolved = result?.subscription ?? { plan: "free" as const, status: "none" as const };
      await updateProfile({
        subscription: applySubscriptionFromStripe(profile.subscription, resolved),
      });
      setBillingChoice(null);
      setBillingMsg(
        resolved.plan === "free"
          ? "Billing synced with Stripe — you are on the Free plan."
          : "Billing synced with Stripe — your plan is up to date."
      );
    } catch {
      setBillingMsg("Could not refresh billing status. Try again in a moment.");
    } finally {
      setBillingRefreshing(false);
    }
  }

  const recommended = getRecommendedDocuments(
    profile.profileType,
    profile.business.industry || undefined
  );
  const recHeading = getRecommendationHeading(
    profile.profileType,
    profile.business.industry || undefined
  );

  function handleExport() {
    const blob = new Blob([exportData()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `doc-solid-profile-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleJsonImport(file: File) {
    const text = await file.text();
    try {
      const raw = JSON.parse(text);
      if (!sanitizeImportData(raw)) throw new Error("Invalid file");
      await importData(text);
      setImportMsg("Profile imported successfully");
    } catch {
      setImportMsg("Invalid JSON profile file");
    }
  }

  async function handleCsvImport(file: File) {
    const text = await file.text();
    await importCsv(text);
    setImportMsg("CSV data imported successfully");
  }

  return (
    <>
      <ProfileLockScreen />
      {!locked && (
        <AppShell title="Profile & Settings">
          <p className="page-lead">
            Manage your account, profiles, preferences, billing, and support.
          </p>

          <div className="profile-tab-groups">
            {["Account", "Profiles", "Settings"].map((group) => (
              <div key={group} className="profile-tab-group">
                <span className="profile-tab-group-label">{group}</span>
                <div className="profile-tabs">
                  {TABS.filter((t) => t.group === group).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`profile-tab${tab === t.id ? " active" : ""}`}
                      onClick={() => setTab(t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {tab === "account" && (
            <ProfileAccountTab onNavigate={(t) => setTab(t as Tab)} />
          )}

          {tab === "preferences" && <ProfilePreferencesTab />}

          {tab === "support" && <ProfileSupportTab />}

          {tab === "business" && (
            <div className="profile-panel card">
              <LogoUploader
                value={profile.business.logo}
                onChange={(logo) => updateProfile({ business: { ...profile.business, logo } })}
              />
              <Field label="Business Name" value={profile.business.name} onChange={(v) => updateProfile({ business: { ...profile.business, name: v } })} />
              <Field label="Tagline" value={profile.business.tagline} onChange={(v) => updateProfile({ business: { ...profile.business, tagline: v } })} />
              <IndustrySelect
                value={profile.business.industry}
                onChange={(v) => updateProfile({ business: { ...profile.business, industry: v } })}
              />
              {recommended.length > 0 && (
                <RecommendedDocuments
                  documents={recommended}
                  heading={recHeading}
                  subtitle="Update your industry above to refresh these suggestions."
                  compact
                />
              )}
              <Field label="Email" type="email" value={profile.business.email} onChange={(v) => updateProfile({ business: { ...profile.business, email: v } })} />
              <Field label="Phone" type="tel" value={profile.business.phone} onChange={(v) => updateProfile({ business: { ...profile.business, phone: v } })} />
              <Field label="Website" value={profile.business.website} onChange={(v) => updateProfile({ business: { ...profile.business, website: v } })} />
              <Field label="Tax ID / EIN" value={profile.business.taxId} onChange={(v) => updateProfile({ business: { ...profile.business, taxId: v } })} sensitive />
              <AddressBlock label="Business Address" address={profile.business.address} onChange={(a) => updateProfile({ business: { ...profile.business, address: a } })} />
            </div>
          )}

          {tab === "personal" && (
            <div className="profile-panel card">
              <LogoUploader
                label="Profile Photo (optional)"
                value={profile.personal.photo}
                onChange={(photo) => updateProfile({ personal: { ...profile.personal, photo } })}
              />
              <Field label="Full Name" value={profile.personal.fullName} onChange={(v) => updateProfile({ personal: { ...profile.personal, fullName: v } })} />
              <Field label="Username (optional)" value={profile.personal.username} onChange={(v) => updateProfile({ personal: { ...profile.personal, username: v.replace(/^@/, "") } })} />
              <p className="field-help">Teammates see @username when adding or searching for you</p>
              <Field label="Professional Title" value={profile.personal.title} onChange={(v) => updateProfile({ personal: { ...profile.personal, title: v } })} />
              <Field label="Email" type="email" value={profile.personal.email} onChange={(v) => updateProfile({ personal: { ...profile.personal, email: v } })} />
              <Field label="Phone" type="tel" value={profile.personal.phone} onChange={(v) => updateProfile({ personal: { ...profile.personal, phone: v } })} />
              <Field label="LinkedIn" value={profile.personal.linkedin} onChange={(v) => updateProfile({ personal: { ...profile.personal, linkedin: v } })} />
              <AddressBlock label="Personal Address" address={profile.personal.address} onChange={(a) => updateProfile({ personal: { ...profile.personal, address: a } })} />
              <OwnerSignatureSettings
                profile={profile}
                onChange={(signature) => updateProfile({ signature })}
              />
            </div>
          )}

          {tab === "organization" && (
            <div className="profile-panel card">
              <LogoUploader
                label="Organization Logo"
                value={profile.organization.logo}
                onChange={(logo) => updateProfile({ organization: { ...profile.organization, logo } })}
              />
              <Field label="Organization Name" value={profile.organization.name} onChange={(v) => updateProfile({ organization: { ...profile.organization, name: v } })} />
              <TextField label="Mission Statement" value={profile.organization.mission} onChange={(v) => updateProfile({ organization: { ...profile.organization, mission: v } })} />
              <Field label="Email" type="email" value={profile.organization.email} onChange={(v) => updateProfile({ organization: { ...profile.organization, email: v } })} />
              <Field label="Phone" type="tel" value={profile.organization.phone} onChange={(v) => updateProfile({ organization: { ...profile.organization, phone: v } })} />
              <Field label="Website" value={profile.organization.website} onChange={(v) => updateProfile({ organization: { ...profile.organization, website: v } })} />
              <Field label="Tax ID / EIN" value={profile.organization.taxId} onChange={(v) => updateProfile({ organization: { ...profile.organization, taxId: v } })} sensitive />
              <AddressBlock label="Organization Address" address={profile.organization.address} onChange={(a) => updateProfile({ organization: { ...profile.organization, address: a } })} />
            </div>
          )}

          {tab === "billing" && (
            <div className="profile-panel card">
              <h3 className="section-title">Current Plan</h3>
              <div className="billing-current">
                <strong>{effective.billingLabel}</strong>
                <span className={`billing-status billing-status-${effective.status}`}>
                  {effective.isProActive ? effective.status : status === "pending" ? "Pending checkout" : "Free tier"}
                </span>
                {profile.subscription.currentPeriodEnd && effective.isProActive && (
                  <p className="field-help">
                    {status === "canceled" ? "Access until" : "Renews"}{" "}
                    {new Date(profile.subscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
                {!effective.isProActive && (
                  <p className="field-help">
                    Free: 10 docs/month, watermarked PDFs, 20 favorites, 3 packets. Pro unlocks unlimited docs, clean PDFs, AI scan, and team sharing.
                  </p>
                )}
              </div>
              <h3 className="section-title" style={{ marginTop: "2rem" }}>Change Plan</h3>
              <PlanSelector
                selected={checkoutPlan}
                subscription={profile.subscription}
                showStatus
                onSelect={(p: PlanChoice) => {
                  if (p === "enterprise") return;
                  setBillingChoice(p);
                  setBillingMsg("");
                  if (p === "free" && !effective.isProActive) {
                    void updateProfile({
                      subscription: { ...profile.subscription, plan: "free", status: "none" },
                    });
                  }
                }}
              />

              <div className="billing-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={billingRefreshing}
                  onClick={() => void refreshBillingStatus()}
                >
                  {billingRefreshing ? "Syncing with Stripe…" : "Refresh billing status"}
                </button>
                {effective.isProActive && wantsPlanChange && planChangeTarget !== "free" && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={billingUpdating}
                    onClick={() => void handleUpdatePlan()}
                  >
                    {billingUpdating
                      ? "Updating plan…"
                      : `Update plan — ${getPlan(planChangeTarget!).name} ($${getPlan(planChangeTarget!).price}/${getPlan(planChangeTarget!).interval === "year" ? "yr" : "mo"})`}
                  </button>
                )}
                {effective.isProActive && planChangeTarget === "free" && (
                  <>
                    <p className="field-help">
                      To cancel Pro and return to Free, open the billing portal and cancel your subscription.
                    </p>
                    <button type="button" className="btn btn-secondary" onClick={() => void openBillingPortal()}>
                      Cancel Pro subscription
                    </button>
                  </>
                )}
                {effective.isProActive && !wantsPlanChange && (
                  <p className="field-help">
                    Select a different plan above, then click <strong>Update plan</strong> to switch billing.
                  </p>
                )}
                {checkoutPlan === "free" && !effective.isProActive && (
                  <p className="field-help">You are on the Free plan.</p>
                )}
                {checkoutPlan !== "free" && !effective.isProActive && (
                  <button type="button" className="btn btn-primary" onClick={async () => {
                    const baseUrl = window.location.origin;
                    const res = await fetch("/api/stripe/checkout", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        plan: checkoutPlan,
                        email: profile.business.email || profile.personal.email || profile.account.email || session?.email,
                        userId: session?.userId,
                        successUrl: `${baseUrl}/onboarding/success?plan=${checkoutPlan}&session_id={CHECKOUT_SESSION_ID}`,
                        cancelUrl: `${baseUrl}/profile?tab=billing`,
                      }),
                    });
                    const data = await res.json() as { url?: string; error?: string };
                    if (data.url) window.location.href = data.url;
                    else alert(data.error ?? "Checkout unavailable");
                  }}>
                    Subscribe to {getPlan(checkoutPlan).name} — ${getPlan(checkoutPlan).price}/{getPlan(checkoutPlan).interval === "year" ? "yr" : "mo"}
                  </button>
                )}
                {profile.subscription.stripeCustomerId && effective.isProActive && (
                  <button type="button" className="btn btn-secondary" onClick={() => void openBillingPortal()}>
                    Manage payment method & invoices
                  </button>
                )}
              </div>
              {billingMsg && (
                <p className={billingMsg.toLowerCase().includes("updated") || billingMsg.toLowerCase().includes("already") || billingMsg.toLowerCase().includes("synced") ? "field-success" : "field-error"} style={{ marginTop: "0.75rem" }}>
                  {billingMsg}
                </p>
              )}
            </div>
          )}

          {tab === "security" && (
            <div className="profile-panel card">
              <SecurityCenter />
            </div>
          )}

          {tab === "import" && (
            <div className="profile-panel card">
              <h3 className="section-title">Import Information</h3>
              <p className="field-help" style={{ marginBottom: "1rem" }}>
                Import profile data from a JSON export or CSV file with field,value rows.
              </p>
              <div className="import-actions">
                <div className="import-block">
                  <strong>JSON Profile</strong>
                  <p className="field-help">Full profile export from Doc Solid or compatible JSON</p>
                  <button type="button" className="btn btn-secondary" onClick={() => fileRef.current?.click()}>Choose JSON File</button>
                  <input ref={fileRef} type="file" accept=".json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleJsonImport(f); }} />
                </div>
                <div className="import-block">
                  <strong>CSV Spreadsheet</strong>
                  <p className="field-help">Format: field,value — e.g. business.name,Acme Corp</p>
                  <button type="button" className="btn btn-secondary" onClick={() => csvRef.current?.click()}>Choose CSV File</button>
                  <input ref={csvRef} type="file" accept=".csv,.txt" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvImport(f); }} />
                </div>
              </div>
              {importMsg && <p className="import-msg">{importMsg}</p>}

              <h3 className="section-title" style={{ marginTop: "2rem" }}>Export</h3>
              <button type="button" className="btn btn-secondary" onClick={handleExport}>Download Profile JSON</button>

              <div className="csv-template" style={{ marginTop: "1.5rem" }}>
                <strong>CSV field names</strong>
                <code>business.name, business.email, business.phone, business.taxid, personal.fullname, personal.email, organization.name</code>
              </div>
            </div>
          )}

        </AppShell>
      )}
    </>
  );
}

function Field({ label, value, onChange, type = "text", sensitive }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; sensitive?: boolean;
}) {
  return (
    <div className="field-group">
      <label>{label}{sensitive && " 🔒"}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field-group">
      <label>{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function AddressBlock({ label, address, onChange }: { label: string; address: Address; onChange: (a: Address) => void }) {
  const set = (key: keyof Address, val: string) => onChange({ ...address, [key]: val });
  return (
    <fieldset className="address-block">
      <legend>{label}</legend>
      <Field label="Street" value={address.street} onChange={(v) => set("street", v)} />
      <div className="address-row">
        <Field label="City" value={address.city} onChange={(v) => set("city", v)} />
        <Field label="State" value={address.state} onChange={(v) => set("state", v)} />
        <Field label="ZIP" value={address.zip} onChange={(v) => set("zip", v)} />
      </div>
      <Field label="Country" value={address.country} onChange={(v) => set("country", v)} />
    </fieldset>
  );
}
