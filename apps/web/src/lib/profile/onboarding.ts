import type { UserProfile } from "./types";

/** New signups within this window still see onboarding; older accounts skip it. */
const NEW_ACCOUNT_GRACE_MS = 30 * 60 * 1000;

export function resolveOnboardingComplete(
  profile: UserProfile,
  options?: { userCreatedAt?: string | Date | null }
): boolean {
  if (profile.onboardingComplete) return true;

  const hasName = !!(
    profile.personal.fullName?.trim() ||
    profile.business.name?.trim() ||
    profile.organization.name?.trim() ||
    profile.account.displayName?.trim()
  );
  const hasEmail = !!profile.account.email?.trim();
  const hasAccountId = !!profile.account.accountId?.trim();

  if (!hasName || !hasEmail || !hasAccountId) return false;

  if (options?.userCreatedAt) {
    const userCreated = new Date(options.userCreatedAt).getTime();
    if (!Number.isNaN(userCreated) && Date.now() - userCreated > NEW_ACCOUNT_GRACE_MS) {
      return true;
    }
  }

  const created = new Date(profile.createdAt).getTime();
  const updated = new Date(profile.updatedAt).getTime();
  if (updated - created > 5000) return true;

  if (profile.profileType !== "mixed") return true;
  if (profile.business.industry || profile.personal.title || profile.business.logo) return true;

  return false;
}
