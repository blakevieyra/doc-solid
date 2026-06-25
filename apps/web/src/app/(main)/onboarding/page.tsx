"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/components/ProfileProvider";
import { useAuth } from "@/components/AuthProvider";
import { LogoUploader } from "@/components/LogoUploader";
import type { ProfileType, Address, UserProfile } from "@/lib/profile/types";
import { PlanSelector, type PlanChoice } from "@/components/PlanSelector";
import { getPlan } from "@/lib/subscription/plans";
import { SALES_EMAIL } from "@/lib/support/config";
import { RecommendedDocuments, IndustrySelect } from "@/components/RecommendedDocuments";
import { buildPreferredProfilePatch } from "@/components/profile/ProfilePreferredBanner";
import { DeferredTextInput, DeferredTextArea } from "@/components/profile/DeferredTextInput";
import {
  getRecommendedDocuments,
  getRecommendationHeading,
  getIndustryLabel,
} from "@/lib/documents/recommendations";

const STEPS = ["Welcome", "Profile Type", "Your Info", "Logo & Brand", "Security", "Choose Plan", "Complete"] as const;
const STEP_STORAGE_KEY = "doc-solid-onboarding-step";

function readStoredStep(): number {
  if (typeof window === "undefined") return 0;
  const raw = sessionStorage.getItem(STEP_STORAGE_KEY);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n >= 0 && n < STEPS.length ? n : 0;
}

function validateInfoStep(profileType: ProfileType, profile: UserProfile): string | null {
  if (profileType === "business") {
    if (!profile.business.name.trim()) return "Business name is required.";
    if (!profile.business.industry) return "Please select your industry.";
  }
  if (profileType === "individual") {
    if (!profile.personal.fullName.trim()) return "Full name is required.";
  }
  if (profileType === "organization") {
    if (!profile.organization.name.trim()) return "Organization name is required.";
  }
  return null;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { profile, updateProfile, completeOnboarding, setPin } = useProfile();
  const { session } = useAuth();
  const [step, setStep] = useState(0);
  const [selectedProfileType, setSelectedProfileType] = useState<ProfileType>(profile.profileType);
  const [pin, setPinValue] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinError, setPinError] = useState("");
  const [stepError, setStepError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enablePin, setEnablePin] = useState(true);

  useEffect(() => {
    setStep(readStoredStep());
  }, []);

  useEffect(() => {
    sessionStorage.setItem(STEP_STORAGE_KEY, String(step));
  }, [step]);

  useEffect(() => {
    setSelectedProfileType(profile.profileType);
  }, [profile.profileType]);

  useEffect(() => {
    if (!session?.name) return;
    if (profile.personal.fullName || profile.business.name || profile.organization.name) return;
    void updateProfile({
      personal: { ...profile.personal, fullName: session.name },
      account: { ...profile.account, displayName: session.name },
    });
  }, [session?.name]); // eslint-disable-line react-hooks/exhaustive-deps -- seed name once from auth

  const [planChoice, setPlanChoice] = useState<PlanChoice>("free");

  useEffect(() => {
    setPlanChoice(profile.subscription.plan);
  }, [profile.subscription.plan]);

  const selectedPlan = profile.subscription.plan;
  const recommended = getRecommendedDocuments(selectedProfileType, profile.business.industry || undefined);
  const recHeading = getRecommendationHeading(selectedProfileType, profile.business.industry || undefined);

  function clearOnboardingProgress() {
    sessionStorage.removeItem(STEP_STORAGE_KEY);
  }

  async function goToStep(next: number) {
    setStepError("");
    setStep(next);
  }

  async function confirmProfileType() {
    setStepError("");
    setSaving(true);
    try {
      const section =
        selectedProfileType === "individual"
          ? "individual"
          : selectedProfileType === "organization"
            ? "organization"
            : "business";
      await updateProfile(buildPreferredProfilePatch(profile, section));
      await goToStep(2);
    } catch {
      setStepError("Could not save your selection. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmInfoStep() {
    const err = validateInfoStep(selectedProfileType, profile);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError("");
    await goToStep(3);
  }

  async function applyPinIfNeeded() {
    if (enablePin && pin) {
      const normalized = pin.trim();
      const normalizedConfirm = pinConfirm.trim();
      if (normalized.length < 4) {
        setPinError("PIN must be at least 4 characters");
        return false;
      }
      if (normalized !== normalizedConfirm) {
        setPinError("PINs do not match");
        return false;
      }
      await setPin(normalized);
    }
    setPinError("");
    return true;
  }

  async function finishFree() {
    if (!(await applyPinIfNeeded())) return;
    setSaving(true);
    try {
      await updateProfile({
        subscription: { ...profile.subscription, plan: "free", status: "none", startedAt: new Date().toISOString() },
      });
      await completeOnboarding();
      clearOnboardingProgress();
      router.push("/documents");
    } catch {
      setStepError("Could not finish setup. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function finishPaid() {
    if (!(await applyPinIfNeeded())) return;
    setCheckingOut(true);
    setCheckoutError("");

    const email = profile.business.email || profile.personal.email || profile.organization.email || session?.email;
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          email,
          userId: session?.userId,
          successUrl: `${baseUrl}/onboarding/success?plan=${selectedPlan}&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${baseUrl}/onboarding`,
        }),
      });
      const data = await res.json() as { url?: string; error?: string };

      if (data.url) {
        await updateProfile({
          subscription: { ...profile.subscription, plan: selectedPlan, status: "pending" },
        });
        window.location.href = data.url;
        return;
      }

      setCheckoutError(data.error ?? "Unable to start checkout. You can continue with the Free plan.");
    } catch {
      setCheckoutError("Payment service unavailable. Continue with the Free plan or try again later.");
    } finally {
      setCheckingOut(false);
    }
  }

  function selectPlan(plan: PlanChoice) {
    setPlanChoice(plan);
    if (plan === "enterprise") return;
    if (plan === "free") {
      void updateProfile({ subscription: { ...profile.subscription, plan: "free", status: "none" } });
      return;
    }
    void updateProfile({ subscription: { ...profile.subscription, plan, status: "none" } });
  }

  return (
    <div className="onboarding">
      <div className={`onboarding-card${step === 5 || step === 6 ? " onboarding-card-wide" : ""}`}>
        <div className="onboarding-progress">
          {STEPS.map((label, i) => (
            <div key={label} className={`onboarding-step${i <= step ? " active" : ""}${i < step ? " done" : ""}`}>
              <span className="onboarding-step-num">{i < step ? "✓" : i + 1}</span>
              <span className="onboarding-step-label">{label}</span>
            </div>
          ))}
        </div>

        {stepError && <p className="field-error onboarding-step-error">{stepError}</p>}

        {step === 0 && (
          <div className="onboarding-content">
            <h1>Welcome to DocSolid</h1>
            <p className="onboarding-lead">
              Set up your profile once — we&apos;ll auto-fill invoices, contracts, forms, and reports across 120+ document types.
            </p>
            <ul className="onboarding-features">
              <li>Save business, personal, or organization details</li>
              <li>Upload your logo for professional letterhead</li>
              <li>Import existing info from JSON or CSV</li>
              <li>Encrypt sensitive data like Tax ID locally</li>
            </ul>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => void goToStep(1)}>Get Started</button>
          </div>
        )}

        {step === 1 && (
          <div className="onboarding-content">
            <h1>What describes you best?</h1>
            <p className="onboarding-lead">We&apos;ll tailor templates and auto-fill fields to your needs.</p>
            <div className="profile-type-grid">
              {([
                { id: "business" as ProfileType, title: "Business", desc: "Invoices, contracts, HR, operations" },
                { id: "individual" as ProfileType, title: "Individual", desc: "Resume, lease, personal finance" },
                { id: "organization" as ProfileType, title: "Organization", desc: "Nonprofits, clubs, associations" },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`profile-type-card${selectedProfileType === opt.id ? " selected" : ""}`}
                  onClick={() => {
                    setSelectedProfileType(opt.id);
                    setStepError("");
                  }}
                  disabled={saving}
                >
                  <strong>{opt.title}</strong>
                  <span>{opt.desc}</span>
                </button>
              ))}
            </div>
            <div className="onboarding-actions">
              <button type="button" className="btn btn-secondary" onClick={() => void goToStep(0)} disabled={saving}>Back</button>
              <button type="button" className="btn btn-primary" onClick={() => void confirmProfileType()} disabled={saving}>
                {saving ? "Saving…" : "Continue"}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-content">
            <h1>Your information</h1>
            <p className="onboarding-lead">This auto-fills across all your documents. You can edit anytime in Profile.</p>
            <div className="onboarding-form-grid">
              {selectedProfileType === "business" && (
                <FormBlock title="Business">
                  <Input label="Business Name *" value={profile.business.name} onChange={(v) => updateProfile({ business: { ...profile.business, name: v } })} />
                  <IndustrySelect
                    label="Industry *"
                    required
                    value={profile.business.industry}
                    onChange={(v) => updateProfile({ business: { ...profile.business, industry: v } })}
                  />
                  <Input label="Email" type="email" value={profile.business.email} onChange={(v) => updateProfile({ business: { ...profile.business, email: v } })} />
                  <Input label="Phone" type="tel" value={profile.business.phone} onChange={(v) => updateProfile({ business: { ...profile.business, phone: v } })} />
                  <Input label="Tax ID / EIN" value={profile.business.taxId} onChange={(v) => updateProfile({ business: { ...profile.business, taxId: v } })} sensitive />
                  <AddressFields address={profile.business.address} onChange={(a) => updateProfile({ business: { ...profile.business, address: a } })} />
                </FormBlock>
              )}
              {selectedProfileType === "individual" && (
                <FormBlock title="Personal">
                  <Input label="Full Name *" value={profile.personal.fullName} onChange={(v) => updateProfile({ personal: { ...profile.personal, fullName: v } })} />
                  <Input label="Username (optional)" value={profile.personal.username} transform={(v) => v.replace(/^@/, "")} onChange={(v) => updateProfile({ personal: { ...profile.personal, username: v } })} />
                  <p className="field-help">Shown when teammates search for you (@handle)</p>
                  <Input label="Professional Title" value={profile.personal.title} onChange={(v) => updateProfile({ personal: { ...profile.personal, title: v } })} />
                  <Input label="Email" type="email" value={profile.personal.email} onChange={(v) => updateProfile({ personal: { ...profile.personal, email: v } })} />
                  <Input label="Phone" type="tel" value={profile.personal.phone} onChange={(v) => updateProfile({ personal: { ...profile.personal, phone: v } })} />
                  <AddressFields address={profile.personal.address} onChange={(a) => updateProfile({ personal: { ...profile.personal, address: a } })} />
                </FormBlock>
              )}
              {selectedProfileType === "organization" && (
                <FormBlock title="Organization">
                  <Input label="Organization Name *" value={profile.organization.name} onChange={(v) => updateProfile({ organization: { ...profile.organization, name: v } })} />
                  <Textarea label="Mission Statement" value={profile.organization.mission} onChange={(v) => updateProfile({ organization: { ...profile.organization, mission: v } })} />
                  <Input label="Email" type="email" value={profile.organization.email} onChange={(v) => updateProfile({ organization: { ...profile.organization, email: v } })} />
                  <Input label="Tax ID / EIN" value={profile.organization.taxId} onChange={(v) => updateProfile({ organization: { ...profile.organization, taxId: v } })} sensitive />
                </FormBlock>
              )}
            </div>
            {recommended.length > 0 && (
              <RecommendedDocuments
                documents={recommended}
                heading={recHeading}
                subtitle="These templates are commonly used for your profile type — start with any of them."
                compact
              />
            )}
            <div className="onboarding-actions">
              <button type="button" className="btn btn-secondary" onClick={() => void goToStep(1)}>Back</button>
              <button type="button" className="btn btn-primary" onClick={() => void confirmInfoStep()}>Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-content">
            <h1>Logo & brand</h1>
            <p className="onboarding-lead">Your logo appears on invoices, proposals, and letterhead documents.</p>
            <div className="onboarding-logo-section">
              <LogoUploader
                label="Business / Organization Logo"
                value={profile.business.logo ?? profile.organization.logo}
                onChange={(logo) => {
                  updateProfile({
                    business: { ...profile.business, logo },
                    organization: { ...profile.organization, logo },
                  });
                }}
              />
              <Input
                label="Tagline (optional)"
                value={profile.business.tagline}
                onChange={(v) => updateProfile({ business: { ...profile.business, tagline: v } })}
                placeholder="e.g. Quality service since 2010"
              />
              <Input
                label="Website"
                value={profile.business.website || profile.organization.website}
                onChange={(v) => updateProfile({
                  business: { ...profile.business, website: v },
                  organization: { ...profile.organization, website: v },
                })}
                placeholder="https://"
              />
            </div>
            <div className="onboarding-actions">
              <button type="button" className="btn btn-secondary" onClick={() => void goToStep(2)}>Back</button>
              <button type="button" className="btn btn-primary" onClick={() => void goToStep(4)}>Continue</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="onboarding-content">
            <h1>Protect your information</h1>
            <p className="onboarding-lead">Sensitive fields like Tax ID are encrypted locally on your device. Optional PIN adds an extra layer.</p>
            <div className="security-options">
              <label className="security-toggle">
                <input type="checkbox" checked={profile.security.encryptSensitive} onChange={(e) => updateProfile({ security: { ...profile.security, encryptSensitive: e.target.checked } })} />
                <div>
                  <strong>Encrypt sensitive data</strong>
                  <span>Tax IDs and similar fields are encrypted in local storage</span>
                </div>
              </label>
              <label className="security-toggle">
                <input type="checkbox" checked={enablePin} onChange={(e) => setEnablePin(e.target.checked)} />
                <div>
                  <strong>Set a PIN to unlock profile</strong>
                  <span>Required to view or edit sensitive information</span>
                </div>
              </label>
              {enablePin && (
                <div className="pin-fields">
                  <Input label="Create PIN" type="password" value={pin} onChange={setPinValue} />
                  <Input label="Confirm PIN" type="password" value={pinConfirm} onChange={setPinConfirm} />
                  {pinError && <p className="field-error">{pinError}</p>}
                </div>
              )}
              <div className="security-notice">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                <p>Your data stays on your device until you choose to sync to the cloud. We never sell your information.</p>
              </div>
            </div>
            <div className="onboarding-actions">
              <button type="button" className="btn btn-secondary" onClick={() => void goToStep(3)}>Back</button>
              <button type="button" className="btn btn-primary" onClick={() => void goToStep(5)}>Continue</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="onboarding-content">
            <h1>Choose your plan</h1>
            <p className="onboarding-lead">
              Start free, unlock Pro, or contact us for Enterprise — unlimited documents, clean PDFs, and team sharing.
            </p>
            <PlanSelector
              selected={planChoice}
              onSelect={selectPlan}
              subscription={profile.subscription}
              showStatus
              includeEnterprise
            />
            <div className="onboarding-actions">
              <button type="button" className="btn btn-secondary" onClick={() => void goToStep(4)}>Back</button>
              <button type="button" className="btn btn-primary" onClick={() => void goToStep(6)}>Continue</button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="onboarding-content onboarding-complete">
            <div className="complete-icon">✓</div>
            <h1>You&apos;re all set!</h1>
            <p className="onboarding-lead">
              {profile.business.name || profile.personal.fullName || profile.organization.name
                ? `Profile saved for ${profile.business.name || profile.personal.fullName || profile.organization.name}.`
                : "Your profile is ready."}
            </p>
            <div className="plan-summary card" style={{ padding: "1.25rem", marginBottom: "1.5rem", textAlign: "left" }}>
              <strong>
                Selected plan:{" "}
                {planChoice === "enterprise" ? "Enterprise" : getPlan(selectedPlan).name}
              </strong>
              <p className="field-help" style={{ marginTop: "0.35rem" }}>
                {planChoice === "enterprise"
                  ? "Custom pricing for larger teams — SSO, unlimited seats, dedicated support, and invoice billing."
                  : selectedPlan === "free"
                    ? "Free forever — 10 documents/month with watermarked PDFs"
                    : `$${getPlan(selectedPlan).price}/${getPlan(selectedPlan).interval === "year" ? "year" : "month"} — unlimited documents & team sharing`}
              </p>
              {profile.business.industry && (
                <p className="field-help" style={{ marginTop: "0.35rem" }}>
                  Industry: {getIndustryLabel(profile.business.industry)}
                </p>
              )}
            </div>
            {recommended.length > 0 && (
              <RecommendedDocuments
                documents={recommended}
                heading="Your recommended documents"
                subtitle="We'll surface these first in your library after setup."
                compact
              />
            )}
            {checkoutError && <p className="field-error" style={{ marginBottom: "1rem" }}>{checkoutError}</p>}
            {stepError && <p className="field-error" style={{ marginBottom: "1rem" }}>{stepError}</p>}
            <div className="onboarding-actions" style={{ justifyContent: "center", flexWrap: "wrap" }}>
              {planChoice === "enterprise" ? (
                <>
                  <a
                    href={`mailto:${SALES_EMAIL}?subject=DocSolid%20Enterprise%20inquiry&body=Hi%2C%20I%27d%20like%20to%20learn%20more%20about%20Enterprise%20pricing.`}
                    className="btn btn-primary btn-lg"
                  >
                    Contact Sales
                  </a>
                  <button type="button" className="btn btn-secondary" onClick={() => void finishFree()} disabled={saving || checkingOut}>
                    {saving ? "Finishing…" : "Start Free for Now"}
                  </button>
                </>
              ) : selectedPlan === "free" ? (
                <button type="button" className="btn btn-primary btn-lg" onClick={() => void finishFree()} disabled={saving || checkingOut}>
                  {saving ? "Finishing…" : "Start Free"}
                </button>
              ) : (
                <>
                  <button type="button" className="btn btn-primary btn-lg" onClick={() => void finishPaid()} disabled={checkingOut || saving}>
                    {checkingOut ? "Redirecting to checkout..." : `Subscribe — $${getPlan(selectedPlan).price}/${getPlan(selectedPlan).interval === "year" ? "yr" : "mo"}`}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => void finishFree()} disabled={checkingOut || saving}>Continue Free Instead</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FormBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="form-block"><h3>{title}</h3>{children}</div>;
}

function Input({
  label, value, onChange, type = "text", placeholder, sensitive, transform,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; sensitive?: boolean;
  transform?: (v: string) => string;
}) {
  return (
    <div className="field-group">
      <label>{label}{sensitive && <span className="field-sensitive-tag">Encrypted</span>}</label>
      <DeferredTextInput
        type={type}
        value={value}
        onCommit={onChange}
        placeholder={placeholder}
        transform={transform}
      />
    </div>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field-group">
      <label>{label}</label>
      <DeferredTextArea value={value} onCommit={onChange} />
    </div>
  );
}

function AddressFields({ address, onChange }: { address: Address; onChange: (a: Address) => void }) {
  const set = (key: keyof Address, val: string) => onChange({ ...address, [key]: val });
  return (
    <div className="address-fields">
      <Input label="Street Address" value={address.street} onChange={(v) => set("street", v)} />
      <div className="address-row">
        <Input label="City" value={address.city} onChange={(v) => set("city", v)} />
        <Input label="State" value={address.state} onChange={(v) => set("state", v)} />
        <Input label="ZIP" value={address.zip} onChange={(v) => set("zip", v)} />
      </div>
    </div>
  );
}
