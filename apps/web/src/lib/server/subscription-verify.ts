import { getStripe } from "@/lib/stripe/client";
import { resolveSubscriptionFromStripe } from "@/lib/stripe/resolve-subscription";
import { isProPlan } from "@/lib/subscription/plans";
import type { SubscriptionStatus } from "@/lib/profile/types";

const ACTIVE_STATUSES: SubscriptionStatus[] = ["active", "trialing"];

export async function isActiveProSubscriber(email: string): Promise<boolean> {
  const { subscription } = await resolveSubscriptionFromStripe({ email });
  return isProPlan(subscription.plan) && ACTIVE_STATUSES.includes(subscription.status);
}

export async function verifyCustomerOwnership(
  customerId: string,
  email: string
): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe) return false;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return false;
    return (
      "email" in customer &&
      customer.email?.trim().toLowerCase() === email.trim().toLowerCase()
    );
  } catch {
    return false;
  }
}
