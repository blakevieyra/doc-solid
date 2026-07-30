import { resolveSubscriptionFromStripe } from "@/lib/stripe/resolve-subscription";
import { canUseFeature, maxTeamMembers } from "@/lib/subscription/plans";

export type TeamLimitCheck = { ok: true } | { ok: false; error: string };

/**
 * Server-authoritative check for whether an owner's plan (verified against Stripe,
 * not the client-saved profile) allows adding another active team member.
 */
export async function assertTeamMemberCanBeAdded(
  ownerEmail: string,
  currentActiveMemberCount: number
): Promise<TeamLimitCheck> {
  const { subscription } = await resolveSubscriptionFromStripe({ email: ownerEmail });

  if (!canUseFeature(subscription, "teamSharing")) {
    return { ok: false, error: "Team sharing is a Pro feature. The team owner needs to upgrade." };
  }

  const limit = maxTeamMembers(subscription);
  if (currentActiveMemberCount >= limit) {
    return {
      ok: false,
      error: `This team's plan allows up to ${limit} members. The owner needs to upgrade to add more.`,
    };
  }

  return { ok: true };
}
