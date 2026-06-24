import type { SubscriptionPlan, SubscriptionStatus } from "@/lib/profile/types";

export function planFromPriceId(priceId: string | undefined | null): SubscriptionPlan {
  if (!priceId) return "monthly";
  if (priceId === process.env.STRIPE_PRICE_YEARLY) return "yearly";
  if (priceId === process.env.STRIPE_PRICE_MONTHLY) return "monthly";
  return "monthly";
}

export function planFromMetadata(metadata: Record<string, string> | null | undefined): SubscriptionPlan {
  const plan = metadata?.plan;
  if (plan === "yearly" || plan === "monthly") return plan;
  return "monthly";
}

export function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "incomplete":
    case "paused":
      return "pending";
    default:
      return "none";
  }
}
