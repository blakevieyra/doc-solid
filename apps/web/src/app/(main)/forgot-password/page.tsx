"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";

type Step = "email" | "verify" | "password";

function ForgotPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const preset = searchParams?.get("email")?.trim();
    if (preset) setEmail(preset);
  }, [searchParams]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    setMessage("");
    setDevCode("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", email }),
      });
      const data = await res.json() as { error?: string; message?: string; devCode?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not send reset code");
      setMessage(data.message ?? "Check your email for a 6-digit code.");
      if (data.devCode) setDevCode(data.devCode);
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", email, code }),
      });
      const data = await res.json() as { error?: string; resetToken?: string };
      if (!res.ok) throw new Error(data.error ?? "Invalid code");
      if (!data.resetToken) throw new Error("Verification failed");
      setResetToken(data.resetToken);
      setStep("password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: resetToken, newPassword: password }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not reset password");
      router.push("/login?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <BrandLogo href="/" size="xl" className="auth-logo" />
        <h1>Reset your password</h1>
        <p className="auth-subtitle">
          {step === "email" && "We will email you a one-time 6-digit code"}
          {step === "verify" && `Enter the code we sent to ${email}`}
          {step === "password" && "Choose a new password"}
        </p>

        <div className="signup-steps" aria-label="Reset progress">
          <span className={step === "email" ? "signup-step active" : "signup-step done"}>1. Email</span>
          <span className={step === "verify" ? "signup-step active" : step === "password" ? "signup-step done" : "signup-step"}>
            2. Code
          </span>
          <span className={step === "password" ? "signup-step active" : "signup-step"}>3. Password</span>
        </div>

        {step === "email" && (
          <form onSubmit={sendCode} className="auth-form">
            <div className="field-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />
            </div>
            {error && <p className="field-error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? "Sending code…" : "Send reset code"}
            </button>
          </form>
        )}

        {step === "verify" && (
          <form onSubmit={verifyCode} className="auth-form">
            {message && <p className="field-success">{message}</p>}
            {devCode && <p className="field-help">Dev code: <strong>{devCode}</strong></p>}
            <div className="field-group">
              <label htmlFor="code">Reset code</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                autoComplete="one-time-code"
                autoFocus
                placeholder="000000"
              />
              <span className="field-help">Check your inbox and spam folder</span>
            </div>
            {error && <p className="field-error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={loading || code.length !== 6}>
              {loading ? "Verifying…" : "Verify code"}
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => void sendCode()} disabled={loading}>
              Resend code
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => { setStep("email"); setError(""); setCode(""); }}>
              Change email
            </button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={updatePassword} className="auth-form">
            <div className="field-group">
              <label htmlFor="email-readonly">Email</label>
              <input id="email-readonly" type="email" value={email} readOnly className="input-readonly" />
            </div>
            <div className="field-group">
              <label htmlFor="password">New password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                autoFocus
              />
            </div>
            <div className="field-group">
              <label htmlFor="confirm">Confirm password</label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {error && <p className="field-error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}

        <p className="auth-footer">
          Remember your password? <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="auth-page">
        <div className="auth-card">
          <BrandLogo href="/" size="xl" className="auth-logo" />
          <p>Loading…</p>
        </div>
      </div>
    }>
      <ForgotPasswordPageContent />
    </Suspense>
  );
}
