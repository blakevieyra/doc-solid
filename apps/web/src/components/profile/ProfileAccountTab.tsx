"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useProfile } from "@/components/ProfileProvider";
import { getPlan } from "@/lib/subscription/plans";
import { getAccountAge, useDocumentStats } from "@/lib/account/stats";
import { DeleteDataModal } from "@/components/DeleteDataModal";
import type { ProfileType } from "@/lib/profile/types";

interface ProfileAccountTabProps {
  onNavigate: (tab: string) => void;
}

export function ProfileAccountTab({ onNavigate }: ProfileAccountTabProps) {
  const { profile, updateProfile } = useProfile();
  const { user, logout } = useAuth();
  const router = useRouter();
  const { count, loading } = useDocumentStats();
  const [showDelete, setShowDelete] = useState(false);

  const primaryEmail = user?.email || profile.account.email ||
    profile.business.email || profile.personal.email || profile.organization.email;

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <div className="profile-panel card">
      <h3 className="section-title">Account Overview</h3>
      <div className="account-stats-grid">
        <StatCard label="Documents saved" value={loading ? "…" : String(count)} />
        <StatCard label="Current plan" value={getPlan(profile.subscription.plan).name} />
        <StatCard label="Account age" value={getAccountAge(profile.createdAt)} />
        <StatCard label="Profile type" value={profile.profileType} />
      </div>

      <h3 className="section-title" style={{ marginTop: "2rem" }}>Manage Account</h3>
      <Field
        label="Display Name"
        value={profile.account.displayName}
        onChange={(v) => updateProfile({ account: { ...profile.account, displayName: v } })}
        help="Shown in the app header and document footers"
      />
      <Field
        label="Account Email"
        type="email"
        value={profile.account.email}
        onChange={(v) => updateProfile({ account: { ...profile.account, email: v } })}
        help="Used for billing, support replies, and share notifications"
      />
      <Field
        label="Account ID"
        value={profile.account.accountId}
        onChange={() => {}}
        readOnly
        help="Reference this ID when contacting support"
      />
      <div className="field-group">
        <label>Profile Type</label>
        <select
          value={profile.profileType}
          onChange={(e) => updateProfile({ profileType: e.target.value as ProfileType })}
        >
          <option value="business">Business</option>
          <option value="individual">Individual</option>
          <option value="organization">Organization</option>
          {profile.profileType === "mixed" && (
            <option value="mixed">Mixed (please choose one type)</option>
          )}
        </select>
      </div>
      <Field
        label="Timezone"
        value={profile.account.timezone}
        onChange={(v) => updateProfile({ account: { ...profile.account, timezone: v } })}
        as="select"
        options={[
          "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
          "America/Phoenix", "Pacific/Honolulu", "Europe/London", "Europe/Paris", "Asia/Tokyo", "Australia/Sydney",
        ]}
      />

      <h3 className="section-title" style={{ marginTop: "2rem" }}>Quick Actions</h3>
      <div className="quick-actions-grid">
        <button type="button" className="quick-action-card" onClick={() => onNavigate("billing")}>
          <strong>Subscription & Billing</strong>
          <span>View plan, upgrade, or manage payment</span>
        </button>
        <button type="button" className="quick-action-card" onClick={() => onNavigate("security")}>
          <strong>Security & Privacy</strong>
          <span>PIN lock, encryption, delete data</span>
        </button>
        <button type="button" className="quick-action-card" onClick={() => onNavigate("import")}>
          <strong>Import / Export Data</strong>
          <span>Backup or restore your profile</span>
        </button>
        <Link href="/onboarding" className="quick-action-card">
          <strong>Re-run Setup Wizard</strong>
          <span>Update profile, logo, and plan</span>
        </Link>
      </div>

      <h3 className="section-title" style={{ marginTop: "2rem" }}>Sign Out & Delete</h3>
      <p className="field-help" style={{ marginBottom: "1rem" }}>
        Signed in as <strong>{primaryEmail || "local account"}</strong>. Data is stored securely on this device.
      </p>
      <div className="account-danger-actions">
        <button type="button" className="btn btn-secondary" onClick={handleLogout}>
          Sign Out
        </button>
        <button type="button" className="btn btn-danger" onClick={() => setShowDelete(true)}>
          Delete All Data
        </button>
      </div>

      {showDelete && <DeleteDataModal onClose={() => setShowDelete(false)} />}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="account-stat-card">
      <span className="account-stat-value">{value}</span>
      <span className="account-stat-label">{label}</span>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", help, readOnly, as, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  help?: string;
  readOnly?: boolean;
  as?: "select";
  options?: string[];
}) {
  return (
    <div className="field-group">
      <label>{label}</label>
      {as === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options?.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} />
      )}
      {help && <span className="field-help">{help}</span>}
    </div>
  );
}
