import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { enforceRateLimit, rejectIfBodyTooLarge } from "@/lib/server/rate-limit";
import { resolveRedirectUrl } from "@/lib/server/url-security";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, "stripe-checkout", 10, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many checkout attempts" }, { status: 429 });
  }

  if (rejectIfBodyTooLarge(req, 32_768)) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: "Payment processing is not configured. Choose the Free plan to continue, or contact support." },
        { status: 503 }
      );
    }

    const { plan, email, userId, successUrl, cancelUrl } = await req.json() as {
      plan?: string;
      email?: string;
      userId?: string;
      successUrl?: string;
      cancelUrl?: string;
    };

    if (plan !== "monthly" && plan !== "yearly") {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    if (email && !EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const priceId =
      plan === "monthly"
        ? process.env.STRIPE_PRICE_MONTHLY
        : process.env.STRIPE_PRICE_YEARLY;

    if (!priceId) {
      return NextResponse.json(
        { error: "Price not configured for this plan." },
        { status: 503 }
      );
    }

    const safeSuccess = resolveRedirectUrl(successUrl, "/onboarding/success");
    const safeCancel = resolveRedirectUrl(cancelUrl, "/onboarding");

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: safeSuccess,
      cancel_url: safeCancel,
      customer_email: email?.trim() || undefined,
      client_reference_id: userId || undefined,
      metadata: { plan, userId: userId ?? "", email: email?.trim().toLowerCase() ?? "" },
      subscription_data: {
        metadata: { plan, userId: userId ?? "", email: email?.trim().toLowerCase() ?? "" },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
