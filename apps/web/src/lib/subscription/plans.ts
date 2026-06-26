import type { Subscription, SubscriptionPlan, SubscriptionStatus } from "@/lib/profile/types";

export type PlanFeature =
  | "pdfClean"
  | "teamSharing"
  | "unlimitedDocs"
  | "emailShare"
  | "securityScan"
  | "documentPackets"
  | "cloudSync"
  | "letterheadThemes";

export interface PlanDefinition {
  id: SubscriptionPlan;
  name: string;
  price: number;
  interval: "forever" | "month" | "year";
  description: string;
  features: string[];
  highlighted?: boolean;
  savings?: string;
}

export interface EffectiveSubscription {
  /** Plan used for feature gates (free when Pro is not active) */
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  isProActive: boolean;
  /** Raw plan stored on the profile (may be pending checkout) */
  selectedPlan: SubscriptionPlan;
  billingLabel: string;
}

export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    interval: "forever",
    description: "Get started with essential documents",
    features: [
      "10 documents per month",
      "20 favorite templates",
      "3 document packets (10 items each)",
      "120+ templates",
      "Profile auto-fill & logo",
      "PDF & print (watermarked)",
      "Sign documents shared with you",
      "Email to yourself only",
    ],
  },
  {
    id: "monthly",
    name: "Pro Monthly",
    price: 19.99,
    interval: "month",
    description: "Full power for growing businesses",
    features: [
      "Unlimited documents",
      "Unlimited favorites & packets",
      "Clean PDF export",
      "Security scan & redaction",
      "Team profile sharing (up to 5)",
      "Cloud sync & file portal",
      "Email & share links",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    id: "yearly",
    name: "Pro Yearly",
    price: 129.99,
    interval: "year",
    description: "Best value — save vs monthly",
    savings: "Save $110/year",
    features: [
      "Everything in Pro Monthly",
      "Team profile sharing (up to 15)",
      "Custom letterhead themes",
      "Advanced form builder",
      "Dedicated onboarding",
    ],
  },
];

export function getPlan(id: SubscriptionPlan): PlanDefinition {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export function isProPlan(plan: SubscriptionPlan): boolean {
  return plan === "monthly" || plan === "yearly";
}

export function isProActive(subscription: Subscription): boolean {
  if (!isProPlan(subscription.plan)) return false;
  if (subscription.status === "active" || subscription.status === "trialing") return true;
  if (
    subscription.status === "canceled" &&
    subscription.currentPeriodEnd &&
    new Date(subscription.currentPeriodEnd) > new Date()
  ) {
    return true;
  }
  return false;
}

export function getEffectiveSubscription(subscription: Subscription): EffectiveSubscription {
  const active = isProActive(subscription);
  const plan = active ? subscription.plan : "free";
  const status = active ? subscription.status : "none";
  const billingLabel = active
    ? getPlan(subscription.plan).name
    : isProPlan(subscription.plan) && subscription.status === "pending"
      ? `${getPlan(subscription.plan).name} (pending payment)`
      : isProPlan(subscription.plan) && (subscription.status === "past_due" || subscription.status === "canceled")
        ? `${getPlan(subscription.plan).name} (inactive — update billing)`
        : getPlan("free").name;

  return {
    plan,
    status,
    isProActive: active,
    selectedPlan: subscription.plan,
    billingLabel,
  };
}

export function canUseFeature(subscription: Subscription, feature: PlanFeature): boolean {
  const eff = getEffectiveSubscription(subscription);

  switch (feature) {
    case "pdfClean":
    case "unlimitedDocs":
    case "emailShare":
    case "securityScan":
    case "cloudSync":
      return eff.isProActive;
    case "teamSharing":
      return eff.isProActive;
    case "documentPackets":
      return true;
    case "letterheadThemes":
      return eff.isProActive && eff.plan === "yearly";
    default:
      return true;
  }
}

/** @deprecated Use canUseFeature(subscription, feature) */
export function canUseFeatureLegacy(
  plan: SubscriptionPlan,
  status: string,
  feature: PlanFeature
): boolean {
  return canUseFeature({ plan, status: status as SubscriptionStatus } as Subscription, feature);
}

export function maxTeamMembers(subscription: Subscription): number {
  const eff = getEffectiveSubscription(subscription);
  if (!eff.isProActive) return 0;
  if (eff.plan === "yearly") return 15;
  if (eff.plan === "monthly") return 5;
  return 0;
}

export function maxFavorites(subscription: Subscription): number {
  return getEffectiveSubscription(subscription).isProActive ? Infinity : 20;
}

export function maxPackets(subscription: Subscription): number {
  return getEffectiveSubscription(subscription).isProActive ? Infinity : 3;
}

export function maxPacketItems(subscription: Subscription): number {
  return getEffectiveSubscription(subscription).isProActive ? 50 : 10;
}

export function planIncludesFeature(planId: SubscriptionPlan, feature: string): boolean {
  return getPlan(planId).features.some((f) => f.toLowerCase().includes(feature.toLowerCase()));
}

export interface EnterprisePlanDefinition {
  name: string;
  priceLabel: string;
  description: string;
  features: string[];
}

export const ENTERPRISE_PLAN: EnterprisePlanDefinition = {
  name: "Enterprise",
  priceLabel: "Custom",
  description: "For larger teams and organizations with advanced needs",
  features: [
    "Unlimited team members",
    "SSO & advanced security controls",
    "Custom templates & workflows",
    "Dedicated account manager",
    "Priority SLA & onboarding",
    "Invoice billing & procurement support",
  ],
};
