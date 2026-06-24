import type { SubscriptionPlan, SubscriptionStatus } from "@/lib/profile/types";
import { kvGet, kvSet } from "@/lib/server/kv";
import { isProduction, isKvConfigured } from "@/lib/server/env";

export interface StoredSubscription {
  email: string;
  userId?: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd?: string;
  startedAt?: string;
  updatedAt: string;
}

/** Dev-only fallback when KV is not configured locally. */
const devMemory = new Map<string, StoredSubscription>();

function emailKey(email: string) {
  return `sub:email:${email.toLowerCase()}`;
}

function customerKey(customerId: string) {
  return `sub:cust:${customerId}`;
}

async function readRecord(key: string): Promise<StoredSubscription | null> {
  if (!isKvConfigured()) {
    if (isProduction()) return null;
    return devMemory.get(key) ?? null;
  }

  const raw = await kvGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSubscription;
  } catch {
    return null;
  }
}

async function writeRecord(key: string, value: StoredSubscription): Promise<void> {
  if (!isKvConfigured()) {
    if (isProduction()) {
      throw new Error("KV storage required in production for subscriptions");
    }
    devMemory.set(key, value);
    return;
  }

  const ok = await kvSet(key, JSON.stringify(value));
  if (!ok) {
    throw new Error(`Failed to persist subscription key ${key}`);
  }
}

export async function saveSubscription(record: StoredSubscription): Promise<void> {
  const normalized = {
    ...record,
    email: record.email.toLowerCase(),
    updatedAt: new Date().toISOString(),
  };
  await writeRecord(emailKey(normalized.email), normalized);
  await writeRecord(customerKey(normalized.stripeCustomerId), normalized);
}

export async function getSubscriptionByEmail(email: string): Promise<StoredSubscription | null> {
  return readRecord(emailKey(email));
}

export async function getSubscriptionByCustomerId(customerId: string): Promise<StoredSubscription | null> {
  return readRecord(customerKey(customerId));
}

export function subscriptionsAvailable(): boolean {
  return isKvConfigured() || !isProduction();
}
