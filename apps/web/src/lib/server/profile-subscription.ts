import type { Subscription } from "@/lib/profile/types";
import {
  mergeReconciledSubscription,
  resolveSubscriptionFromStripe,
} from "@/lib/stripe/resolve-subscription";

/** Never trust client-supplied plan/status — reconcile with Stripe before persisting. */
export async function reconcileProfileSubscription(
  email: string,
  current: Subscription
): Promise<Subscription> {
  const { subscription: resolved } = await resolveSubscriptionFromStripe({
    email,
    customerId: current.stripeCustomerId,
  });
  return mergeReconciledSubscription(current, resolved);
}
