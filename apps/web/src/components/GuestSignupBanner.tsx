"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";

export function GuestSignupBanner({ compact }: { compact?: boolean }) {
  const { session } = useAuth();
  if (session) return null;

  return (
    <div className={`guest-signup-banner${compact ? " guest-signup-banner-compact" : ""}`}>
      <p>
        {compact
          ? "Create a free account to save, share, and collaborate."
          : "You are browsing as a guest. Create a free account to save documents, build packets, and use team features."}
      </p>
      <div className="guest-signup-banner-actions">
        <Link href="/signup" className="btn btn-primary btn-sm">Create free account</Link>
        <Link href="/login" className="btn btn-secondary btn-sm">Sign in</Link>
      </div>
    </div>
  );
}

export function GuestAuthGate({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { session } = useAuth();
  if (session) return null;

  return (
    <div className="card guest-auth-gate">
      <h2 className="section-title" style={{ marginTop: 0 }}>{title}</h2>
      <p className="field-help">{description}</p>
      <div className="guest-signup-banner-actions">
        <Link href="/signup" className="btn btn-primary">Create free account</Link>
        <Link href="/login" className="btn btn-secondary">Sign in</Link>
      </div>
    </div>
  );
}
