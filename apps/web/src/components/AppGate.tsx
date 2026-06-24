"use client";

import { useAuth } from "./AuthProvider";
import { useProfile } from "./ProfileProvider";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const AUTH_PUBLIC = ["/login", "/signup"];
const APP_PUBLIC = ["/onboarding", "/onboarding/success", "/join-team"];
const MARKETING_PUBLIC = ["/", "/help"];

export function AppGate({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const pathname = usePathname();
  const router = useRouter();
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const redirecting = useRef(false);

  useEffect(() => {
    if (authLoading || profileLoading || !pathname) return;

    const isAuthPage = AUTH_PUBLIC.includes(pathname);
    const isPublic = APP_PUBLIC.includes(pathname) || pathname.startsWith("/legal");
    const isMarketing = MARKETING_PUBLIC.includes(pathname);

    if (!session && !isAuthPage && !isPublic && !isMarketing && !pathname.startsWith("/legal")) {
      redirecting.current = true;
      router.replace("/login");
      return;
    }
    if (session && isAuthPage) {
      redirecting.current = true;
      router.replace(profile.onboardingComplete ? "/documents" : "/onboarding");
      return;
    }
    if (session && !profile.onboardingComplete && !isPublic && pathname !== "/login") {
      const hasActiveSub =
        profile.subscription.status === "active" ||
        profile.subscription.status === "trialing";
      if (hasActiveSub) {
        redirecting.current = false;
        setInitialCheckDone(true);
        return;
      }
      redirecting.current = true;
      router.replace("/onboarding");
      return;
    }
    if (session && profile.onboardingComplete && pathname === "/onboarding") {
      redirecting.current = true;
      router.replace("/documents");
      return;
    }

    redirecting.current = false;
    setInitialCheckDone(true);
  }, [authLoading, profileLoading, session, profile.onboardingComplete, profile.subscription.status, pathname, router]);

  if (!initialCheckDone) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading DocSolid...</p>
      </div>
    );
  }

  return <>{children}</>;
}

export function ProfileLockScreen() {
  const { unlock, locked } = useProfile();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  if (!locked) return null;

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    const ok = await unlock(pin);
    if (!ok) setError(true);
  }

  return (
    <div className="lock-screen">
      <form className="lock-card" onSubmit={handleUnlock}>
        <div className="security-shield-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <h2>Profile Locked</h2>
        <p>Enter your PIN to access sensitive information</p>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={pin}
          onChange={(e) => { setPin(e.target.value); setError(false); }}
          placeholder="Enter PIN"
          autoFocus
          className="lock-input"
        />
        {error && <p className="field-error">Incorrect PIN. Try again.</p>}
        <button type="submit" className="btn btn-primary btn-block">Unlock</button>
        <p className="lock-hint">Your data is encrypted on this device</p>
      </form>
    </div>
  );
}
