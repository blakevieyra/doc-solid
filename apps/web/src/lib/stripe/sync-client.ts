import type { Subscription } from "@/lib/profile/types";
import { mergeReconciledSubscription } from "@/lib/stripe/resolve-subscription";

interface SyncResult {
  subscription: Partial<Subscription> & {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  };
  source?: string;
}

export async function syncSubscriptionFromSession(sessionId: string): Promise<SyncResult | null> {
  const res = await fetch("/api/stripe/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ sessionId }),
  });
  if (!res.ok) return null;
  return res.json() as Promise<SyncResult>;
}

export async function fetchSubscriptionStatus(opts: {
  customerId?: string;
  email?: string;
}): Promise<SyncResult | null> {
  const params = new URLSearchParams();
  if (opts.customerId) params.set("customerId", opts.customerId);
  if (opts.email) params.set("email", opts.email);
  if (!params.toString()) return null;

  const res = await fetch(`/api/stripe/subscription?${params.toString()}`, {
    credentials: "same-origin",
  });
  if (!res.ok) return null;
  return res.json() as Promise<SyncResult>;
}

/** Merge Stripe-resolved subscription onto a profile subscription (full replace of billing fields). */
export function applySubscriptionFromStripe(
  current: Subscription,
  resolved: SyncResult["subscription"]
): Subscription {
  const merged = mergeReconciledSubscription(current, {
    plan: (resolved.plan as Subscription["plan"]) ?? "free",
    status: (resolved.status as Subscription["status"]) ?? "none",
    stripeCustomerId: resolved.stripeCustomerId,
    stripeSubscriptionId: resolved.stripeSubscriptionId,
    currentPeriodEnd: resolved.currentPeriodEnd,
    startedAt: resolved.startedAt,
  });
  return merged;
}
