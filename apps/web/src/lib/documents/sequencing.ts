import {
  formatDocumentNumber,
  getTemplateNumberPrefix,
} from "@doc-solid/documents";

const SEQUENCE_PREFIX = "doc-solid-sequences-v1";

export interface SequenceRegistry {
  counters: Record<string, number>;
  issued: Record<string, string[]>;
}

function sequenceKey(userId: string | null): string {
  return userId ? `${SEQUENCE_PREFIX}-${userId}` : SEQUENCE_PREFIX;
}

function loadRegistry(userId: string | null): SequenceRegistry {
  if (typeof window === "undefined") return { counters: {}, issued: {} };
  try {
    const raw = localStorage.getItem(sequenceKey(userId));
    if (!raw) return { counters: {}, issued: {} };
    const parsed = JSON.parse(raw) as Partial<SequenceRegistry>;
    return {
      counters: parsed.counters ?? {},
      issued: parsed.issued ?? {},
    };
  } catch {
    return { counters: {}, issued: {} };
  }
}

function saveRegistry(userId: string | null, registry: SequenceRegistry): void {
  localStorage.setItem(sequenceKey(userId), JSON.stringify(registry));
}

export function peekNextSequence(userId: string | null, templateId: string): number {
  const registry = loadRegistry(userId);
  return (registry.counters[templateId] ?? 0) + 1;
}

export function peekNextDocumentNumber(
  userId: string | null,
  templateId: string,
  accountCode?: string
): string {
  const prefix = getTemplateNumberPrefix(templateId);
  const next = peekNextSequence(userId, templateId);
  return formatDocumentNumber(prefix, next, accountCode);
}

export function commitDocumentNumber(
  userId: string | null,
  templateId: string,
  accountCode?: string
): string {
  const registry = loadRegistry(userId);
  const next = (registry.counters[templateId] ?? 0) + 1;
  registry.counters[templateId] = next;
  if (!registry.issued[templateId]) registry.issued[templateId] = [];
  const number = formatDocumentNumber(getTemplateNumberPrefix(templateId), next, accountCode);
  registry.issued[templateId].push(number);
  saveRegistry(userId, registry);
  return number;
}

export function getSequenceStats(userId: string | null): {
  totalIssued: number;
  byTemplate: Record<string, { count: number; lastNumber: string | null }>;
} {
  const registry = loadRegistry(userId);
  const byTemplate: Record<string, { count: number; lastNumber: string | null }> = {};

  for (const [templateId, count] of Object.entries(registry.counters)) {
    const issued = registry.issued[templateId] ?? [];
    byTemplate[templateId] = {
      count,
      lastNumber: issued[issued.length - 1] ?? null,
    };
  }

  const totalIssued = Object.values(registry.counters).reduce((sum, n) => sum + n, 0);
  return { totalIssued, byTemplate };
}

export function clearSequenceRegistry(userId: string | null): void {
  localStorage.removeItem(sequenceKey(userId));
}
