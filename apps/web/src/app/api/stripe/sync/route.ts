import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { handleCheckoutCompleted } from "@/lib/stripe/handlers";
import { getSubscriptionByCustomerId } from "@/lib/stripe/subscription-store";
import { mapStripeStatus } from "@/lib/stripe/maps";
import { subscriptionPeriodEnd } from "@/lib/stripe/types";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Called after checkout redirect to pull customer + subscription IDs from Stripe. */
export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, "stripe-sync", 20, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many sync requests" }, { status: 429 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const { sessionId, customerId } = await req.json() as {
    sessionId?: string;
    customerId?: string;
  };

  try {
    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription"],
      });
      await handleCheckoutCompleted(stripe, session);

      const subObj = session.subscription;
      const subscriptionId = typeof subObj === "string" ? subObj : subObj?.id;
      const custId = typeof session.customer === "string" ? session.customer : session.customer?.id;

      let status: import("@/lib/profile/types").SubscriptionStatus = "pending";
      if (typeof subObj === "object" && subObj) {
        status = mapStripeStatus(subObj.status);
      }

      const plan =
        session.metadata?.plan === "yearly" || session.metadata?.plan === "monthly"
          ? session.metadata.plan
          : "monthly";

      return NextResponse.json({
        subscription: {
          plan,
          status,
          stripeCustomerId: custId,
          stripeSubscriptionId: subscriptionId,
          startedAt: new Date().toISOString(),
        },
      });
    }

    if (customerId) {
      const cached = await getSubscriptionByCustomerId(customerId);
      if (cached) return NextResponse.json({ subscription: cached });

      const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 1 });
      const sub = subs.data[0];
      if (!sub) {
        return NextResponse.json({
          subscription: { stripeCustomerId: customerId, plan: "free", status: "none" },
        });
      }

      return NextResponse.json({
        subscription: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          plan: sub.metadata?.plan ?? "monthly",
          status: mapStripeStatus(sub.status),
          currentPeriodEnd: subscriptionPeriodEnd(sub),
        },
      });
    }

    return NextResponse.json({ error: "Provide sessionId or customerId" }, { status: 400 });
  } catch (err) {
    console.error("Stripe sync error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
