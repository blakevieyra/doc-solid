"use client";

import { useAuth } from "./AuthProvider";
import { useProfile } from "./ProfileProvider";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { isGuestBrowsePath } from "@/lib/auth/guest-browse";

const AUTH_PUBLIC = ["/login", "/signup", "/forgot-password", "/reset-password"];
const APP_PUBLIC = ["/onboarding", "/onboarding/success", "/join-team"];
const MARKETING_PUBLIC = ["/", "/help"];

export function AppGate({ children }: { children: React.ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const { loading: profileLoading } = useProfile();
  const pathname = usePathname();
  const router = useRouter();
  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const redirecting = useRef(false);

  useEffect(() => {
    if (authLoading || profileLoading || !pathname) return;

    const isAuthPage = AUTH_PUBLIC.includes(pathname);
    const isPublic = APP_PUBLIC.includes(pathname) || pathname.startsWith("/legal");
    const isMarketing = MARKETING_PUBLIC.includes(pathname);

    const isBrowse = isGuestBrowsePath(pathname);

    if (!session && !isAuthPage && !isPublic && !isMarketing && !isBrowse && !pathname.startsWith("/legal")) {
      redirecting.current = true;
      router.replace("/signup");
      return;
    }
    if (session && isAuthPage) {
      redirecting.current = true;
      router.replace("/documents");
      return;
    }

    redirecting.current = false;
    setInitialCheckDone(true);
  }, [authLoading, profileLoading, session, pathname, router]);

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
  const { unlock, removePin, locked } = useProfile();
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [resetting, setResetting] = useState(false);

  if (!locked) return null;

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    const ok = await unlock(pin.trim());
    if (!ok) setError(true);
  }

  async function handleResetPinLock() {
    const confirmed = window.confirm(
      "Remove PIN lock on this device? You can set a new PIN afterward in Profile → Security.",
    );
    if (!confirmed) return;
    setResetting(true);
    try {
      await removePin();
      setError(false);
    } finally {
      setResetting(false);
    }
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
        <p>Enter your PIN to access sensitive information on this device</p>
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
        <button type="submit" className="btn btn-primary btn-block" disabled={resetting}>
          Unlock
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-block"
          style={{ marginTop: "0.5rem" }}
          disabled={resetting}
          onClick={() => void handleResetPinLock()}
        >
          {resetting ? "Removing PIN…" : "Remove PIN lock on this device"}
        </button>
        <p className="lock-hint">Your PIN is stored only on this device and is not synced to the cloud.</p>
      </form>
    </div>
  );
}
