import type { Subscription } from "@/lib/profile/types";
import { isProActive } from "@/lib/subscription/plans";

/** Never downgrade an active Pro subscription when merging local and server profiles. */
export function mergeSubscriptions(local: Subscription, server: Subscription): Subscription {
  const localPro = isProActive(local);
  const serverPro = isProActive(server);

  if (serverPro && !localPro) {
    return {
      ...server,
      stripeCustomerId: server.stripeCustomerId ?? local.stripeCustomerId,
      stripeSubscriptionId: server.stripeSubscriptionId ?? local.stripeSubscriptionId,
      startedAt: server.startedAt ?? local.startedAt,
    };
  }

  if (localPro && !serverPro) {
    return {
      ...local,
      stripeCustomerId: local.stripeCustomerId ?? server.stripeCustomerId,
      stripeSubscriptionId: local.stripeSubscriptionId ?? server.stripeSubscriptionId,
      startedAt: local.startedAt ?? server.startedAt,
    };
  }

  if (localPro && serverPro) {
    const prefer = server.stripeSubscriptionId ? server : local;
    const other = prefer === server ? local : server;
    return {
      ...prefer,
      stripeCustomerId: prefer.stripeCustomerId ?? other.stripeCustomerId,
      stripeSubscriptionId: prefer.stripeSubscriptionId ?? other.stripeSubscriptionId,
      currentPeriodEnd: prefer.currentPeriodEnd ?? other.currentPeriodEnd,
      startedAt: prefer.startedAt ?? other.startedAt,
    };
  }

  return {
    ...server,
    stripeCustomerId: server.stripeCustomerId ?? local.stripeCustomerId,
    stripeSubscriptionId: server.stripeSubscriptionId ?? local.stripeSubscriptionId,
    currentPeriodEnd: server.currentPeriodEnd ?? local.currentPeriodEnd,
    startedAt: server.startedAt ?? local.startedAt,
  };
}
