import type { UserProfile } from "@/lib/profile/types";
import { maxFavorites } from "@/lib/subscription/plans";

export function getFavoriteTemplateIds(profile: UserProfile): string[] {
  return profile.library?.favoriteTemplateIds ?? [];
}

export function getFavoriteLocalIds(profile: UserProfile): string[] {
  return profile.library?.favoriteLocalIds ?? [];
}

export function isFavorite(profile: UserProfile, templateId: string): boolean {
  return getFavoriteTemplateIds(profile).includes(templateId);
}

export function isLocalDocFavorite(profile: UserProfile, localId: string): boolean {
  return getFavoriteLocalIds(profile).includes(localId);
}

export function isSavedDocFavorite(
  profile: UserProfile,
  doc: { localId: string; templateId: string },
): boolean {
  return (
    isLocalDocFavorite(profile, doc.localId) ||
    isFavorite(profile, doc.templateId)
  );
}

/** Saved files matching favorites, or template favorite count when none are saved yet */
export function getPortalFavoriteCount(
  profile: UserProfile,
  documents: Array<{ localId: string; templateId: string }>,
): number {
  const savedMatches = documents.filter((d) => isSavedDocFavorite(profile, d)).length;
  const templateCount = getFavoriteTemplateIds(profile).length;
  return savedMatches > 0 ? savedMatches : templateCount;
}

export function toggleFavorite(
  profile: UserProfile,
  templateId: string
): { favorites: string[]; error?: string } {
  const current = getFavoriteTemplateIds(profile);
  if (current.includes(templateId)) {
    return { favorites: current.filter((id) => id !== templateId) };
  }
  const limit = maxFavorites(profile.subscription);
  if (current.length >= limit) {
    return {
      favorites: current,
      error: limit === Infinity
        ? "Could not add favorite"
        : `Free plan allows ${limit} favorites. Upgrade to Pro for unlimited.`,
    };
  }
  return { favorites: [...current, templateId] };
}

export function toggleFavoriteLocal(
  profile: UserProfile,
  localId: string,
): { favorites: string[] } {
  const current = getFavoriteLocalIds(profile);
  if (current.includes(localId)) {
    return { favorites: current.filter((id) => id !== localId) };
  }
  return { favorites: [...current, localId] };
}

/** Favorites require a signed-in account and sync to the server profile — never guest localStorage. */
export function canManageFavorites(hasSession: boolean): boolean {
  return hasSession;
}
