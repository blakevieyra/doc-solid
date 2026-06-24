import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { handleSubscriptionChange } from "@/lib/stripe/handlers";
import { mapStripeStatus } from "@/lib/stripe/maps";
import { saveSubscription } from "@/lib/stripe/subscription-store";
import { subscriptionPeriodEnd, subscriptionStartDate } from "@/lib/stripe/types";
import { enforceRateLimit, rejectIfBodyTooLarge } from "@/lib/server/rate-limit";
import { verifyCustomerOwnership } from "@/lib/server/subscription-verify";
import { requireAuth } from "@/lib/server/session";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, "stripe-change-plan", 10, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many plan change requests" }, { status: 429 });
  }

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  if (rejectIfBodyTooLarge(req, 16_384)) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Billing is not configured" }, { status: 503 });
  }

  try {
    const body = await req.json() as {
      plan?: string;
      customerId?: string;
      subscriptionId?: string;
      email?: string;
    };

    if (body.plan !== "monthly" && body.plan !== "yearly") {
      return NextResponse.json({ error: "Invalid plan. Choose monthly or yearly." }, { status: 400 });
    }

    if (!body.customerId) {
      return NextResponse.json({ error: "No billing account found." }, { status: 400 });
    }

    const email = (body.email?.trim().toLowerCase() || auth.user.email.trim().toLowerCase());
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Account email is required" }, { status: 400 });
    }
    if (email !== auth.user.email.trim().toLowerCase()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ownsCustomer = await verifyCustomerOwnership(body.customerId, email);
    if (!ownsCustomer) {
      return NextResponse.json({ error: "Billing account verification failed" }, { status: 403 });
    }

    const priceId =
      body.plan === "monthly"
        ? process.env.STRIPE_PRICE_MONTHLY
        : process.env.STRIPE_PRICE_YEARLY;

    if (!priceId) {
      return NextResponse.json({ error: "Plan pricing is not configured." }, { status: 503 });
    }

    let subscriptionId = body.subscriptionId;
    if (!subscriptionId) {
      const subs = await stripe.subscriptions.list({
        customer: body.customerId,
        status: "active",
        limit: 1,
      });
      subscriptionId = subs.data[0]?.id;
    }

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "No active subscription found. Use checkout to subscribe first." },
        { status: 400 }
      );
    }

    const existing = await stripe.subscriptions.retrieve(subscriptionId);
    const itemId = existing.items.data[0]?.id;
    if (!itemId) {
      return NextResponse.json({ error: "Subscription has no billable item." }, { status: 400 });
    }

    const currentPrice = existing.items.data[0]?.price.id;
    if (currentPrice === priceId) {
      return NextResponse.json({
        subscription: {
          plan: body.plan,
          status: mapStripeStatus(existing.status),
          currentPeriodEnd: subscriptionPeriodEnd(existing),
          stripeCustomerId: body.customerId,
          stripeSubscriptionId: subscriptionId,
        },
        message: "You are already on this plan.",
      });
    }

    const updated = await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: "create_prorations",
      metadata: {
        ...existing.metadata,
        plan: body.plan,
        email,
      },
    });

    await handleSubscriptionChange(updated);

    const record = {
      email,
      userId: updated.metadata?.userId,
      stripeCustomerId: body.customerId,
      stripeSubscriptionId: updated.id,
      plan: body.plan as "monthly" | "yearly",
      status: mapStripeStatus(updated.status),
      currentPeriodEnd: subscriptionPeriodEnd(updated),
      startedAt: subscriptionStartDate(updated),
      updatedAt: new Date().toISOString(),
    };
    await saveSubscription(record);

    return NextResponse.json({
      subscription: record,
      message: `Plan updated to ${body.plan === "yearly" ? "Pro Yearly" : "Pro Monthly"}.`,
    });
  } catch (err) {
    console.error("Stripe change-plan error:", err);
    return NextResponse.json({ error: "Failed to update subscription plan" }, { status: 500 });
  }
}
