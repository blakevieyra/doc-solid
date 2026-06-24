import {
  generateTemplate,
  type DocumentTypeDefinition,
  type TemplateField,
} from "@doc-solid/documents";
import { parseSignatureValue } from "@/lib/profile/signature";
export interface MissingField {
  id: string;
  label: string;
  section: string;
}

export interface DocumentAuditResult {
  totalRequired: number;
  filledRequired: number;
  missingFields: MissingField[];
  isComplete: boolean;
  complianceNotes: string[];
  readinessLabel: "ready" | "incomplete" | "review";
}

function isFieldFilled(value: string | undefined, field: TemplateField): boolean {
  if (field.type === "checkbox") return true;
  if (field.type === "signature") {
    return Boolean(parseSignatureValue(value)?.name);
  }
  if (!value?.trim()) return false;
  if (field.type === "table") {
    const trimmed = value.trim();
    if (trimmed === "[]" || trimmed === "{}") return false;
  }
  return true;
}

function categoryComplianceNotes(meta: DocumentTypeDefinition): string[] {
  const notes: string[] = [];
  if (meta.primaryResources?.length) {
    notes.push(`Standards referenced: ${meta.primaryResources.slice(0, 3).join(" · ")}`);
  }
  if (meta.category === "compliance" || meta.category === "legal") {
    notes.push("Have legal counsel review before external use.");
  }
  if (meta.category === "health") {
    notes.push("Contains health-related fields — run a security scan before sharing.");
  }
  if (meta.category === "financial") {
    notes.push("Verify amounts, tax IDs, and payment details before sending.");
  }
  if (meta.category === "hr") {
    notes.push("Confirm employment terms comply with your jurisdiction.");
  }
  return notes;
}

export function auditDocumentCompleteness(
  meta: DocumentTypeDefinition,
  values: Record<string, string>
): DocumentAuditResult {
  const template = generateTemplate(meta);
  const missingFields: MissingField[] = [];

  for (const sec of template.sections) {
    for (const field of sec.fields) {
      if (!field.required) continue;
      if (!isFieldFilled(values[field.id], field)) {
        missingFields.push({ id: field.id, label: field.label, section: sec.title });
      }
    }
  }

  const totalRequired = template.sections.reduce(
    (n, s) => n + s.fields.filter((f) => f.required).length,
    0
  );
  const filledRequired = totalRequired - missingFields.length;
  const isComplete = missingFields.length === 0;

  let readinessLabel: DocumentAuditResult["readinessLabel"] = isComplete ? "ready" : "incomplete";
  if (isComplete && (meta.category === "compliance" || meta.category === "legal")) {
    readinessLabel = "review";
  }

  return {
    totalRequired,
    filledRequired,
    missingFields,
    isComplete,
    complianceNotes: categoryComplianceNotes(meta),
    readinessLabel,
  };
}

/** Required non-signature fields must be filled before the document owner can sign. */
export function canApplyOwnerSignature(
  meta: DocumentTypeDefinition,
  values: Record<string, string>
): { ok: boolean; missing: MissingField[] } {
  const template = generateTemplate(meta);
  const missing: MissingField[] = [];

  for (const sec of template.sections) {
    for (const field of sec.fields) {
      if (!field.required) continue;
      if (field.type === "signature") continue;
      if (!isFieldFilled(values[field.id], field)) {
        missing.push({ id: field.id, label: field.label, section: sec.title });
      }
    }
  }

  return { ok: missing.length === 0, missing };
}
