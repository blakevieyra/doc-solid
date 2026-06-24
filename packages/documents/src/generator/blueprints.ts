import type { TableColumn, TemplateField, TemplateSection } from "../types";

/** Reusable column schemas for structured (non–line-item) table fields */
export const TABLE_COLUMNS = {
  experience: [
    { key: "company", label: "Company / Organization", type: "text" as const, placeholder: "Acme Corp" },
    { key: "title", label: "Job Title", type: "text" as const, placeholder: "Office Manager" },
    { key: "startDate", label: "Start Date", type: "text" as const, placeholder: "Jan 2020" },
    { key: "endDate", label: "End Date", type: "text" as const, placeholder: "Present" },
    { key: "achievements", label: "Key Achievements", type: "textarea" as const, placeholder: "Led team of 5, reduced costs 15%" },
  ] satisfies TableColumn[],
  education: [
    { key: "school", label: "School / Institution", type: "text" as const },
    { key: "degree", label: "Degree / Certificate", type: "text" as const },
    { key: "graduationDate", label: "Graduation Date", type: "text" as const, placeholder: "May 2018" },
  ] satisfies TableColumn[],
  incomeSources: [
    { key: "source", label: "Income Source", type: "text" as const },
    { key: "planned", label: "Planned Amount", type: "currency" as const },
    { key: "actual", label: "Actual Amount", type: "currency" as const },
  ] satisfies TableColumn[],
  expenseCategories: [
    { key: "category", label: "Category", type: "text" as const },
    { key: "budgeted", label: "Budgeted", type: "currency" as const },
    { key: "actual", label: "Actual", type: "currency" as const },
  ] satisfies TableColumn[],
  expenses: [
    { key: "date", label: "Date", type: "date" as const },
    { key: "category", label: "Category", type: "text" as const },
    { key: "description", label: "Description", type: "text" as const },
    { key: "amount", label: "Amount", type: "currency" as const },
  ] satisfies TableColumn[],
  timeEntries: [
    { key: "date", label: "Date", type: "date" as const },
    { key: "project", label: "Project / Task", type: "text" as const },
    { key: "hours", label: "Hours", type: "number" as const },
    { key: "notes", label: "Notes", type: "text" as const },
  ] satisfies TableColumn[],
  budgetBreakdown: [
    { key: "lineItem", label: "Line Item", type: "text" as const },
    { key: "amount", label: "Amount", type: "currency" as const },
    { key: "justification", label: "Justification", type: "text" as const },
  ] satisfies TableColumn[],
  actionItems: [
    { key: "owner", label: "Owner", type: "text" as const },
    { key: "task", label: "Task", type: "text" as const },
    { key: "dueDate", label: "Due Date", type: "date" as const },
  ] satisfies TableColumn[],
  journalLines: [
    { key: "account", label: "Account", type: "text" as const },
    { key: "debit", label: "Debit", type: "currency" as const },
    { key: "credit", label: "Credit", type: "currency" as const },
    { key: "memo", label: "Memo", type: "text" as const },
  ] satisfies TableColumn[],
};

/** Reusable field blueprints derived from domain primary resources */
export const FIELD_BLUEPRINTS = {
  businessName: { id: "businessName", label: "Business Name", type: "text" as const, required: true, defaultFromProfile: "business.name" },
  businessAddress: { id: "businessAddress", label: "Business Address", type: "address" as const, required: true, defaultFromProfile: "business.address" },
  businessPhone: { id: "businessPhone", label: "Phone", type: "phone" as const, defaultFromProfile: "business.phone" },
  businessEmail: { id: "businessEmail", label: "Email", type: "email" as const, defaultFromProfile: "business.email" },
  taxId: { id: "taxId", label: "Tax ID / EIN", type: "text" as const, defaultFromProfile: "business.taxId" },
  logo: { id: "logo", label: "Logo", type: "image" as const, defaultFromProfile: "business.logo" },

  clientName: { id: "clientName", label: "Client / Recipient Name", type: "text" as const, required: true },
  clientAddress: { id: "clientAddress", label: "Client Address", type: "address" as const },
  clientEmail: { id: "clientEmail", label: "Client Email", type: "email" as const },
  clientPhone: { id: "clientPhone", label: "Client Phone", type: "phone" as const },

  documentDate: { id: "documentDate", label: "Date", type: "date" as const, required: true },
  documentNumber: { id: "documentNumber", label: "Document Number", type: "text" as const, required: true },
  dueDate: { id: "dueDate", label: "Due Date", type: "date" as const },
  paymentTerms: { id: "paymentTerms", label: "Payment Terms", type: "select" as const, options: ["Due on Receipt", "Net 15", "Net 30", "Net 60", "Net 90"] },

  lineItems: {
    id: "lineItems",
    label: "Line Items",
    type: "table" as const,
    required: true,
  },

  subtotal: { id: "subtotal", label: "Subtotal", type: "currency" as const },
  taxRate: { id: "taxRate", label: "Tax Rate (%)", type: "number" as const },
  taxAmount: { id: "taxAmount", label: "Tax Amount", type: "currency" as const },
  total: { id: "total", label: "Total", type: "currency" as const, required: true },
  notes: { id: "notes", label: "Notes / Terms", type: "textarea" as const },

  signature: {
    id: "signature",
    label: "Authorized Signature",
    type: "signature" as const,
    ownerSignature: true,
    defaultFromProfile: "signature.owner",
  },
  signatureDate: { id: "signatureDate", label: "Signature Date", type: "date" as const },

  personName: { id: "personName", label: "Full Name", type: "text" as const, required: true, defaultFromProfile: "personal.fullName" },
  personAddress: { id: "personAddress", label: "Address", type: "address" as const, defaultFromProfile: "personal.address" },
  personEmail: { id: "personEmail", label: "Email", type: "email" as const, defaultFromProfile: "personal.email" },
  personPhone: { id: "personPhone", label: "Phone", type: "phone" as const, defaultFromProfile: "personal.phone" },
};

export function section(id: string, title: string, fields: TemplateField[], description?: string): TemplateSection {
  return { id, title, description, fields };
}

export function field(overrides: TemplateField): TemplateField {
  return overrides;
}

/** Prepend logo to org/business sections so branding snapshots on save. */
export function withOrgBranding(fields: TemplateField[]): TemplateField[] {
  if (fields.some((f) => f.id === "logo")) return fields;
  const isOrgSection = fields.some(
    (f) =>
      f.id === "businessName" ||
      f.defaultFromProfile === "business.name" ||
      f.id === "providerName" ||
      f.id === "disclosingParty" ||
      f.id === "organizationName"
  );
  if (!isOrgSection) return fields;
  return [FIELD_BLUEPRINTS.logo, ...fields];
}

export const LANDLORD_SIGNATURE: TemplateField = {
  id: "landlordSignature",
  label: "Landlord Signature",
  type: "signature",
  ownerSignature: true,
  defaultFromProfile: "signature.owner",
};

export const LENDER_SIGNATURE: TemplateField = {
  id: "lenderSignature",
  label: "Lender Signature",
  type: "signature",
  required: true,
  ownerSignature: true,
  defaultFromProfile: "signature.owner",
};
