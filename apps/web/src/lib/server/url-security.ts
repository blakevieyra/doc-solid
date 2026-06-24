import { getAppOrigin } from "./env";

export function isAllowedRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const allowed = new URL(getAppOrigin());
    return parsed.origin === allowed.origin;
  } catch {
    return false;
  }
}

export function resolveRedirectUrl(preferred: string | undefined, fallbackPath: string): string {
  const origin = getAppOrigin();
  const fallback = `${origin}${fallbackPath.startsWith("/") ? fallbackPath : `/${fallbackPath}`}`;
  if (preferred && isAllowedRedirectUrl(preferred)) return preferred;
  return fallback;
}
