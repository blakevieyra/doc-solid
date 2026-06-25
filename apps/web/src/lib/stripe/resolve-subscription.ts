import type Stripe from "stripe";
import type { Subscription, SubscriptionPlan, SubscriptionStatus } from "@/lib/profile/types";
import { getStripe } from "./client";
import { planFromPriceId, mapStripeStatus } from "./maps";
import {
  saveSubscription,
  getSubscriptionByEmail,
  getSubscriptionByCustomerId,
  type StoredSubscription,
} from "./subscription-store";
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

async function resolveEmailForCustomer(
  stripe: Stripe,
  customerId: string,
  fallbackEmail: string
): Promise<string> {
  if (fallbackEmail) return fallbackEmail;
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer.deleted && "email" in customer && customer.email) {
    return customer.email.toLowerCase();
  }
  return "";
}

async function listCustomerIdsForEmail(stripe: Stripe, email: string): Promise<string[]> {
  const customers = await stripe.customers.list({ email, limit: 10 });
  return customers.data.map((c) => c.id);
}

async function resolveFromStripeCustomer(
  stripe: Stripe,
  customerId: string,
  emailHint: string
): Promise<ResolvedSubscription | null> {
  const resolvedEmail = await resolveEmailForCustomer(stripe, customerId, emailHint);
  if (!resolvedEmail) return null;

  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
    expand: ["data.items.data.price"],
  });

  const best = pickBestSubscription(subs.data);
  if (!best) return null;

  const record = recordFromStripeSub(best, resolvedEmail, customerId);
  const profileSub = toProfileSubscription(record);

  if (!isProActive(profileSub)) {
    return {
      subscription: freeSubscription({ stripeCustomerId: customerId }),
      source: "stripe",
      stored: record,
    };
  }

  try {
    await saveSubscription(record);
  } catch (err) {
    console.error("saveSubscription failed (subscription still resolved from Stripe):", err);
  }

  return {
    subscription: profileSub,
    source: "stripe",
    stored: record,
  };
}

function resolvedFromStored(record: StoredSubscription): ResolvedSubscription {
  return {
    subscription: toProfileSubscription(record),
    source: "stripe",
    stored: record,
  };
}

/**
 * Resolve subscription state from Stripe (source of truth).
 * Tries stored customer id, then all Stripe customers for the email.
 * Updates KV cache when a durable record is found.
 */
export async function resolveSubscriptionFromStripe(
  input: ResolveSubscriptionInput
): Promise<ResolvedSubscription> {
  const stripe = getStripe();
  const email = normalizeEmail(input.email);
  const hintedCustomerId = input.customerId?.trim() || undefined;

  if (!stripe) {
    return { subscription: freeSubscription(), source: "none" };
  }

  try {
    const customerIds: string[] = [];
    if (hintedCustomerId) customerIds.push(hintedCustomerId);
    if (email) {
      for (const id of await listCustomerIdsForEmail(stripe, email)) {
        if (!customerIds.includes(id)) customerIds.push(id);
      }
    }

    if (customerIds.length === 0) {
      if (email) {
        const cached = await getSubscriptionByEmail(email).catch(() => null);
        if (cached && isProActive(toProfileSubscription(cached))) {
          return resolvedFromStored(cached);
        }
      }
      return { subscription: freeSubscription(), source: "none" };
    }

    let fallback: ResolvedSubscription | null = null;
    let lastCustomerId = customerIds[customerIds.length - 1];

    for (const customerId of customerIds) {
      lastCustomerId = customerId;
      const result = await resolveFromStripeCustomer(stripe, customerId, email);
      if (!result) continue;
      if (isProActive(result.subscription)) return result;
      if (!fallback) fallback = result;
    }

    if (email) {
      const cached = await getSubscriptionByEmail(email).catch(() => null);
      if (cached && isProActive(toProfileSubscription(cached))) {
        return resolvedFromStored(cached);
      }
    }

    if (hintedCustomerId) {
      const cached = await getSubscriptionByCustomerId(hintedCustomerId).catch(() => null);
      if (cached && isProActive(toProfileSubscription(cached))) {
        return resolvedFromStored(cached);
      }
    }

    if (fallback) return fallback;

    const inactive: Subscription = {
      plan: "free",
      status: "none",
      stripeCustomerId: lastCustomerId,
    };

    if (email) {
      try {
        await saveSubscription({
          email,
          stripeCustomerId: lastCustomerId,
          stripeSubscriptionId: lastCustomerId,
          plan: "free",
          status: "none",
          updatedAt: new Date().toISOString(),
        });
      } catch {
        /* non-fatal */
      }
    }

    return { subscription: inactive, source: "stripe" };
  } catch (err) {
    console.error("resolveSubscriptionFromStripe error:", err);
    if (email) {
      const cached = await getSubscriptionByEmail(email).catch(() => null);
      if (cached && isProActive(toProfileSubscription(cached))) {
        return resolvedFromStored(cached);
      }
    }
    if (hintedCustomerId) {
      const cached = await getSubscriptionByCustomerId(hintedCustomerId).catch(() => null);
      if (cached && isProActive(toProfileSubscription(cached))) {
        return resolvedFromStored(cached);
      }
    }
    return { subscription: freeSubscription({ stripeCustomerId: hintedCustomerId }), source: "none" };
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
