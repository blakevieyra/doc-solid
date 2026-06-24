"use client";

import { useState } from "react";
import Link from "next/link";
import { useProfile } from "@/components/ProfileProvider";
import { FAQ_ITEMS, SUPPORT_CATEGORIES, SUPPORT_EMAIL, CURRENCIES } from "@/lib/support/config";

export function ProfilePreferencesTab() {
  const { profile, updateProfile } = useProfile();
  const prefs = profile.preferences;

  return (
    <div className="profile-panel card">
      <h3 className="section-title">Document Defaults</h3>
      <p className="field-help" style={{ marginBottom: "1.25rem" }}>
        These settings auto-fill new documents and templates.
      </p>

      <div className="field-group">
        <label>Default Currency</label>
        <select
          value={prefs.currency}
          onChange={(e) => updateProfile({ preferences: { ...prefs, currency: e.target.value } })}
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="field-group">
        <label>Date Format</label>
        <select
          value={prefs.dateFormat}
          onChange={(e) => updateProfile({ preferences: { ...prefs, dateFormat: e.target.value as typeof prefs.dateFormat } })}
        >
          <option value="MDY">MM/DD/YYYY (US)</option>
          <option value="DMY">DD/MM/YYYY (EU)</option>
          <option value="YMD">YYYY-MM-DD (ISO)</option>
        </select>
      </div>

      <div className="field-group">
        <label>Default Payment Terms</label>
        <select
          value={prefs.defaultPaymentTerms}
          onChange={(e) => updateProfile({ preferences: { ...prefs, defaultPaymentTerms: e.target.value } })}
        >
          {["Due on Receipt", "Net 15", "Net 30", "Net 60", "Net 90"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <h3 className="section-title" style={{ marginTop: "2rem" }}>Notifications</h3>
      <label className="security-toggle">
        <input
          type="checkbox"
          checked={prefs.emailNotifications}
          onChange={(e) => updateProfile({ preferences: { ...prefs, emailNotifications: e.target.checked } })}
        />
        <div>
          <strong>Email notifications</strong>
          <span>Document shared with you, team invites, billing receipts</span>
        </div>
      </label>
      <label className="security-toggle">
        <input
          type="checkbox"
          checked={prefs.productUpdates}
          onChange={(e) => updateProfile({ preferences: { ...prefs, productUpdates: e.target.checked } })}
        />
        <div>
          <strong>Product updates</strong>
          <span>New templates, features, and tips</span>
        </div>
      </label>
      <label className="security-toggle">
        <input
          type="checkbox"
          checked={prefs.documentReminders}
          onChange={(e) => updateProfile({ preferences: { ...prefs, documentReminders: e.target.checked } })}
        />
        <div>
          <strong>Document reminders</strong>
          <span>Due date reminders for invoices and renewals</span>
        </div>
      </label>
    </div>
  );
}

export function ProfileSupportTab() {
  const { profile } = useProfile();
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState(SUPPORT_CATEGORIES[0]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setStatus("sending");

    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          category,
          message,
          email: profile.account.email || profile.business.email || profile.personal.email,
          accountId: profile.account.accountId,
          plan: profile.subscription.plan,
        }),
      });

      if (!res.ok) throw new Error("Failed");
      setStatus("sent");
      setSubject("");
      setMessage("");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="profile-support-layout">
      <div className="profile-panel card">
        <h3 className="section-title">Contact Support</h3>
        <p className="field-help" style={{ marginBottom: "1.25rem" }}>
          We typically respond within 1 business day. Pro subscribers get priority support.
        </p>

        <div className="support-contact-cards">
          <a href={`mailto:${SUPPORT_EMAIL}`} className="support-contact-card">
            <strong>Email Support</strong>
            <span>{SUPPORT_EMAIL}</span>
          </a>
          <Link href="/help" className="support-contact-card">
            <strong>Help Center</strong>
            <span>Guides, FAQ & tutorials</span>
          </Link>
        </div>

        <form className="support-form" onSubmit={handleSubmit}>
          <div className="field-group">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {SUPPORT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label>Subject</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief description of your issue" required />
          </div>
          <div className="field-group">
            <label>Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Include your account ID and steps to reproduce if reporting a bug"
              rows={5}
              required
            />
          </div>
          <p className="field-help">Account ID: {profile.account.accountId}</p>
          <button type="submit" className="btn btn-primary" disabled={status === "sending"}>
            {status === "sending" ? "Sending..." : "Send Message"}
          </button>
          {status === "sent" && <p className="import-msg">Message sent! We&apos;ll reply to your account email.</p>}
          {status === "error" && <p className="field-error">Could not send — try emailing {SUPPORT_EMAIL} directly.</p>}
        </form>
      </div>

      <div className="profile-panel card">
        <h3 className="section-title">Frequently Asked Questions</h3>
        <div className="faq-list">
          {FAQ_ITEMS.slice(0, 5).map((item) => (
            <details key={item.q} className="faq-item">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
        <Link href="/help" className="btn btn-secondary" style={{ marginTop: "1rem" }}>View All Help Articles</Link>
      </div>

      <div className="profile-panel card">
        <h3 className="section-title">Legal & Policies</h3>
        <div className="legal-links">
          <Link href="/legal/terms">Terms of Service</Link>
          <Link href="/legal/privacy">Privacy Policy</Link>
          <Link href="/legal/cookies">Cookie Policy</Link>
          <Link href="/legal/acceptable-use">Acceptable Use</Link>
        </div>
      </div>
    </div>
  );
}
