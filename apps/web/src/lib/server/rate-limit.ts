import { NextRequest } from "next/server";
import { kvIncr, kvExpire } from "./kv";

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfterSec?: number;
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Fixed-window rate limiter backed by KV (or in-memory in dev).
 */
export async function rateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const key = `rl:${bucket}:${identifier}`;
  const count = await kvIncr(key);

  if (count === 1) {
    await kvExpire(key, windowSec);
  }

  if (count > limit) {
    return { ok: false, limit, remaining: 0, retryAfterSec: windowSec };
  }

  return { ok: true, limit, remaining: Math.max(0, limit - count) };
}

export async function enforceRateLimit(
  req: NextRequest,
  bucket: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const ip = getClientIp(req);
  return rateLimit(bucket, ip, limit, windowSec);
}

/** Reject oversized JSON bodies before parsing (Content-Length header). */
export function rejectIfBodyTooLarge(req: NextRequest, maxBytes: number): boolean {
  const len = req.headers.get("content-length");
  if (!len) return false;
  const n = parseInt(len, 10);
  return Number.isFinite(n) && n > maxBytes;
}
