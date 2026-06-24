"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useProfile } from "@/components/ProfileProvider";
import { getEffectiveSubscription } from "@/lib/subscription/plans";

export function LandingHeroCta() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const isPro = getEffectiveSubscription(profile.subscription).isProActive;
  const isLoggedIn = Boolean(session);

  return (
    <div className="landing-cta-row">
      {isLoggedIn ? (
        <Link href="/documents" className="btn btn-primary btn-lg">
          Open Documents
        </Link>
      ) : (
        <>
          <Link href="/signup" className="btn btn-primary btn-lg">
            Create Free Account
          </Link>
          <Link href="/login" className="btn btn-secondary btn-lg">
            Sign In
          </Link>
        </>
      )}
      {!isPro && (
        <Link
          href={isLoggedIn ? "/profile?tab=billing" : "/signup?plan=pro"}
          className="btn btn-secondary btn-lg landing-go-pro-btn"
        >
          Go Pro
        </Link>
      )}
    </div>
  );
}
