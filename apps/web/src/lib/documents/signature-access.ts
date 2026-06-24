import type { DocumentTypeDefinition, TemplateField } from "@doc-solid/documents";
import {
  isCounterpartySignatureField,
  isOwnerSignatureField,
} from "@/lib/profile/signature";
import { isSignatureLocked, isSignatureFilled } from "./signature-lock";

export type SignatureFieldAccess =
  | "owner-sign"
  | "counterparty-sign"
  | "locked"
  | "readonly-pending";

export interface SignatureAccessContext {
  isDocumentOwner: boolean;
  signingMode: boolean;
  assignedFieldIds: string[];
  values: Record<string, string>;
  docCategory?: string;
}

export function resolveSignatureFieldAccess(
  field: TemplateField,
  ctx: SignatureAccessContext
): SignatureFieldAccess {
  if (field.type !== "signature") return "readonly-pending";

  if (isSignatureLocked(field.id, ctx.values)) {
    return "locked";
  }

  const isOwner = isOwnerSignatureField(field, ctx.docCategory);
  const isCounterparty = isCounterpartySignatureField(field, ctx.docCategory);

  if (isOwner) {
    if (ctx.isDocumentOwner) return "owner-sign";
    return "readonly-pending";
  }

  if (isCounterparty) {
    if (ctx.signingMode && ctx.assignedFieldIds.includes(field.id)) {
      return "counterparty-sign";
    }
    return "readonly-pending";
  }

  return ctx.isDocumentOwner ? "owner-sign" : "readonly-pending";
}

export function emptyCounterpartySignatureFields(
  template: DocumentTypeDefinition,
  values: Record<string, string>
): TemplateField[] {
  const fields: TemplateField[] = [];
  for (const section of template.sections) {
    for (const field of section.fields) {
      if (field.type !== "signature") continue;
      if (!isCounterpartySignatureField(field, template.category)) continue;
      if (isSignatureLocked(field.id, values)) continue;
      if (isSignatureFilled(values[field.id])) continue;
      fields.push(field);
    }
  }
  return fields;
}

export function shouldAutofillOwnerSignatureForEditor(
  field: TemplateField,
  ctx: Pick<SignatureAccessContext, "isDocumentOwner" | "signingMode" | "docCategory">
): boolean {
  if (!ctx.isDocumentOwner || ctx.signingMode) return false;
  return isOwnerSignatureField(field, ctx.docCategory);
}

export function canCounterpartySign(
  assignedFieldIds: string[],
  values: Record<string, string>
): { ok: boolean; missingFieldIds: string[] } {
  const missingFieldIds = assignedFieldIds.filter((id) => !isSignatureFilled(values[id]));
  return { ok: missingFieldIds.length === 0, missingFieldIds };
}
