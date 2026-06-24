"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { BrandLogo } from "@/components/BrandLogo";

type Step = "email" | "verify" | "account";

export default function SignUpPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [signupToken, setSignupToken] = useState<string | null>(null);
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", email }),
      });
      const data = await res.json() as {
        error?: string;
        devCode?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Could not send verification code");

      if (data.devCode) setDevCode(data.devCode);
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify email");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifySubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", email, code }),
      });
      const data = await res.json() as { error?: string; signupToken?: string };
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      if (!data.signupToken) throw new Error("Verification failed");
      setSignupToken(data.signupToken);
      setStep("account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, password, name, signupToken ?? undefined);
      void fetch("/api/events/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      }).catch(() => null);
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", email }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not resend code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <BrandLogo href="/" size="xl" className="auth-logo" />
        <h1>Create your account</h1>
        <p className="auth-subtitle">
          {step === "email" && "We will email you a one-time 6-digit code"}
          {step === "verify" && `Enter the code we sent to ${email}`}
          {step === "account" && "Almost done — choose your name and password"}
        </p>

        <div className="signup-steps" aria-label="Sign up progress">
          <span className={step === "email" ? "signup-step active" : "signup-step done"}>1. Email</span>
          <span className={step === "verify" ? "signup-step active" : step === "account" ? "signup-step done" : "signup-step"}>
            2. Verify
          </span>
          <span className={step === "account" ? "signup-step active" : "signup-step"}>3. Account</span>
        </div>

        {step === "email" && (
          <form onSubmit={handleEmailSubmit} className="auth-form">
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
              {loading ? "Sending code..." : "Continue"}
            </button>
          </form>
        )}

        {step === "verify" && (
          <form onSubmit={handleVerifySubmit} className="auth-form">
            {devCode && <p className="field-help">Dev code: <strong>{devCode}</strong></p>}
            <div className="field-group">
              <label htmlFor="code">Verification code</label>
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
              {loading ? "Verifying..." : "Verify Email"}
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => void resendCode()} disabled={loading}>
              Resend code
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={() => { setStep("email"); setError(""); }}>
              Change email
            </button>
          </form>
        )}

        {step === "account" && (
          <form onSubmit={handleAccountSubmit} className="auth-form">
            <div className="field-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
                autoFocus
              />
            </div>
            <div className="field-group">
              <label htmlFor="email-readonly">Email</label>
              <input id="email-readonly" type="email" value={email} readOnly className="input-readonly" />
            </div>
            <div className="field-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <span className="field-help">Minimum 8 characters</span>
            </div>
            {error && <p className="field-error">{error}</p>}
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => { setStep("verify"); setError(""); }}
            >
              Back to verification
            </button>
          </form>
        )}

        <p className="auth-footer">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
        <p className="field-help auth-legal">
          By signing up you agree to our <Link href="/legal/terms">Terms</Link> and{" "}
          <Link href="/legal/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
