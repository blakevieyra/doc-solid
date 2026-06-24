export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isKvConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/** In production, subscription + webhook state must use durable KV — not in-memory fallbacks. */
export function kvRequiredForProd(): boolean {
  return isProduction() && !isKvConfigured();
}

export function getAppOrigin(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL ??
    (isProduction() ? "https://docsolid.app" : "http://localhost:3000");
  try {
    return new URL(url).origin;
  } catch {
    return isProduction() ? "https://docsolid.app" : "http://localhost:3000";
  }
}
