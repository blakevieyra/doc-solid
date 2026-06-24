import type { CatalogMeta } from "../catalog/entries";
import type { DocumentTypeDefinition, TemplateSection } from "../types";
import { getNumberFieldId } from "../catalog/numbering";
import { FIELD_BLUEPRINTS, section, withOrgBranding } from "./blueprints";
import { FULL_TEMPLATES } from "../templates/full";
import { TEMPLATE_OVERRIDES } from "../templates/overrides";
import { getCatalogFieldTemplate } from "../templates/catalog-fields";

function normalizeSections(sections: TemplateSection[]): TemplateSection[] {
  return sections.map((s) => ({
    ...s,
    fields: withOrgBranding(s.fields),
  }));
}

function ensureTrackingNumberField(sections: TemplateSection[]): TemplateSection[] {
  const fieldIds = sections.flatMap((s) => s.fields.map((f) => f.id));
  if (getNumberFieldId(fieldIds)) return sections;

  const trackingField = {
    ...FIELD_BLUEPRINTS.documentNumber,
  };
  const [first, ...rest] = sections;
  if (!first) {
    return [section("tracking", "Document Tracking", [trackingField])];
  }
  return [{ ...first, fields: [trackingField, ...first.fields] }, ...rest];
}

const CATEGORY_SECTIONS: Record<string, (meta: CatalogMeta) => TemplateSection[]> = {
  financial: (meta) => [
    section("header", "Document Header", [
      FIELD_BLUEPRINTS.businessName,
      FIELD_BLUEPRINTS.businessAddress,
      FIELD_BLUEPRINTS.businessPhone,
      FIELD_BLUEPRINTS.businessEmail,
      FIELD_BLUEPRINTS.taxId,
      FIELD_BLUEPRINTS.documentNumber,
      FIELD_BLUEPRINTS.documentDate,
    ]),
    section("recipient", "Recipient", [
      FIELD_BLUEPRINTS.clientName,
      FIELD_BLUEPRINTS.clientAddress,
      FIELD_BLUEPRINTS.clientEmail,
    ]),
    section("details", meta.name, [
      FIELD_BLUEPRINTS.lineItems,
      FIELD_BLUEPRINTS.subtotal,
      FIELD_BLUEPRINTS.taxRate,
      FIELD_BLUEPRINTS.taxAmount,
      FIELD_BLUEPRINTS.total,
      FIELD_BLUEPRINTS.paymentTerms,
      FIELD_BLUEPRINTS.dueDate,
      FIELD_BLUEPRINTS.notes,
    ]),
  ],

  legal: (meta) => [
    section("parties", "Parties", [
      FIELD_BLUEPRINTS.businessName,
      FIELD_BLUEPRINTS.businessAddress,
      FIELD_BLUEPRINTS.clientName,
      FIELD_BLUEPRINTS.clientAddress,
      FIELD_BLUEPRINTS.documentNumber,
    ]),
    section("terms", `${meta.name} Terms`, [
      { id: "effectiveDate", label: "Effective Date", type: "date", required: true },
      { id: "termLength", label: "Term / Duration", type: "text", placeholder: "e.g. 1 year, until project completion" },
      { id: "scope", label: "Scope / Purpose", type: "textarea", required: true },
      { id: "confidentialInfo", label: "Confidential Information Defined", type: "textarea" },
      { id: "obligations", label: "Obligations", type: "textarea", required: true },
      { id: "termination", label: "Termination Conditions", type: "textarea" },
      { id: "governingLaw", label: "Governing Law (State)", type: "text", placeholder: "e.g. State of California" },
    ]),
    section("signatures", "Signatures", [
      FIELD_BLUEPRINTS.signature,
      FIELD_BLUEPRINTS.signatureDate,
      { id: "counterSignature", label: "Counterparty Signature", type: "signature" },
      { id: "counterSignatureDate", label: "Counterparty Date", type: "date" },
    ]),
  ],

  hr: () => [
    section("employer", "Employer", [
      FIELD_BLUEPRINTS.businessName,
      FIELD_BLUEPRINTS.businessAddress,
      FIELD_BLUEPRINTS.businessPhone,
    ]),
    section("employee", "Employee / Contractor", [
      FIELD_BLUEPRINTS.personName,
      FIELD_BLUEPRINTS.personAddress,
      FIELD_BLUEPRINTS.personEmail,
      FIELD_BLUEPRINTS.personPhone,
      { id: "jobTitle", label: "Job Title / Role", type: "text", required: true },
      { id: "startDate", label: "Start Date", type: "date", required: true },
      { id: "compensation", label: "Compensation", type: "text", required: true },
      { id: "workSchedule", label: "Work Schedule", type: "text" },
      { id: "benefits", label: "Benefits", type: "textarea" },
    ]),
    section("signatures", "Signatures", [
      FIELD_BLUEPRINTS.signature,
      FIELD_BLUEPRINTS.signatureDate,
      { id: "employeeSignature", label: "Employee Signature", type: "signature", required: true },
    ]),
  ],

  personal: (meta) => [
    section("personal", "Personal Information", [
      FIELD_BLUEPRINTS.personName,
      FIELD_BLUEPRINTS.personAddress,
      FIELD_BLUEPRINTS.personEmail,
      FIELD_BLUEPRINTS.personPhone,
    ]),
    section("content", meta.name, [
      { id: "documentDate", label: "Date", type: "date", required: true },
      { id: "subject", label: "Subject / Title", type: "text", required: true },
      { id: "details", label: `${meta.name} Details`, type: "textarea", required: true },
      { id: "additionalInfo", label: "Additional Information", type: "textarea" },
    ]),
    section("signatures", "Signatures", [
      FIELD_BLUEPRINTS.signature,
      FIELD_BLUEPRINTS.signatureDate,
    ]),
  ],

  sales: (meta) => [
    section("from", "From", [FIELD_BLUEPRINTS.businessName, FIELD_BLUEPRINTS.businessAddress, FIELD_BLUEPRINTS.businessEmail]),
    section("client", "Client", [FIELD_BLUEPRINTS.clientName, FIELD_BLUEPRINTS.clientAddress]),
    section("details", meta.name, [
      { id: "documentDate", label: "Date", type: "date", required: true },
      { id: "referenceNumber", label: "Reference Number", type: "text" },
      { id: "description", label: "Description", type: "textarea", required: true },
      FIELD_BLUEPRINTS.lineItems,
      FIELD_BLUEPRINTS.total,
      FIELD_BLUEPRINTS.notes,
    ]),
  ],

  operations: (meta) => [
    section("company", "Company", [FIELD_BLUEPRINTS.businessName, FIELD_BLUEPRINTS.businessAddress]),
    section("details", meta.name, [
      { id: "documentDate", label: "Date", type: "date", required: true },
      { id: "referenceNumber", label: "Reference #", type: "text", required: true },
      { id: "description", label: "Description", type: "textarea", required: true },
      { id: "instructions", label: "Instructions / Notes", type: "textarea" },
    ]),
  ],

  "real-estate": (meta) => [
    section("parties", "Parties", [
      FIELD_BLUEPRINTS.businessName,
      FIELD_BLUEPRINTS.personName,
      { id: "propertyAddress", label: "Property Address", type: "address", required: true },
    ]),
    section("terms", meta.name, [
      { id: "effectiveDate", label: "Effective Date", type: "date", required: true },
      { id: "terms", label: "Terms & Conditions", type: "textarea", required: true },
      FIELD_BLUEPRINTS.notes,
    ]),
    section("signatures", "Signatures", [FIELD_BLUEPRINTS.signature, FIELD_BLUEPRINTS.signatureDate]),
  ],

  compliance: (meta) => [
    section("organization", "Organization", [FIELD_BLUEPRINTS.businessName, FIELD_BLUEPRINTS.businessAddress]),
    section("report", meta.name, [
      { id: "reportDate", label: "Report Date", type: "date", required: true },
      { id: "preparedBy", label: "Prepared By", type: "text", required: true },
      { id: "summary", label: "Summary", type: "textarea", required: true },
      { id: "findings", label: "Findings", type: "textarea" },
      { id: "actions", label: "Corrective Actions", type: "textarea" },
    ]),
  ],

  communication: (meta) => [
    section("from", "From", [
      meta.domain === "individual" ? FIELD_BLUEPRINTS.personName : FIELD_BLUEPRINTS.businessName,
      meta.domain === "individual" ? FIELD_BLUEPRINTS.personEmail : FIELD_BLUEPRINTS.businessEmail,
    ]),
    section("to", "To", [FIELD_BLUEPRINTS.clientName, FIELD_BLUEPRINTS.clientEmail]),
    section("message", meta.name, [
      { id: "date", label: "Date", type: "date", required: true },
      { id: "subject", label: "Subject", type: "text", required: true },
      { id: "body", label: "Message", type: "textarea", required: true },
    ]),
  ],

  project: (meta) => [
    section("project", "Project", [
      { id: "projectName", label: "Project Name", type: "text", required: true },
      { id: "projectManager", label: "Project Manager", type: "text", required: true },
      { id: "startDate", label: "Start Date", type: "date" },
      { id: "endDate", label: "End Date", type: "date" },
    ]),
    section("details", meta.name, [
      { id: "objectives", label: "Objectives", type: "textarea", required: true },
      { id: "scope", label: "Scope", type: "textarea", required: true },
      { id: "deliverables", label: "Deliverables", type: "textarea" },
      { id: "notes", label: "Notes", type: "textarea" },
    ]),
  ],

  marketing: (meta) => [
    section("brand", "Brand", [
      FIELD_BLUEPRINTS.businessName,
      { id: "website", label: "Website", type: "text", defaultFromProfile: "business.website" },
    ]),
    section("campaign", meta.name, [
      { id: "campaignName", label: "Campaign / Asset Name", type: "text", required: true },
      { id: "targetAudience", label: "Target Audience", type: "text", required: true },
      { id: "objective", label: "Objective", type: "textarea", required: true },
      { id: "content", label: "Content / Copy", type: "textarea", required: true },
    ]),
  ],

  health: (meta) => [
    section("patient", "Patient / Client", [FIELD_BLUEPRINTS.personName, FIELD_BLUEPRINTS.personPhone, FIELD_BLUEPRINTS.personAddress]),
    section("record", meta.name, [
      { id: "recordDate", label: "Date", type: "date", required: true },
      { id: "provider", label: "Provider / Facility", type: "text" },
      { id: "details", label: "Details", type: "textarea", required: true },
      { id: "notes", label: "Notes", type: "textarea" },
    ]),
  ],

  education: (meta) => [
    section("student", "Student", [FIELD_BLUEPRINTS.personName, FIELD_BLUEPRINTS.personEmail]),
    section("institution", "Institution", [{ id: "institutionName", label: "Institution Name", type: "text", required: true }]),
    section("details", meta.name, [
      { id: "date", label: "Date", type: "date", required: true },
      { id: "courseOrProgram", label: "Course / Program", type: "text" },
      { id: "details", label: "Details", type: "textarea", required: true },
    ]),
  ],

  nonprofit: (meta) => [
    section("organization", "Organization", [
      FIELD_BLUEPRINTS.businessName,
      { id: "orgMission", label: "Mission Statement", type: "textarea" },
      FIELD_BLUEPRINTS.taxId,
      FIELD_BLUEPRINTS.businessAddress,
      FIELD_BLUEPRINTS.businessEmail,
    ]),
    section("details", meta.name, [
      { id: "applicantName", label: "Applicant / Donor Name", type: "text", required: true },
      { id: "amount", label: "Amount / Value", type: "currency" },
      { id: "purpose", label: "Purpose / Program", type: "textarea", required: true },
      { id: "date", label: "Date", type: "date", required: true },
      FIELD_BLUEPRINTS.notes,
    ]),
    section("signatures", "Signatures", [
      FIELD_BLUEPRINTS.signature,
      FIELD_BLUEPRINTS.signatureDate,
    ]),
  ],

  governance: () => [
    section("meeting", "Meeting Details", [
      FIELD_BLUEPRINTS.businessName,
      { id: "meetingDate", label: "Meeting Date", type: "date", required: true },
      { id: "meetingTime", label: "Meeting Time", type: "text" },
      { id: "location", label: "Location", type: "text" },
      { id: "attendees", label: "Attendees", type: "textarea", required: true },
      { id: "chairperson", label: "Chairperson", type: "text" },
    ]),
    section("minutes", "Discussion & Decisions", [
      { id: "agenda", label: "Agenda Items", type: "textarea", required: true },
      { id: "discussion", label: "Discussion Summary", type: "textarea" },
      { id: "motions", label: "Motions & Votes", type: "textarea" },
      { id: "actionItems", label: "Action Items", type: "textarea" },
      { id: "adjournment", label: "Adjournment Time", type: "text" },
    ]),
  ],
};

const DEFAULT_SECTIONS = (meta: CatalogMeta): TemplateSection[] => [
  section("issuer", "From", [
    meta.domain === "individual" ? FIELD_BLUEPRINTS.personName : FIELD_BLUEPRINTS.businessName,
    meta.domain === "individual" ? FIELD_BLUEPRINTS.personAddress : FIELD_BLUEPRINTS.businessAddress,
    FIELD_BLUEPRINTS.documentNumber,
    FIELD_BLUEPRINTS.documentDate,
  ]),
  section("recipient", "To", [
    FIELD_BLUEPRINTS.clientName,
    FIELD_BLUEPRINTS.clientAddress,
  ]),
  section("body", meta.name, [
    { id: "subject", label: "Subject", type: "text", required: true },
    { id: "body", label: "Content", type: "textarea", required: true },
    FIELD_BLUEPRINTS.notes,
  ]),
  section("signatures", "Signatures", [
    FIELD_BLUEPRINTS.signature,
    FIELD_BLUEPRINTS.signatureDate,
  ]),
];

export function generateTemplate(meta: CatalogMeta): DocumentTypeDefinition {
  const full = FULL_TEMPLATES[meta.id];
  if (full) return { ...meta, sections: normalizeSections(ensureTrackingNumberField(full)) };

  const override = TEMPLATE_OVERRIDES[meta.id];
  if (override) return { ...meta, sections: normalizeSections(ensureTrackingNumberField(override)) };

  const catalogSpecific = getCatalogFieldTemplate(meta);
  if (catalogSpecific) {
    return { ...meta, sections: normalizeSections(ensureTrackingNumberField(catalogSpecific)) };
  }

  const builder = CATEGORY_SECTIONS[meta.category] ?? DEFAULT_SECTIONS;
  return { ...meta, sections: normalizeSections(ensureTrackingNumberField(builder(meta))) };
}

export function generateAllTemplates(catalog: CatalogMeta[]): DocumentTypeDefinition[] {
  return catalog.map(generateTemplate);
}
