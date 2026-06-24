import { parseLineItems, formatCurrency } from "./lineItems";

const FINANCIAL_TOTAL_IDS = new Set(["subtotal", "taxRate", "taxAmount", "total"]);

export function isFinancialTotalField(fieldId: string): boolean {
  return FINANCIAL_TOTAL_IDS.has(fieldId);
}

/** Humanize camelCase / snake keys for table headers. */
export function humanizeColumnKey(key: string): string {
  if (key === "id") return "ID";
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isAmountKey(key: string): boolean {
  return /amount|total|rate|price|cost|budget|debit|credit|planned|actual|budgeted/i.test(key);
}

export function formatTableCell(key: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "number" && isAmountKey(key)) {
    return formatCurrency(value);
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function tryParseJsonRecords(raw: string): Record<string, unknown>[] | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return null;
      if (typeof parsed[0] === "object" && parsed[0] !== null) {
        return parsed as Record<string, unknown>[];
      }
      return parsed.map((entry, i) => ({ Item: entry, "#": i + 1 }));
    }
    if (typeof parsed === "object" && parsed !== null) {
      return [parsed as Record<string, unknown>];
    }
  } catch {
    return null;
  }
  return null;
}

export function tableColumnsFromRows(rows: Record<string, unknown>[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (key === "id" && rows.every((r) => /^li_|^row_/.test(String(r.id ?? "")))) continue;
      keys.add(key);
    }
  }
  const preferred = ["description", "qty", "quantity", "rate", "amount", "date", "category", "name", "title"];
  return [...keys].sort((a, b) => {
    const ai = preferred.indexOf(a);
    const bi = preferred.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
}

/** Bullet list fallback for simple JSON arrays of strings. */
export function formatJsonAsList(raw: string): string[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed as string[];
    }
  } catch {
    return null;
  }
  return null;
}

export function isLineItemsField(fieldId: string): boolean {
  return fieldId === "lineItems";
}

export function lineItemsHasVisibleRows(raw: string): boolean {
  return parseLineItems(raw).some(
    (i) =>
      i.description?.trim() ||
      i.amount > 0 ||
      i.rate > 0 ||
      (i.qty > 0 && i.qty !== 1)
  );
}
