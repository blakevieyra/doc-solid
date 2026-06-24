import type { TemplateSection } from "../types";
import { FIELD_BLUEPRINTS, TABLE_COLUMNS, section } from "../generator/blueprints";

/** Hand-crafted templates for the highest-priority document types */
export const FULL_TEMPLATES: Record<string, TemplateSection[]> = {
  invoice: [
    section("issuer", "From (Your Business)", [
      FIELD_BLUEPRINTS.logo,
      FIELD_BLUEPRINTS.businessName,
      FIELD_BLUEPRINTS.businessAddress,
      FIELD_BLUEPRINTS.businessPhone,
      FIELD_BLUEPRINTS.businessEmail,
      FIELD_BLUEPRINTS.taxId,
    ]),
    section("recipient", "Bill To", [
      FIELD_BLUEPRINTS.clientName,
      FIELD_BLUEPRINTS.clientAddress,
      FIELD_BLUEPRINTS.clientEmail,
    ]),
    section("invoice-details", "Invoice Details", [
      { id: "invoiceNumber", label: "Invoice Number", type: "text", required: true },
      { id: "invoiceDate", label: "Invoice Date", type: "date", required: true },
      FIELD_BLUEPRINTS.dueDate,
      FIELD_BLUEPRINTS.paymentTerms,
    ]),
    section("line-items", "Items & Services", [
      FIELD_BLUEPRINTS.lineItems,
      FIELD_BLUEPRINTS.subtotal,
      FIELD_BLUEPRINTS.taxRate,
      FIELD_BLUEPRINTS.taxAmount,
      FIELD_BLUEPRINTS.total,
    ]),
    section("payment", "Payment Instructions", [
      { id: "paymentMethods", label: "Accepted Payment Methods", type: "textarea", placeholder: "Check, ACH, credit card, etc." },
      { id: "bankDetails", label: "Bank / Wire Details", type: "textarea" },
      FIELD_BLUEPRINTS.notes,
    ]),
  ],

  "service-agreement": [
    section("parties", "Parties to Agreement", [
      { id: "providerName", label: "Service Provider", type: "text", required: true, defaultFromProfile: "business.name" },
      { id: "providerAddress", label: "Provider Address", type: "address", defaultFromProfile: "business.address" },
      { id: "clientName", label: "Client Name", type: "text", required: true },
      { id: "clientAddress", label: "Client Address", type: "address" },
    ]),
    section("scope", "Scope of Services", [
      { id: "effectiveDate", label: "Effective Date", type: "date", required: true },
      { id: "servicesDescription", label: "Description of Services", type: "textarea", required: true },
      { id: "deliverables", label: "Deliverables", type: "textarea" },
      { id: "timeline", label: "Timeline / Milestones", type: "textarea" },
    ]),
    section("compensation", "Compensation & Payment", [
      { id: "feeStructure", label: "Fee Structure", type: "text", required: true },
      { id: "paymentSchedule", label: "Payment Schedule", type: "textarea" },
      FIELD_BLUEPRINTS.paymentTerms,
    ]),
    section("terms", "Terms & Conditions", [
      { id: "termination", label: "Termination Clause", type: "textarea", required: true },
      { id: "confidentiality", label: "Confidentiality", type: "textarea" },
      { id: "liability", label: "Limitation of Liability", type: "textarea" },
      { id: "governingLaw", label: "Governing Law", type: "text", required: true },
    ]),
    section("signatures", "Signatures", [
      FIELD_BLUEPRINTS.signature,
      FIELD_BLUEPRINTS.signatureDate,
      { id: "clientSignature", label: "Client Signature", type: "signature" },
      { id: "clientSignatureDate", label: "Client Signature Date", type: "date" },
    ]),
  ],

  nda: [
    section("parties", "Parties", [
      { id: "disclosingParty", label: "Disclosing Party", type: "text", required: true, defaultFromProfile: "business.name" },
      { id: "receivingParty", label: "Receiving Party", type: "text", required: true },
      { id: "effectiveDate", label: "Effective Date", type: "date", required: true },
    ]),
    section("confidential-info", "Confidential Information", [
      { id: "definition", label: "Definition of Confidential Information", type: "textarea", required: true },
      { id: "exclusions", label: "Exclusions", type: "textarea" },
      { id: "purpose", label: "Purpose of Disclosure", type: "textarea", required: true },
    ]),
    section("obligations", "Obligations", [
      { id: "nonDisclosure", label: "Non-Disclosure Obligations", type: "textarea", required: true },
      { id: "nonUse", label: "Non-Use Obligations", type: "textarea" },
      { id: "term", label: "Term of Agreement", type: "text", required: true },
      { id: "returnOfMaterials", label: "Return of Materials", type: "textarea" },
    ]),
    section("signatures", "Signatures", [
      FIELD_BLUEPRINTS.signature,
      FIELD_BLUEPRINTS.signatureDate,
      { id: "counterSignature", label: "Receiving Party Signature", type: "signature" },
      { id: "counterSignatureDate", label: "Date", type: "date" },
    ]),
  ],

  resume: [
    section("contact", "Contact Information", [
      FIELD_BLUEPRINTS.personName,
      FIELD_BLUEPRINTS.personEmail,
      FIELD_BLUEPRINTS.personPhone,
      FIELD_BLUEPRINTS.personAddress,
      { id: "linkedin", label: "LinkedIn URL", type: "text" },
    ]),
    section("summary", "Professional Summary", [
      { id: "headline", label: "Professional Headline", type: "text", placeholder: "e.g. Experienced Office Manager" },
      { id: "summary", label: "Summary", type: "textarea", required: true },
    ]),
    section("experience", "Work Experience", [
      { id: "experience", label: "Experience Entries", type: "table", required: true, tableColumns: TABLE_COLUMNS.experience },
    ]),
    section("education", "Education", [
      { id: "education", label: "Education Entries", type: "table", tableColumns: TABLE_COLUMNS.education },
    ]),
    section("skills", "Skills & Certifications", [
      { id: "skills", label: "Skills", type: "textarea" },
      { id: "certifications", label: "Certifications", type: "textarea" },
    ]),
  ],

  "donation-receipt": [
    section("organization", "Charitable Organization", [
      FIELD_BLUEPRINTS.businessName,
      FIELD_BLUEPRINTS.businessAddress,
      FIELD_BLUEPRINTS.taxId,
      { id: "orgMission", label: "Mission", type: "textarea" },
    ]),
    section("donor", "Donor Information", [
      { id: "donorName", label: "Donor Name", type: "text", required: true },
      { id: "donorAddress", label: "Donor Address", type: "address", required: true },
    ]),
    section("donation", "Donation Details", [
      { id: "donationDate", label: "Date of Contribution", type: "date", required: true },
      { id: "donationAmount", label: "Cash Amount", type: "currency" },
      { id: "donationDescription", label: "Description of Non-Cash Gift", type: "textarea" },
      { id: "fairMarketValue", label: "Fair Market Value", type: "currency" },
      { id: "noGoodsOrServices", label: "No goods or services were provided", type: "checkbox" },
    ]),
    section("authorization", "Signatures", [
      FIELD_BLUEPRINTS.signature,
      FIELD_BLUEPRINTS.signatureDate,
      { id: "authorizedTitle", label: "Title", type: "text" },
    ]),
  ],
};
