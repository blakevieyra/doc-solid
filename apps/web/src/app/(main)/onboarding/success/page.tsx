"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useProfile } from "@/components/ProfileProvider";
import { syncSubscriptionFromSession } from "@/lib/stripe/sync-client";
import type { SubscriptionPlan, SubscriptionStatus } from "@/lib/profile/types";

function SuccessContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { updateProfile } = useProfile();
  const [status, setStatus] = useState<"loading" | "done" | "pending" | "error">("loading");
  const activated = useRef(false);

  useEffect(() => {
    if (activated.current) return;
    activated.current = true;

    const plan = params?.get("plan") as SubscriptionPlan | null;
    const sessionId = params?.get("session_id");

    async function activate() {
      let subscriptionUpdate: {
        plan: SubscriptionPlan;
        status: SubscriptionStatus;
        startedAt: string;
        stripeCustomerId?: string;
        stripeSubscriptionId?: string;
        currentPeriodEnd?: string;
      } = {
        plan: plan ?? "monthly",
        status: "pending",
        startedAt: new Date().toISOString(),
      };

      let syncFailed = false;

      if (sessionId) {
        const synced = await syncSubscriptionFromSession(sessionId);
        if (synced?.subscription) {
          const s = synced.subscription;
          subscriptionUpdate = {
            plan: (s.plan as SubscriptionPlan) ?? subscriptionUpdate.plan,
            status: (s.status as SubscriptionStatus) ?? "pending",
            startedAt: s.startedAt ?? subscriptionUpdate.startedAt,
            stripeCustomerId: s.stripeCustomerId,
            stripeSubscriptionId: s.stripeSubscriptionId,
            currentPeriodEnd: s.currentPeriodEnd,
          };
        } else {
          syncFailed = true;
        }
      } else if (plan === "free") {
        subscriptionUpdate = { plan: "free", status: "none", startedAt: new Date().toISOString() };
      }

      // Always mark onboarding complete after checkout — paid users must not loop back to step 1.
      await updateProfile((current) => ({
        ...current,
        subscription: { ...current.subscription, ...subscriptionUpdate },
        onboardingComplete: true,
      }));

      sessionStorage.removeItem("doc-solid-onboarding-step");

      const isActive =
        subscriptionUpdate.status === "active" || subscriptionUpdate.status === "trialing";

      if (isActive) {
        setStatus("done");
        setTimeout(() => router.replace("/documents"), 1500);
      } else if (syncFailed) {
        setStatus("error");
      } else {
        setStatus("pending");
        setTimeout(() => router.replace("/documents"), 2500);
      }
    }

    activate().catch(() => {
      void updateProfile((current) => ({ ...current, onboardingComplete: true })).finally(() => {
        sessionStorage.removeItem("doc-solid-onboarding-step");
        setStatus("error");
      });
    });
  }, [params, updateProfile, router]);

  return (
    <div className="onboarding">
      <div className="onboarding-card onboarding-content onboarding-complete">
        {status === "loading" && (
          <>
            <div className="loading-spinner" />
            <h1>Activating your subscription...</h1>
          </>
        )}
        {status === "done" && (
          <>
            <div className="complete-icon">✓</div>
            <h1>Welcome to DocSolid Pro!</h1>
            <p className="onboarding-lead">Your subscription is active. Redirecting to documents...</p>
          </>
        )}
        {status === "pending" && (
          <>
            <div className="complete-icon">✓</div>
            <h1>Subscription received</h1>
            <p className="onboarding-lead">
              Payment is processing. Your Pro access will activate shortly. Redirecting to documents...
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <h1>Activation pending</h1>
            <p className="onboarding-lead">
              Payment may have succeeded — check Profile → Billing to confirm your plan is active.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => router.replace("/documents")}>
              Go to Documents
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginLeft: "0.5rem" }}
              onClick={() => router.replace("/profile?tab=billing")}
            >
              View Billing
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function OnboardingSuccessPage() {
  return (
    <Suspense fallback={
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
