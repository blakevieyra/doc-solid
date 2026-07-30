import type { DocumentCategory } from "@doc-solid/documents";

export type DocumentTypeface = "serif" | "sans";

/**
 * Categories that read as formal/binding instruments — a serif body reads as
 * more authoritative for these and matches print convention for contracts.
 * Everything else (invoices, forms, reports, letters) gets the cleaner sans
 * body, which scans faster and aligns numbers better.
 */
const SERIF_CATEGORIES: ReadonlySet<DocumentCategory> = new Set([
  "legal",
  "governance",
  "compliance",
  "real-estate",
]);

export function documentTypeface(category: DocumentCategory | string | undefined): DocumentTypeface {
  return category && SERIF_CATEGORIES.has(category as DocumentCategory) ? "serif" : "sans";
}
