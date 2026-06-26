/** Routes visitors can open without an account (browse-only; actions require signup). */
export const GUEST_BROWSE_PATHS = ["/documents", "/packets", "/team"] as const;

/** Default landing path for guest browse CTAs */
export const GUEST_BROWSE_ENTRY_PATH = "/documents";

export function isGuestBrowsePath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if ((GUEST_BROWSE_PATHS as readonly string[]).includes(pathname)) return true;
  if (/^\/documents\/[^/]+$/.test(pathname)) return true;
  return false;
}
