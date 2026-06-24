"use client";

import { useState } from "react";
import { useProfile } from "@/components/ProfileProvider";
import { useAuth } from "@/components/AuthProvider";
import { DeleteDataModal } from "./DeleteDataModal";
import { AIScanHistory } from "./AIScanHistory";
import { ComplianceRecommendations } from "./ComplianceRecommendations";

export function SecurityCenter() {
  const { profile, updateProfile, setPin, removePin } = useProfile();
  const { changePassword } = useAuth();
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [showDelete, setShowDelete] = useState(false);

  const score = calcSecurityScore(profile);

  async function handleSetPin() {
    setErr("");
    if (newPin.length < 4) { setErr("PIN must be at least 4 digits"); return; }
    if (newPin !== confirmPin) { setErr("PINs do not match"); return; }
    await setPin(newPin);
    setMsg("PIN enabled successfully");
    setNewPin(""); setConfirmPin("");
  }

  async function handleChangePassword() {
    setErr("");
    try {
      await changePassword(currentPw, newPw);
      setMsg("Password updated");
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="security-center">
      <div className={`security-score-card score-${score.level}`}>
        <div className="security-score-ring">
          <span className="security-score-num">{score.percent}</span>
        </div>
        <div>
          <h3>Security Score: {score.label}</h3>
          <p>{score.summary}</p>
        </div>
      </div>

      <ul className="security-checklist">
        {score.checks.map((c) => (
          <li key={c.label} className={c.done ? "done" : "todo"}>
            <span className="check-icon">{c.done ? "✓" : "○"}</span>
            <div>
              <strong>{c.label}</strong>
              <span>{c.desc}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="security-section card-inner">
        <h3 className="section-title">Data Protection</h3>
        <label className="security-toggle">
          <input
            type="checkbox"
            checked={profile.security.encryptSensitive}
            onChange={(e) => updateProfile({ security: { ...profile.security, encryptSensitive: e.target.checked } })}
          />
          <div>
            <strong>Encrypt sensitive fields (AES-256-GCM)</strong>
            <span>Tax IDs and similar data encrypted on your device</span>
          </div>
        </label>
      </div>

      <div className="security-section card-inner">
        <h3 className="section-title">PIN Lock</h3>
        {profile.security.pinEnabled ? (
          <div>
            <p className="field-help security-status-on">● PIN lock is active</p>
            <button type="button" className="btn btn-secondary" onClick={removePin}>Remove PIN</button>
          </div>
        ) : (
          <div className="pin-fields">
            <div className="field-group">
              <label>Create PIN</label>
              <input type="password" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="4+ digits" />
            </div>
            <div className="field-group">
              <label>Confirm PIN</label>
              <input type="password" inputMode="numeric" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} />
            </div>
            <button type="button" className="btn btn-primary" onClick={handleSetPin}>Enable PIN Lock</button>
          </div>
        )}
      </div>

      <div className="security-section card-inner">
        <h3 className="section-title">Change Password</h3>
        <div className="field-group">
          <label>Current Password</label>
          <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} autoComplete="current-password" />
        </div>
        <div className="field-group">
          <label>New Password</label>
          <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} minLength={8} autoComplete="new-password" />
        </div>
        <div className="field-group">
          <label>Confirm New Password</label>
          <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
        </div>
        <button type="button" className="btn btn-secondary" onClick={handleChangePassword} disabled={!currentPw || newPw !== confirmPw || newPw.length < 8}>
          Update Password
        </button>
      </div>

      <ComplianceRecommendations />

      <AIScanHistory />

      <div className="security-section card-inner security-danger">
        <h3 className="section-title">Delete All Data</h3>
        <p className="field-help">Permanently remove your profile, documents, team data, and account. This cannot be undone.</p>
        <button type="button" className="btn btn-danger" onClick={() => setShowDelete(true)}>Delete All My Data</button>
      </div>

      {msg && <p className="import-msg">{msg}</p>}
      {err && <p className="field-error">{err}</p>}

      {showDelete && <DeleteDataModal onClose={() => setShowDelete(false)} />}
    </div>
  );
}

function calcSecurityScore(profile: ReturnType<typeof useProfile>["profile"]) {
  const checks = [
    { label: "Encryption enabled", desc: "Sensitive fields are encrypted", done: profile.security.encryptSensitive },
    { label: "PIN lock", desc: "Extra layer for profile access", done: profile.security.pinEnabled },
    { label: "Profile complete", desc: "Business or personal info saved", done: !!(profile.business.name || profile.personal.fullName) },
    { label: "Account email set", desc: "For recovery and support", done: !!profile.account.email },
  ];
  const done = checks.filter((c) => c.done).length;
  const percent = Math.round((done / checks.length) * 100);
  const level = percent >= 75 ? "good" : percent >= 50 ? "fair" : "weak";
  const label = level === "good" ? "Strong" : level === "fair" ? "Fair" : "Needs attention";
  const summary = level === "good"
    ? "Your account is well protected."
    : "Complete the checklist below to improve security.";
  return { percent, level, label, summary, checks };
}
