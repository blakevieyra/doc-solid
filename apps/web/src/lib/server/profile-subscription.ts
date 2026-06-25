import type { Subscription } from "@/lib/profile/types";
import {
  mergeReconciledSubscription,
  resolveSubscriptionFromStripe,
} from "@/lib/stripe/resolve-subscription";
import { getSubscriptionByEmail, getSubscriptionByCustomerId } from "@/lib/stripe/subscription-store";
import { isProActive } from "@/lib/subscription/plans";

function subscriptionFromStored(record: {
  plan: Subscription["plan"];
  status: Subscription["status"];
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  currentPeriodEnd?: string;
  startedAt?: string;
}): Subscription {
  return {
    plan: record.plan,
    status: record.status,
    stripeCustomerId: record.stripeCustomerId,
    stripeSubscriptionId: record.stripeSubscriptionId,
    currentPeriodEnd: record.currentPeriodEnd,
    startedAt: record.startedAt,
  };
}

/** Never trust client-supplied plan/status — reconcile with Stripe before persisting. */
export async function reconcileProfileSubscription(
  email: string,
  current: Subscription
): Promise<Subscription> {
  const { subscription: resolved } = await resolveSubscriptionFromStripe({
    email,
    customerId: current.stripeCustomerId,
  });
  let merged = mergeReconciledSubscription(current, resolved);

  if (!isProActive(merged)) {
    const cached =
      (await getSubscriptionByEmail(email).catch(() => null)) ??
      (current.stripeCustomerId
        ? await getSubscriptionByCustomerId(current.stripeCustomerId).catch(() => null)
        : null);
    if (cached && isProActive(subscriptionFromStored(cached))) {
      merged = mergeReconciledSubscription(current, subscriptionFromStored(cached));
    }
  }

  return merged;
}
