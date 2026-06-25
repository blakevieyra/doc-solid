import type { SecurityScanResult } from "./document-scan";

const PREFIX = "doc-solid-security-scans-v1";
const LEGACY_PREFIX = "doc-solid-ai-scans-v1";

function key(userId: string | null, prefix: string): string {
  return userId ? `${prefix}-${userId}` : prefix;
}

function readHistory(userId: string | null, prefix: string): SecurityScanResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(userId, prefix));
    if (!raw) return [];
    return JSON.parse(raw) as SecurityScanResult[];
  } catch {
    return [];
  }
}

export function loadScanHistory(userId: string | null): SecurityScanResult[] {
  const current = readHistory(userId, PREFIX);
  if (current.length > 0) return current;

  const legacy = readHistory(userId, LEGACY_PREFIX);
  if (legacy.length === 0) return [];

  localStorage.setItem(key(userId, PREFIX), JSON.stringify(legacy));
  localStorage.removeItem(key(userId, LEGACY_PREFIX));
  return legacy;
}

export function saveScanResult(userId: string | null, result: SecurityScanResult): void {
  const history = loadScanHistory(userId);
  history.unshift(result);
  localStorage.setItem(key(userId, PREFIX), JSON.stringify(history.slice(0, 50)));
}

export function clearScanHistory(userId: string | null): void {
  localStorage.removeItem(key(userId, PREFIX));
  localStorage.removeItem(key(userId, LEGACY_PREFIX));
}
