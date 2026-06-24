import type { LocalDocument } from "@doc-solid/storage";

export const FREE_MONTHLY_DOC_LIMIT = 10;

export function documentsCreatedThisMonth(docs: LocalDocument[]): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return docs.filter((d) => {
    const created = d.createdAt ?? d.updatedAt;
    return new Date(created) >= monthStart;
  }).length;
}

export function canCreateDocumentThisMonth(
  docs: LocalDocument[],
  isPro: boolean
): { allowed: boolean; used: number; limit: number } {
  if (isPro) {
    return { allowed: true, used: documentsCreatedThisMonth(docs), limit: Infinity };
  }
  const used = documentsCreatedThisMonth(docs);
  return { allowed: used < FREE_MONTHLY_DOC_LIMIT, used, limit: FREE_MONTHLY_DOC_LIMIT };
}
