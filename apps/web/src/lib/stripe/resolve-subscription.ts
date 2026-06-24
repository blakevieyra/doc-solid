import type Stripe from "stripe";
import type { Subscription, SubscriptionPlan, SubscriptionStatus } from "@/lib/profile/types";
import { getStripe } from "./client";
import { planFromPriceId, mapStripeStatus } from "./maps";
import { saveSubscription, type StoredSubscription } from "./subscription-store";
import { subscriptionPeriodEnd, subscriptionStartDate } from "./types";
import { isProActive } from "@/lib/subscription/plans";

export interface ResolveSubscriptionInput {
  email?: string | null;
  customerId?: string | null;
}

export interface ResolvedSubscription {
  subscription: Subscription;
  source: "stripe" | "none";
  stored?: StoredSubscription;
}

function normalizeEmail(email?: string | null): string {
  return email?.trim().toLowerCase() ?? "";
}

function recordFromStripeSub(
  sub: Stripe.Subscription,
  email: string,
  customerId: string
): StoredSubscription {
  const priceId = sub.items.data[0]?.price.id;
  const metaPlan = sub.metadata?.plan;
  const plan: SubscriptionPlan =
    metaPlan === "yearly" || metaPlan === "monthly"
      ? metaPlan
      : planFromPriceId(priceId);

  return {
    email,
    userId: sub.metadata?.userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    plan,
    status: mapStripeStatus(sub.status),
    currentPeriodEnd: subscriptionPeriodEnd(sub),
    startedAt: subscriptionStartDate(sub),
    updatedAt: new Date().toISOString(),
  };
}

function toProfileSubscription(record: StoredSubscription): Subscription {
  return {
    plan: record.plan,
    status: record.status,
    stripeCustomerId: record.stripeCustomerId,
    stripeSubscriptionId: record.stripeSubscriptionId,
    currentPeriodEnd: record.currentPeriodEnd,
    startedAt: record.startedAt,
  };
}

function freeSubscription(partial?: Partial<Subscription>): Subscription {
  return {
    plan: "free",
    status: "none",
    stripeCustomerId: partial?.stripeCustomerId,
    stripeSubscriptionId: undefined,
    currentPeriodEnd: undefined,
    startedAt: partial?.startedAt,
  };
}

/** Pick the subscription that should drive app entitlements. */
function pickBestSubscription(subs: Stripe.Subscription[]): Stripe.Subscription | null {
  if (subs.length === 0) return null;

  const rank = (sub: Stripe.Subscription): number => {
    const status = mapStripeStatus(sub.status);
    if (status === "active" || status === "trialing") return 3;
    if (
      status === "canceled" &&
      subscriptionPeriodEnd(sub) &&
      new Date(subscriptionPeriodEnd(sub)!) > new Date()
    ) {
      return 2;
    }
    if (status === "past_due" || status === "pending") return 1;
    return 0;
  };

  const sorted = [...subs].sort((a, b) => rank(b) - rank(a));
  const best = sorted[0];
  if (!best || rank(best) === 0) return null;
  return best;
}

/**
 * Resolve subscription state from Stripe (source of truth).
 * Updates KV cache when a durable record is found.
 */
export async function resolveSubscriptionFromStripe(
  input: ResolveSubscriptionInput
): Promise<ResolvedSubscription> {
  const stripe = getStripe();
  const email = normalizeEmail(input.email);
  let customerId = input.customerId?.trim() || undefined;

  if (!stripe) {
    return { subscription: freeSubscription(), source: "none" };
  }

  try {
    if (!customerId && email) {
      const customers = await stripe.customers.list({ email, limit: 1 });
      customerId = customers.data[0]?.id;
    }

    if (!customerId) {
      return { subscription: freeSubscription(), source: "none" };
    }

    let resolvedEmail = email;
    if (!resolvedEmail) {
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer.deleted && "email" in customer && customer.email) {
        resolvedEmail = customer.email.toLowerCase();
      }
    }

    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
      expand: ["data.items.data.price"],
    });

    const best = pickBestSubscription(subs.data);
    if (!best || !resolvedEmail) {
      const inactive: Subscription = {
        plan: "free",
        status: "none",
        stripeCustomerId: customerId,
      };
      if (resolvedEmail) {
        await saveSubscription({
          email: resolvedEmail,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subs.data[0]?.id ?? customerId,
          plan: "free",
          status: "none",
          updatedAt: new Date().toISOString(),
        }).catch(() => null);
      }
      return { subscription: inactive, source: "stripe" };
    }

    const record = recordFromStripeSub(best, resolvedEmail, customerId);
    const profileSub = toProfileSubscription(record);

    if (!isProActive(profileSub)) {
      record.plan = "free";
      record.status = "none";
    }

    await saveSubscription(record);

    return {
      subscription: isProActive(profileSub) ? profileSub : freeSubscription({ stripeCustomerId: customerId }),
      source: "stripe",
      stored: record,
    };
  } catch (err) {
    console.error("resolveSubscriptionFromStripe error:", err);
    return { subscription: freeSubscription({ stripeCustomerId: customerId }), source: "none" };
  }
}

export function mergeReconciledSubscription(
  current: Subscription,
  resolved: Subscription
): Subscription {
  return {
    ...current,
    plan: resolved.plan,
    status: resolved.status,
    stripeCustomerId: resolved.stripeCustomerId ?? current.stripeCustomerId,
    stripeSubscriptionId: resolved.stripeSubscriptionId,
    currentPeriodEnd: resolved.currentPeriodEnd,
    startedAt: resolved.startedAt ?? current.startedAt,
  };
}
