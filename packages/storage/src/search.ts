import type { LocalDocument, DocumentSearchFilters } from "./index";

function searchableText(doc: LocalDocument): string {
  const parts = [
    doc.title,
    doc.documentNumber ?? "",
    doc.templateId,
    doc.domain ?? "",
    doc.category ?? "",
    doc.status,
    JSON.stringify(doc.fieldData),
  ];
  return parts.join(" ").toLowerCase();
}

export function searchDocuments(
  documents: LocalDocument[],
  filters: DocumentSearchFilters = {}
): LocalDocument[] {
  let results = [...documents];

  if (filters.templateId) {
    results = results.filter((d) => d.templateId === filters.templateId);
  }
  if (filters.domain) {
    results = results.filter((d) => d.domain === filters.domain);
  }
  if (filters.category) {
    results = results.filter((d) => d.category === filters.category);
  }
  if (filters.status) {
    results = results.filter((d) => d.status === filters.status);
  }
  if (filters.query?.trim()) {
    const q = filters.query.trim().toLowerCase();
    results = results.filter((d) => searchableText(d).includes(q));
  }

  const sortBy = filters.sortBy ?? "updatedAt";
  const sortDir = filters.sortDir ?? "desc";

  results.sort((a, b) => {
    let cmp = 0;
    if (sortBy === "documentNumber") {
      cmp = (a.documentNumber ?? "").localeCompare(b.documentNumber ?? "");
    } else if (sortBy === "title") {
      cmp = a.title.localeCompare(b.title);
    } else if (sortBy === "createdAt") {
      cmp = (a.createdAt ?? a.updatedAt).localeCompare(b.createdAt ?? b.updatedAt);
    } else {
      cmp = a.updatedAt.localeCompare(b.updatedAt);
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  return results;
}

export function groupDocumentsByType(
  documents: LocalDocument[]
): Record<string, LocalDocument[]> {
  return documents.reduce<Record<string, LocalDocument[]>>((acc, doc) => {
    const key = doc.templateId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});
}

export function documentTypeCounts(
  documents: LocalDocument[]
): Record<string, number> {
  return documents.reduce<Record<string, number>>((acc, doc) => {
    acc[doc.templateId] = (acc[doc.templateId] ?? 0) + 1;
    return acc;
  }, {});
}
