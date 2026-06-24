/** Per-template accounting prefixes for sequential document numbers */
export const TEMPLATE_NUMBER_PREFIX: Record<string, string> = {
  invoice: "INV",
  "quote-estimate": "QUO",
  receipt: "RCP",
  "purchase-order": "PO",
  "credit-memo": "CM",
  "statement-of-account": "SOA",
  "payment-reminder": "PMR",
  "collection-letter": "COL",
  "expense-report": "EXP",
  "freelance-invoice": "FINV",
  proposal: "PROP",
  "work-order": "WO",
  "change-order": "CO",
  "delivery-receipt": "DR",
  "packing-slip": "PS",
  "return-authorization": "RMA",
  "service-agreement": "SVC",
  nda: "NDA",
  "sales-order": "SO",
  "accounts-payable-voucher": "APV",
  "journal-entry": "JE",
  "petty-cash-voucher": "PCV",
  "vendor-invoice-log": "VIL",
  timesheet: "TS",
  "donation-receipt": "DON",
  "grant-application": "GRA",
  "membership-application": "MEM",
  "meeting-minutes": "MIN",
  "incident-report": "INC",
  resume: "RES",
  "cover-letter": "CL",
};

export function getTemplateNumberPrefix(templateId: string): string {
  if (TEMPLATE_NUMBER_PREFIX[templateId]) return TEMPLATE_NUMBER_PREFIX[templateId];
  const slug = templateId.replace(/-/g, " ").split(" ").filter(Boolean);
  if (slug.length >= 2) return slug.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return templateId.slice(0, 3).toUpperCase();
}

export function formatDocumentNumber(
  prefix: string,
  sequence: number,
  accountCode?: string,
  year = new Date().getFullYear()
): string {
  const seq = String(sequence).padStart(4, "0");
  if (accountCode) return `${accountCode}-${prefix}-${year}-${seq}`;
  return `${prefix}-${year}-${seq}`;
}

/** Field IDs that receive auto-generated document numbers */
export const NUMBER_FIELD_IDS = [
  "documentNumber",
  "invoiceNumber",
  "referenceNumber",
  "orderNumber",
  "poNumber",
  "receiptNumber",
  "quoteNumber",
  "workOrderNumber",
  "soNumber",
  "proposalNumber",
  "grantNumber",
] as const;

export function getNumberFieldId(fieldIds: string[]): string | null {
  for (const id of NUMBER_FIELD_IDS) {
    if (fieldIds.includes(id)) return id;
  }
  return fieldIds.includes("documentNumber") ? "documentNumber" : null;
}
