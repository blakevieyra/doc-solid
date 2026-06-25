import type { Address, UserProfile } from "./types";
import { mergeTeamMembersByEmail } from "@/lib/team/members-merge";
import { mergeSubscriptions } from "@/lib/profile/subscription-merge";
import { ensureSignatureLibrary, mergeSignatureLibraries } from "./signature-library";

function resolveTeamOwnerEmail(a: UserProfile, b: UserProfile): string | null {
  for (const profile of [a, b]) {
    const fromField = profile.team.ownerEmail?.trim().toLowerCase();
    if (fromField) return fromField;
    const ownerMember = profile.team.members.find((m) => m.role === "owner");
    if (ownerMember?.email) return ownerMember.email.trim().toLowerCase();
  }
  return null;
}

function mergeSection<T>(primary: T, secondary: T): T {
  return { ...secondary, ...primary };
}

function mergeAddress(primary: Address, secondary: Address): Address {
  return {
    street: primary.street || secondary.street,
    city: primary.city || secondary.city,
    state: primary.state || secondary.state,
    zip: primary.zip || secondary.zip,
    country: primary.country || secondary.country,
  };
}

function mergeUniqueStrings(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
}

export async function fetchServerProfile(): Promise<UserProfile | null> {
  const res = await fetch("/api/profile", { credentials: "include", cache: "no-store" });
  if (res.status === 401 || res.status === 503) return null;
  if (!res.ok) return null;
  const data = await res.json() as { profile: UserProfile };
  return data.profile;
}

export async function pushServerProfile(
  profile: UserProfile
): Promise<{ ok: true; profile: UserProfile } | { ok: false; error: string }> {
  const res = await fetch("/api/profile", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  });
  if (res.ok) {
    const data = (await res.json()) as { profile: UserProfile };
    return { ok: true, profile: data.profile };
  }
  let error = "Could not save profile to your account";
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error) error = data.error;
  } catch {
    if (res.status === 413) error = "Profile data is too large to sync — try a smaller logo";
  }
  return { ok: false, error };
}

/** Merge local and server profiles without losing user-edited business/personal/org fields. */
export function mergeProfiles(local: UserProfile, server: UserProfile): UserProfile {
  const localTs = new Date(local.updatedAt).getTime();
  const serverTs = new Date(server.updatedAt).getTime();
  const localNewer = localTs > serverTs;
  const primary = localNewer ? local : server;
  const secondary = localNewer ? server : local;
  const ownerEmail = resolveTeamOwnerEmail(local, server);

  const business = mergeSection(primary.business, secondary.business);
  business.address = mergeAddress(primary.business.address, secondary.business.address);
  business.logo = primary.business.logo ?? secondary.business.logo;

  const personal = mergeSection(primary.personal, secondary.personal);
  personal.address = mergeAddress(primary.personal.address, secondary.personal.address);
  personal.photo = primary.personal.photo ?? secondary.personal.photo;

  const organization = mergeSection(primary.organization, secondary.organization);
  organization.address = mergeAddress(primary.organization.address, secondary.organization.address);
  organization.logo = primary.organization.logo ?? secondary.organization.logo;

  const primarySignatures = ensureSignatureLibrary(primary);
  const secondarySignatures = ensureSignatureLibrary(secondary);
  const mergedSignatures = mergeSignatureLibraries(
    localNewer ? primarySignatures : secondarySignatures,
    localNewer ? secondarySignatures : primarySignatures,
  );
  mergedSignatures.activeContext = (localNewer ? primarySignatures : secondarySignatures).activeContext;
  const signature = mergedSignatures.byContext[mergedSignatures.activeContext];

  return {
    ...primary,
    updatedAt: new Date(Math.max(localTs, serverTs)).toISOString(),
    business,
    personal,
    organization,
    account: mergeSection(primary.account, secondary.account),
    preferences: mergeSection(primary.preferences, secondary.preferences),
    signatures: mergedSignatures,
    signature,
    security: mergeSection(primary.security, secondary.security),
    onboardingComplete: local.onboardingComplete || server.onboardingComplete,
    subscription: mergeSubscriptions(local.subscription, server.subscription),
    team: {
      ...primary.team,
      ...secondary.team,
      teamId: primary.team.teamId || secondary.team.teamId,
      orgName: primary.team.orgName || secondary.team.orgName,
      ownerEmail: ownerEmail ?? primary.team.ownerEmail ?? secondary.team.ownerEmail,
      ownerName: primary.team.ownerName || secondary.team.ownerName,
      members: mergeTeamMembersByEmail(
        ownerEmail ?? primary.team.ownerEmail ?? secondary.team.ownerEmail,
        primary.team.members,
        secondary.team.members
      ),
      memberships: [...(primary.team.memberships ?? []), ...(secondary.team.memberships ?? [])].filter(
        (m, i, arr) => arr.findIndex((x) => x.teamId === m.teamId) === i
      ),
    },
    library: {
      ...primary.library,
      ...secondary.library,
      favoriteTemplateIds: mergeUniqueStrings(
        primary.library?.favoriteTemplateIds ?? [],
        secondary.library?.favoriteTemplateIds ?? []
      ),
      favoriteLocalIds: mergeUniqueStrings(
        primary.library?.favoriteLocalIds ?? [],
        secondary.library?.favoriteLocalIds ?? []
      ),
      packets:
        (primary.library?.packets?.length ?? 0) >= (secondary.library?.packets?.length ?? 0)
          ? (primary.library?.packets ?? [])
          : (secondary.library?.packets ?? []),
      contacts:
        (primary.library.contacts?.length ?? 0) >= (secondary.library.contacts?.length ?? 0)
          ? primary.library.contacts
          : secondary.library.contacts,
    },
  };
}
