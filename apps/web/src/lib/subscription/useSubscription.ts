"use client";

import { useMemo } from "react";
import { useProfile } from "@/components/ProfileProvider";
import {
  canUseFeature,
  getEffectiveSubscription,
  maxFavorites,
  maxPacketItems,
  maxPackets,
  maxTeamMembers,
  type PlanFeature,
} from "./plans";

export function useSubscription() {
  const { profile } = useProfile();
  const subscription = profile.subscription;

  return useMemo(() => {
    const effective = getEffectiveSubscription(subscription);
    return {
      subscription,
      effective,
      canUse: (feature: PlanFeature) => canUseFeature(subscription, feature),
      maxTeamMembers: maxTeamMembers(subscription),
      maxFavorites: maxFavorites(subscription),
      maxPackets: maxPackets(subscription),
      maxPacketItems: maxPacketItems(subscription),
    };
  }, [subscription]);
}
