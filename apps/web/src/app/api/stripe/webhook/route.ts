import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, getWebhookSecret } from "@/lib/stripe/client";
import {
  handleCheckoutCompleted,
  handleSubscriptionChange,
  handleSubscriptionDeleted,
} from "@/lib/stripe/handlers";
import { invoiceSubscriptionId } from "@/lib/stripe/types";
import { kvSetNx } from "@/lib/server/kv";
import { kvRequiredForProd } from "@/lib/server/env";

export const runtime = "nodejs";
export const maxDuration = 30;

const WEBHOOK_TTL_SEC = 60 * 60 * 24 * 3; // Stripe retries up to ~3 days

export async function POST(req: NextRequest) {
  if (kvRequiredForProd()) {
    return NextResponse.json(
      { error: "Webhook persistence (KV) is required in production" },
      { status: 503 }
    );
  }

  const stripe = getStripe();
  const webhookSecret = getWebhookSecret();

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 503 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const dedupeKey = `webhook:stripe:${event.id}`;
  const isNew = await kvSetNx(dedupeKey, "1", WEBHOOK_TTL_SEC);
  if (!isNew) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(stripe, event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoiceSubscriptionId(invoice);
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await handleSubscriptionChange(sub);
        }
        break;
      }
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`Webhook handler error (${event.type}):`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
