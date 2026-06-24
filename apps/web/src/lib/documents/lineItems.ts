export interface LineItem {
  id: string;
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

export function createLineItem(partial?: Partial<LineItem>): LineItem {
  const qty = partial?.qty ?? 1;
  const rate = partial?.rate ?? 0;
  return {
    id: partial?.id ?? `li_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    description: partial?.description ?? "",
    qty,
    rate,
    amount: partial?.amount ?? qty * rate,
  };
}

export function parseLineItems(raw: string | undefined): LineItem[] {
  if (!raw) return [createLineItem()];
  try {
    const parsed = JSON.parse(raw) as LineItem[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [createLineItem()];
    return parsed.map((item) => createLineItem(item));
  } catch {
    return [createLineItem()];
  }
}

export function serializeLineItems(items: LineItem[]): string {
  return JSON.stringify(items);
}

export function calcSubtotal(items: LineItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

export function calcTax(subtotal: number, taxRate: number): number {
  return subtotal * (taxRate / 100);
}

export function calcTotal(subtotal: number, taxAmount: number): number {
  return subtotal + taxAmount;
}

export function updateLineItem(item: LineItem, field: keyof LineItem, value: string | number): LineItem {
  const next = { ...item, [field]: value };
  if (field === "qty" || field === "rate") {
    next.amount = Number(next.qty) * Number(next.rate);
  }
  return next;
}

export function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
