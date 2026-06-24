"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useProfile } from "@/components/ProfileProvider";
import { getEffectiveSubscription } from "@/lib/subscription/plans";

export function LandingHeaderActions() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const isPro = getEffectiveSubscription(profile.subscription).isProActive;
  const isLoggedIn = Boolean(session);

  return (
    <nav className="landing-nav">
      <Link href="/help">Help</Link>
      <a href="#faq">FAQ</a>
      {!isPro && (
        <Link href={isLoggedIn ? "/profile?tab=billing" : "/signup?plan=pro"} className="landing-nav-go-pro">
          Go Pro
        </Link>
      )}
      {isLoggedIn ? (
        <Link href="/documents" className="btn btn-primary">
          Open App
        </Link>
      ) : (
        <>
          <Link href="/login">Sign In</Link>
          <Link href="/signup" className="btn btn-primary">
            Start Free
          </Link>
        </>
      )}
    </nav>
  );
}
