import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { resolveRedirectUrl } from "@/lib/server/url-security";
import { verifyCustomerOwnership } from "@/lib/server/subscription-verify";
import { requireAuth } from "@/lib/server/session";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, "stripe-portal", 15, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many portal requests" }, { status: 429 });
  }

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: "Billing portal not configured" }, { status: 503 });
    }

    const { customerId, email, returnUrl } = await req.json() as {
      customerId?: string;
      email?: string;
      returnUrl?: string;
    };

    if (!customerId) {
      return NextResponse.json(
        { error: "No billing account found. Subscribe to a paid plan first." },
        { status: 400 }
      );
    }

    if (!email || !EMAIL_RE.test(email.trim())) {
      return NextResponse.json({ error: "Account email is required" }, { status: 400 });
    }
    if (email.trim().toLowerCase() !== auth.user.email.trim().toLowerCase()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ownsCustomer = await verifyCustomerOwnership(customerId, email.trim());
    if (!ownsCustomer) {
      return NextResponse.json({ error: "Billing account verification failed" }, { status: 403 });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: resolveRedirectUrl(returnUrl, "/profile?tab=billing"),
    });

    return NextResponse.json({ url: portal.url });
  } catch (err) {
    console.error("Stripe portal error:", err);
    return NextResponse.json({ error: "Failed to open billing portal" }, { status: 500 });
  }
}
