import { DOCUMENT_CATALOG, type CatalogMeta } from "./entries";
import type { DocumentCatalogEntry, DocumentCategory, DocumentDomain } from "../types";
import { FULL_TEMPLATES } from "../templates/full";
import { TEMPLATE_OVERRIDES } from "../templates/overrides";

export { DOCUMENT_CATALOG, type CatalogMeta };
export * from "./numbering";

function hasDedicatedTemplate(id: string): boolean {
  return Boolean(FULL_TEMPLATES[id] || TEMPLATE_OVERRIDES[id]);
}

/** Document types with fully generated field templates */
export const PRIORITY_TEMPLATE_IDS = new Set([
  "invoice",
  "quote-estimate",
  "receipt",
  "service-agreement",
  "nda",
  "employment-offer-letter",
  "independent-contractor-agreement",
  "work-order",
  "client-intake-form",
  "proposal",
  "expense-report",
  "resume",
  "cover-letter",
  "personal-budget",
  "residential-lease",
  "rental-application",
  "freelance-invoice",
  "donation-receipt",
  "volunteer-agreement",
  "membership-application",
  "grant-application",
  "meeting-minutes",
  "incident-report",
  "timesheet",
  "payment-reminder",
  "sales-order",
  "accounts-payable-voucher",
  "journal-entry",
  "purchase-order",
  "vehicle-bill-of-sale",
]);

export function getCatalog(): DocumentCatalogEntry[] {
  return DOCUMENT_CATALOG.map((entry) => ({
    ...entry,
    sectionCount: 0,
    fieldCount: 0,
    hasFullTemplate: hasDedicatedTemplate(entry.id),
  }));
}

export function getCatalogByDomain(domain: DocumentDomain): DocumentCatalogEntry[] {
  return getCatalog().filter((d) => d.domain === domain);
}

export function getCatalogByCategory(category: DocumentCategory): DocumentCatalogEntry[] {
  return getCatalog().filter((d) => d.category === category);
}

export const DOCUMENT_CATEGORIES: { id: DocumentCategory; label: string }[] = [
  { id: "financial", label: "Financial" },
  { id: "legal", label: "Legal" },
  { id: "hr", label: "HR" },
  { id: "sales", label: "Sales" },
  { id: "operations", label: "Operations" },
  { id: "marketing", label: "Marketing" },
  { id: "compliance", label: "Compliance" },
  { id: "personal", label: "Personal" },
  { id: "real-estate", label: "Real Estate" },
  { id: "health", label: "Health" },
  { id: "education", label: "Education" },
  { id: "nonprofit", label: "Nonprofit" },
  { id: "governance", label: "Governance" },
  { id: "project", label: "Project" },
  { id: "communication", label: "Communication" },
];

export const DOCUMENT_DOMAINS: { id: DocumentDomain; label: string }[] = [
  { id: "business", label: "Business" },
  { id: "individual", label: "Individual" },
  { id: "organization", label: "Organization" },
];

export function getEssentialDocuments(): DocumentCatalogEntry[] {
  return getCatalog().filter((d) => d.priority === "essential");
}

export function getDocumentById(id: string): CatalogMeta | undefined {
  return DOCUMENT_CATALOG.find((d) => d.id === id);
}

export function searchCatalog(query: string): DocumentCatalogEntry[] {
  const q = query.toLowerCase().trim();
  if (!q) return getCatalog();
  return getCatalog().filter(
    (d) =>
      d.name.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      d.domain.includes(q) ||
      d.category.includes(q) ||
      d.tags.some((t) => t.includes(q)) ||
      d.primaryResources.some((r) => r.toLowerCase().includes(q))
  );
}

export function filterCatalog(filters: {
  query?: string;
  domain?: DocumentDomain | "all";
  category?: DocumentCategory | "all";
  priority?: DocumentCatalogEntry["priority"] | "all";
}): DocumentCatalogEntry[] {
  let results = filters.query ? searchCatalog(filters.query) : getCatalog();
  if (filters.domain && filters.domain !== "all") {
    results = results.filter((d) => d.domain === filters.domain);
  }
  if (filters.category && filters.category !== "all") {
    results = results.filter((d) => d.category === filters.category);
  }
  if (filters.priority && filters.priority !== "all") {
    results = results.filter((d) => d.priority === filters.priority);
  }
  return results;
}

export const CATALOG_STATS = {
  total: DOCUMENT_CATALOG.length,
  business: DOCUMENT_CATALOG.filter((d) => d.domain === "business").length,
  individual: DOCUMENT_CATALOG.filter((d) => d.domain === "individual").length,
  organization: DOCUMENT_CATALOG.filter((d) => d.domain === "organization").length,
  essential: DOCUMENT_CATALOG.filter((d) => d.priority === "essential").length,
  withTemplates: PRIORITY_TEMPLATE_IDS.size,
};
