import { isKvConfigured } from "./env";

const memory = new Map<string, { value: string; expiresAt: number | null }>();

function memoryGet(key: string): string | null {
  const entry = memory.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
    memory.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key: string, value: string, ttlSeconds?: number): void {
  memory.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
  });
}

function kvHeaders(): HeadersInit {
  return { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN!}` };
}

export async function kvGet(key: string): Promise<string | null> {
  if (!isKvConfigured()) return memoryGet(key);

  const url = process.env.KV_REST_API_URL!;
  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: kvHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result?: string | null };
  return data.result ?? null;
}

export async function kvSet(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
  if (!isKvConfigured()) {
    memorySet(key, value, ttlSeconds);
    return true;
  }

  const url = process.env.KV_REST_API_URL!;
  const query = ttlSeconds ? `?EX=${ttlSeconds}` : "";
  const res = await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}${query}`, {
    method: "POST",
    headers: kvHeaders(),
    cache: "no-store",
  });
  return res.ok;
}

/** Returns true if key was set (first time). False if key already existed. */
export async function kvSetNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  if (!isKvConfigured()) {
    if (memoryGet(key)) return false;
    memorySet(key, value, ttlSeconds);
    return true;
  }

  const url = process.env.KV_REST_API_URL!;
  const res = await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?NX=true&EX=${ttlSeconds}`, {
    method: "POST",
    headers: kvHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { result?: string | null };
  return data.result === "OK";
}

export async function kvIncr(key: string): Promise<number> {
  if (!isKvConfigured()) {
    const current = parseInt(memoryGet(key) ?? "0", 10);
    const next = current + 1;
    memorySet(key, String(next), 3600);
    return next;
  }

  const url = process.env.KV_REST_API_URL!;
  const res = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: kvHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return Number.MAX_SAFE_INTEGER;
  const data = (await res.json()) as { result?: number };
  return typeof data.result === "number" ? data.result : Number.MAX_SAFE_INTEGER;
}

export async function kvExpire(key: string, ttlSeconds: number): Promise<void> {
  if (!isKvConfigured()) {
    const val = memoryGet(key);
    if (val !== null) memorySet(key, val, ttlSeconds);
    return;
  }

  const url = process.env.KV_REST_API_URL!;
  await fetch(`${url}/expire/${encodeURIComponent(key)}/${ttlSeconds}`, {
    method: "POST",
    headers: kvHeaders(),
    cache: "no-store",
  }).catch(() => null);
}
