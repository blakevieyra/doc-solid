import { DOCUMENT_CATALOG } from "../catalog/entries";
import { generateTemplate } from "../generator";
import { isGenericOperationsTemplate } from "../templates/catalog-fields";
import type { DocumentTypeDefinition, TemplateField } from "../types";

const OWNER_SIGNATURE_IDS = new Set([
  "signature",
  "sellerSignature",
  "ownerSignature",
  "authorizedSignature",
  "landlordSignature",
  "lessorSignature",
  "employerSignature",
  "lenderSignature",
]);

const COUNTERPARTY_SIGNATURE_IDS = new Set([
  "buyerSignature",
  "clientSignature",
  "counterSignature",
  "tenantSignature",
  "receivingPartySignature",
  "witnessSignature",
  "guestSignature",
  "candidateSignature",
  "contractorSignature",
  "volunteerSignature",
  "employeeSignature",
  "purchaserSignature",
  "vendorSignature",
  "customerSignature",
  "recipientSignature",
  "borrowerSignature",
]);

const ORG_FIELD_IDS = new Set([
  "businessName",
  "providerName",
  "disclosingParty",
  "organizationName",
]);

function isOwnerSignature(field: TemplateField): boolean {
  if (field.type !== "signature") return false;
  if (field.ownerSignature || field.defaultFromProfile === "signature.owner") return true;
  if (field.id && OWNER_SIGNATURE_IDS.has(field.id)) return true;
  if (field.id && COUNTERPARTY_SIGNATURE_IDS.has(field.id)) return false;
  return field.id === "signature";
}

export interface ComplianceIssue {
  templateId: string;
  rule: string;
  detail: string;
}

export function auditTemplateCompliance(template: DocumentTypeDefinition): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const signatureFields: { field: TemplateField; sectionId: string; sectionTitle: string }[] = [];

  for (const section of template.sections) {
    const hasOrgField = section.fields.some((f) => ORG_FIELD_IDS.has(f.id) || f.defaultFromProfile === "business.name");
    const hasLogo = section.fields.some((f) => f.id === "logo");

    if (hasOrgField && !hasLogo) {
      issues.push({
        templateId: template.id,
        rule: "org-branding",
        detail: `Section "${section.title}" (${section.id}) has org fields but no logo`,
      });
    }

    for (const field of section.fields) {
      if (field.type === "table" && field.id !== "lineItems" && !field.tableColumns?.length) {
        issues.push({
          templateId: template.id,
          rule: "table-schema",
          detail: `Table field "${field.id}" in "${section.title}" must define tableColumns (not invoice line items)`,
        });
      }

      if (field.type !== "signature") continue;
      signatureFields.push({ field, sectionId: section.id, sectionTitle: section.title });

      const owner = isOwnerSignature(field);
      if (field.id && COUNTERPARTY_SIGNATURE_IDS.has(field.id) && (field.ownerSignature || field.defaultFromProfile === "signature.owner")) {
        issues.push({
          templateId: template.id,
          rule: "signature-role",
          detail: `Counterparty field "${field.id}" is marked as owner signature`,
        });
      }
      if (field.id && OWNER_SIGNATURE_IDS.has(field.id) && !owner) {
        issues.push({
          templateId: template.id,
          rule: "signature-role",
          detail: `Owner field "${field.id}" is not classified as owner signature`,
        });
      }
    }
  }

  if (signatureFields.length >= 2) {
    const sigSectionIds = new Set(["signatures", "authorization", "acceptance", "approval", "consent"]);
    const outsideDedicated = signatureFields.filter(
      ({ sectionId, sectionTitle }) =>
        !sigSectionIds.has(sectionId) && !/signature/i.test(sectionTitle)
    );
    for (const { field, sectionId } of outsideDedicated) {
      issues.push({
        templateId: template.id,
        rule: "signature-placement",
        detail: `Multi-party form: "${field.id}" should be in a Signatures section (currently in "${sectionId}")`,
      });
    }
  }

  const allFieldIds = template.sections.flatMap((s) => s.fields.map((f) => f.id));
  if (template.category === "operations" && isGenericOperationsTemplate(allFieldIds)) {
    issues.push({
      templateId: template.id,
      rule: "specific-fields",
      detail: "Uses generic operations placeholder fields — needs document-specific fields",
    });
  }

  return issues;
}

export function auditAllTemplates(): ComplianceIssue[] {
  return DOCUMENT_CATALOG.flatMap((meta) => auditTemplateCompliance(generateTemplate(meta)));
}
