import type { SecurityScanResult } from "./securityScan";

const PREFIX = "doc-solid-ai-scans-v1";

function key(userId: string | null): string {
  return userId ? `${PREFIX}-${userId}` : PREFIX;
}

export function loadScanHistory(userId: string | null): SecurityScanResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return [];
    return JSON.parse(raw) as SecurityScanResult[];
  } catch {
    return [];
  }
}

export function saveScanResult(userId: string | null, result: SecurityScanResult): void {
  const history = loadScanHistory(userId);
  history.unshift(result);
  localStorage.setItem(key(userId), JSON.stringify(history.slice(0, 50)));
}

export function clearScanHistory(userId: string | null): void {
  localStorage.removeItem(key(userId));
}
