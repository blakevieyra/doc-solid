import type Stripe from "stripe";

export function subscriptionPeriodEnd(sub: Stripe.Subscription): string | undefined {
  const end = (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  return end ? new Date(end * 1000).toISOString() : undefined;
}

export function subscriptionStartDate(sub: Stripe.Subscription): string | undefined {
  const start = (sub as Stripe.Subscription & { start_date?: number }).start_date;
  return start ? new Date(start * 1000).toISOString() : undefined;
}

export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | undefined {
  const sub = (invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null }).subscription;
  if (!sub) return undefined;
  return typeof sub === "string" ? sub : sub.id;
}
