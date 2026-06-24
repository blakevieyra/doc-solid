import type Stripe from "stripe";
import { planFromPriceId, mapStripeStatus } from "./maps";
import { saveSubscription, type StoredSubscription } from "./subscription-store";
import { subscriptionPeriodEnd, subscriptionStartDate } from "./types";
import { notifyProSubscription, notifyPaymentFailed, notifySubscriptionCanceled } from "@/lib/email/notify";

function subscriptionRecordFromStripe(
  sub: Stripe.Subscription,
  email: string,
  userId?: string
): StoredSubscription {
  const priceId = sub.items.data[0]?.price.id;
  const metaPlan = sub.metadata?.plan;
  const plan =
    metaPlan === "yearly" || metaPlan === "monthly"
      ? metaPlan
      : planFromPriceId(priceId);

  return {
    email,
    userId: userId ?? sub.metadata.userId,
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripeSubscriptionId: sub.id,
    plan,
    status: mapStripeStatus(sub.status),
    currentPeriodEnd: subscriptionPeriodEnd(sub),
    startedAt: subscriptionStartDate(sub),
    updatedAt: new Date().toISOString(),
  };
}

export async function handleCheckoutCompleted(
  stripe: Stripe,
  session: Stripe.Checkout.Session
): Promise<void> {
  if (session.mode !== "subscription") return;

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  const email = (session.customer_email ?? session.customer_details?.email ?? "").toLowerCase();
  const userId = session.client_reference_id ?? session.metadata?.userId;

  if (!customerId || !subscriptionId || !email) return;

  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const record = subscriptionRecordFromStripe(sub, email, userId ?? undefined);
  await saveSubscription(record);

  if (record.status === "active" || record.status === "trialing") {
    await notifyProSubscription({ email, plan: record.plan }).catch(() => null);
  }
}

export async function handleSubscriptionChange(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const email = (sub.metadata.email ?? "").toLowerCase();

  if (!email && customerId) {
    const stripe = (await import("./client")).getStripe();
    if (stripe) {
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer.deleted && "email" in customer && customer.email) {
        const resolvedEmail = customer.email.toLowerCase();
        const record = subscriptionRecordFromStripe(sub, resolvedEmail);
        await saveSubscription(record);
        if (sub.status === "past_due" || sub.status === "unpaid") {
          await notifyPaymentFailed(resolvedEmail).catch(() => null);
        }
        return;
      }
    }
  }

  if (email) {
    const record = subscriptionRecordFromStripe(sub, email);
    await saveSubscription(record);
    if (sub.status === "past_due" || sub.status === "unpaid") {
      await notifyPaymentFailed(email).catch(() => null);
    }
  }
}

export async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const email = (sub.metadata.email ?? "").toLowerCase();
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  let resolvedEmail = email;
  if (!resolvedEmail && customerId) {
    const stripe = (await import("./client")).getStripe();
    if (stripe) {
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer.deleted && "email" in customer && customer.email) {
        resolvedEmail = customer.email.toLowerCase();
      }
    }
  }

  if (!resolvedEmail) return;

  await saveSubscription({
    email: resolvedEmail,
    userId: sub.metadata.userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    plan: "free",
    status: "canceled",
    updatedAt: new Date().toISOString(),
  });

  await notifySubscriptionCanceled(resolvedEmail).catch(() => null);
}
