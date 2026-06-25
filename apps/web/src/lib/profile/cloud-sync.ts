import type { UserProfile } from "./types";
import { mergeTeamMembersByEmail } from "@/lib/team/members-merge";
import { mergeSubscriptions } from "@/lib/profile/subscription-merge";

export async function fetchServerProfile(): Promise<UserProfile | null> {
  const res = await fetch("/api/profile", { credentials: "include", cache: "no-store" });
  if (res.status === 401 || res.status === 503) return null;
  if (!res.ok) return null;
  const data = await res.json() as { profile: UserProfile };
  return data.profile;
}

export async function pushServerProfile(
  profile: UserProfile
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch("/api/profile", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  });
  if (res.ok) return { ok: true };
  let error = "Could not save profile to your account";
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error) error = data.error;
  } catch {
    if (res.status === 413) error = "Profile data is too large to sync — try a smaller logo";
  }
  return { ok: false, error };
}

/** Prefer server profile when it was updated more recently, but never lose logos or onboarding progress. */
export function mergeProfiles(local: UserProfile, server: UserProfile): UserProfile {
  const localTs = new Date(local.updatedAt).getTime();
  const serverTs = new Date(server.updatedAt).getTime();
  const base = serverTs >= localTs ? server : local;
  const other = serverTs >= localTs ? local : server;
  return {
    ...base,
    business: {
      ...base.business,
      logo: base.business.logo ?? other.business.logo,
    },
    organization: {
      ...base.organization,
      logo: base.organization.logo ?? other.organization.logo,
    },
    onboardingComplete: base.onboardingComplete || other.onboardingComplete,
    subscription: mergeSubscriptions(local.subscription, server.subscription),
    team: {
      ...base.team,
      ...other.team,
      teamId: base.team.teamId || other.team.teamId,
      orgName: base.team.orgName || other.team.orgName,
      members: mergeTeamMembersByEmail(
        base.team.ownerEmail ?? other.team.ownerEmail,
        base.team.members,
        other.team.members
      ),
      memberships: [...(base.team.memberships ?? []), ...(other.team.memberships ?? [])].filter(
        (m, i, arr) => arr.findIndex((x) => x.teamId === m.teamId) === i
      ),
    },
    library: {
      ...base.library,
      ...other.library,
      favoriteTemplateIds:
        base.library.favoriteTemplateIds.length >= other.library.favoriteTemplateIds.length
          ? base.library.favoriteTemplateIds
          : other.library.favoriteTemplateIds,
      contacts:
        (base.library.contacts?.length ?? 0) >= (other.library.contacts?.length ?? 0)
          ? base.library.contacts
          : other.library.contacts,
    },
  };
}
