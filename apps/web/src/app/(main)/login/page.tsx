"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { BrandLogo } from "@/components/BrandLogo";
import { GUEST_BROWSE_ENTRY_PATH } from "@/lib/auth/guest-browse";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const lockedOut = error.toLowerCase().includes("too many login");

  useEffect(() => {
    if (params?.get("reset") === "1") {
      setNotice("Password updated. Sign in with your new password.");
    }
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      await login(email, password);
      router.push("/documents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <BrandLogo href="/" size="xl" className="auth-logo" />
        <h1>Welcome back</h1>
        <p className="auth-subtitle">Sign in to your documents and profile</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field-group">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="field-group">
            <div className="field-label-row">
              <label htmlFor="password">Password</label>
              <Link href="/forgot-password" className="auth-inline-link">Forgot password?</Link>
            </div>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          {notice && <p className="field-success">{notice}</p>}
          {error && (
            <div className="auth-error-block">
              <p className="field-error">{error}</p>
              {lockedOut && (
                <p className="field-help">
                  Locked out? <Link href="/forgot-password">Reset your password with a one-time code</Link> to sign in with a new password, or wait about an hour and try again.
                </p>
              )}
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
        <p className="auth-footer">
          Don&apos;t have an account? <Link href="/signup">Create one free</Link>
        </p>
        <p className="auth-footer auth-browse-link">
          <Link href={GUEST_BROWSE_ENTRY_PATH}>Take a look around — no account needed</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="auth-page">
        <div className="auth-card">
          <div className="loading-spinner" />
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
