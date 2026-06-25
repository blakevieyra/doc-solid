import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { resolveSubscriptionFromStripe } from "@/lib/stripe/resolve-subscription";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { verifyCustomerOwnership } from "@/lib/server/subscription-verify";
import { requireAuth } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const rl = await enforceRateLimit(req, "stripe-subscription", 30, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const customerId = req.nextUrl.searchParams.get("customerId");
  const requestedEmail = req.nextUrl.searchParams.get("email")?.trim().toLowerCase() ?? null;
  const email = auth.user.email.trim().toLowerCase();

  if (requestedEmail && requestedEmail !== email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (customerId) {
    const owns = await verifyCustomerOwnership(customerId, email);
    if (!owns) {
      return NextResponse.json({ error: "Subscription verification failed" }, { status: 403 });
    }
  }

  try {
    const resolved = await resolveSubscriptionFromStripe({ customerId, email });
    return NextResponse.json({
      subscription: resolved.subscription,
      source: resolved.source,
    });
  } catch (err) {
    console.error("Subscription lookup error:", err);
    return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 });
  }
}
