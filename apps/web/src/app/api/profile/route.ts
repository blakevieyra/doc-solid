import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/session";
import { getUserProfile, saveUserProfile } from "@/lib/server/users";
import { DEFAULT_PROFILE, type UserProfile } from "@/lib/profile/types";
import { resolveOnboardingComplete } from "@/lib/profile/onboarding";
import { rejectIfBodyTooLarge } from "@/lib/server/rate-limit";
import { reconcileProfileSubscription } from "@/lib/server/profile-subscription";

export const runtime = "nodejs";

async function withReconciledSubscription(profile: UserProfile, email: string): Promise<UserProfile> {
  const subscription = await reconcileProfileSubscription(email, profile.subscription);
  if (
    subscription.plan === profile.subscription.plan &&
    subscription.status === profile.subscription.status &&
    subscription.stripeSubscriptionId === profile.subscription.stripeSubscriptionId
  ) {
    return profile;
  }
  return { ...profile, subscription, updatedAt: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  let profile = await getUserProfile(auth.user.id);
  if (!profile) {
    return NextResponse.json({ profile: structuredClone(DEFAULT_PROFILE) });
  }

  if (resolveOnboardingComplete(profile, { userCreatedAt: auth.user.createdAt }) && !profile.onboardingComplete) {
    profile = {
      ...profile,
      onboardingComplete: true,
      updatedAt: new Date().toISOString(),
    };
  }

  if (
    (profile.subscription.status === "active" || profile.subscription.status === "trialing") &&
    !profile.onboardingComplete
  ) {
    profile = {
      ...profile,
      onboardingComplete: true,
      updatedAt: new Date().toISOString(),
    };
  }

  profile = await withReconciledSubscription(profile, auth.user.email);
  await saveUserProfile(auth.user.id, profile);

  return NextResponse.json({ profile });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  if (rejectIfBodyTooLarge(req, 4_500_000)) {
    return NextResponse.json({ error: "Profile payload too large" }, { status: 413 });
  }

  const body = await req.json() as { profile?: UserProfile };
  if (!body.profile) {
    return NextResponse.json({ error: "Profile is required" }, { status: 400 });
  }

  const existing = await getUserProfile(auth.user.id);
  const incoming = body.profile.subscription;

  const subscriptionSeed = {
    plan: existing?.subscription.plan ?? "free",
    status: existing?.subscription.status ?? "none",
    stripeCustomerId: incoming.stripeCustomerId ?? existing?.subscription.stripeCustomerId,
    stripeSubscriptionId: incoming.stripeSubscriptionId ?? existing?.subscription.stripeSubscriptionId,
    currentPeriodEnd: existing?.subscription.currentPeriodEnd,
    startedAt: incoming.startedAt ?? existing?.subscription.startedAt,
  };

  const next: UserProfile = {
    ...body.profile,
    updatedAt: new Date().toISOString(),
    onboardingComplete:
      existing?.onboardingComplete ||
      body.profile.onboardingComplete ||
      resolveOnboardingComplete(body.profile, { userCreatedAt: auth.user.createdAt }),
    account: {
      ...body.profile.account,
      email: body.profile.account.email || auth.user.email,
      displayName: body.profile.account.displayName || auth.user.name,
    },
    subscription: await reconcileProfileSubscription(auth.user.email, subscriptionSeed),
  };

  await saveUserProfile(auth.user.id, next);
  return NextResponse.json({ profile: next });
}
