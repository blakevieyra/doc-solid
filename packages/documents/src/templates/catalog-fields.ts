import type { CatalogMeta } from "../catalog/entries";
import type { TemplateSection } from "../types";
import { FIELD_BLUEPRINTS, TABLE_COLUMNS, section } from "../generator/blueprints";

/** Extra table schemas for domain-specific documents */
const COL = {
  inventoryItems: [
    { key: "sku", label: "SKU / Item #", type: "text" as const },
    { key: "itemName", label: "Item Name", type: "text" as const },
    { key: "location", label: "Location / Bin", type: "text" as const },
    { key: "uom", label: "Unit", type: "text" as const, placeholder: "ea, box, lb" },
    { key: "qtyOnHand", label: "Qty on Hand", type: "number" as const },
    { key: "qtyCounted", label: "Qty Counted", type: "number" as const },
    { key: "variance", label: "Variance", type: "number" as const },
    { key: "unitCost", label: "Unit Cost", type: "currency" as const },
  ],
  shipmentItems: [
    { key: "sku", label: "SKU / Item #", type: "text" as const },
    { key: "description", label: "Description", type: "text" as const },
    { key: "qtyShipped", label: "Qty Shipped", type: "number" as const },
    { key: "weight", label: "Weight", type: "text" as const },
    { key: "condition", label: "Condition", type: "text" as const },
  ],
  checklistRows: [
    { key: "item", label: "Item / Step", type: "text" as const },
    { key: "status", label: "Pass / Fail / N/A", type: "text" as const },
    { key: "notes", label: "Notes", type: "text" as const },
  ],
  maintenanceRows: [
    { key: "date", label: "Date", type: "date" as const },
    { key: "asset", label: "Asset / Equipment", type: "text" as const },
    { key: "serviceType", label: "Service Type", type: "text" as const },
    { key: "technician", label: "Technician", type: "text" as const },
    { key: "cost", label: "Cost", type: "currency" as const },
    { key: "nextDue", label: "Next Service Due", type: "date" as const },
  ],
  ledgerLines: [
    { key: "date", label: "Date", type: "date" as const },
    { key: "description", label: "Description", type: "text" as const },
    { key: "debit", label: "Debit", type: "currency" as const },
    { key: "credit", label: "Credit", type: "currency" as const },
    { key: "balance", label: "Balance", type: "currency" as const },
  ],
  volunteerRows: [
    { key: "date", label: "Date", type: "date" as const },
    { key: "volunteerName", label: "Volunteer", type: "text" as const },
    { key: "activity", label: "Activity / Program", type: "text" as const },
    { key: "hours", label: "Hours", type: "number" as const },
  ],
};

function companySection(extra: Parameters<typeof section>[2] = []) {
  return section("company", "Company", [
    FIELD_BLUEPRINTS.businessName,
    FIELD_BLUEPRINTS.businessAddress,
    FIELD_BLUEPRINTS.businessPhone,
    ...extra,
  ]);
}

type ArchetypeBuilder = (meta: CatalogMeta) => TemplateSection[];

const inventorySheet: ArchetypeBuilder = (meta) => [
  companySection([{ id: "warehouseLocation", label: "Warehouse / Location", type: "text", required: true }]),
  section("count", "Physical Inventory Count", [
    { id: "countDate", label: "Count Date", type: "date", required: true },
    { id: "countPeriod", label: "Count Period", type: "text", placeholder: "Q2 2026, Year-end, Cycle count" },
    { id: "countedBy", label: "Counted By", type: "text", required: true },
    { id: "supervisor", label: "Supervisor / Reviewer", type: "text" },
    { id: "valuationMethod", label: "Valuation Method", type: "select", options: ["FIFO", "LIFO", "Weighted Average", "Specific ID"] },
  ], meta.primaryResources[0]),
  section("items", "Inventory Items", [
    { id: "inventoryItems", label: "Stock Count Lines", type: "table", required: true, tableColumns: COL.inventoryItems },
    { id: "totalSkus", label: "Total Line Items", type: "number" },
    { id: "totalValue", label: "Total Inventory Value", type: "currency" },
    FIELD_BLUEPRINTS.notes,
  ]),
  section("signatures", "Verification", [
    FIELD_BLUEPRINTS.signature,
    { id: "reviewerSignature", label: "Supervisor Signature", type: "signature" },
    FIELD_BLUEPRINTS.signatureDate,
  ]),
];

const shippingDoc: ArchetypeBuilder = (meta) => [
  companySection(),
  section("shipper", "Ship From", [
    FIELD_BLUEPRINTS.businessAddress,
    { id: "shipDate", label: "Ship Date", type: "date", required: true },
  ]),
  section("recipient", "Ship To", [
    FIELD_BLUEPRINTS.clientName,
    FIELD_BLUEPRINTS.clientAddress,
    { id: "carrier", label: "Carrier", type: "text" },
    { id: "trackingNumber", label: "Tracking / PRO Number", type: "text" },
  ]),
  section("shipment", meta.name, [
    { id: "referenceNumber", label: "Reference / Order #", type: "text", required: true },
    { id: "shipmentItems", label: "Shipment Contents", type: "table", required: true, tableColumns: COL.shipmentItems },
    { id: "totalPackages", label: "Total Packages", type: "number" },
    { id: "specialInstructions", label: "Special Instructions", type: "textarea" },
  ]),
  section("signatures", "Acknowledgment", [
    { id: "receivedBy", label: "Received By (print name)", type: "text" },
    { id: "receiverSignature", label: "Receiver Signature", type: "signature" },
    FIELD_BLUEPRINTS.signatureDate,
  ]),
];

const checklistDoc: ArchetypeBuilder = (meta) => [
  companySection(),
  section("inspection", meta.name, [
    { id: "inspectionDate", label: "Date", type: "date", required: true },
    { id: "inspector", label: "Inspector / Reviewer", type: "text", required: true },
    { id: "location", label: "Location / Site", type: "text", required: true },
    { id: "checklistItems", label: "Checklist Items", type: "table", required: true, tableColumns: COL.checklistRows },
    { id: "overallResult", label: "Overall Result", type: "select", options: ["Pass", "Pass with notes", "Fail", "Incomplete"] },
    { id: "correctiveActions", label: "Corrective Actions Required", type: "textarea" },
  ]),
  section("signatures", "Sign-off", [FIELD_BLUEPRINTS.signature, FIELD_BLUEPRINTS.signatureDate]),
];

const sopDoc: ArchetypeBuilder = (meta) => [
  companySection(),
  section("procedure", meta.name, [
    { id: "sopNumber", label: "SOP Number", type: "text", required: true },
    { id: "effectiveDate", label: "Effective Date", type: "date", required: true },
    { id: "revision", label: "Revision", type: "text", placeholder: "Rev 1.0" },
    { id: "purpose", label: "Purpose", type: "textarea", required: true },
    { id: "scope", label: "Scope", type: "textarea", required: true },
    { id: "responsibilities", label: "Responsibilities", type: "textarea", required: true },
    { id: "procedureSteps", label: "Procedure Steps", type: "textarea", required: true },
    { id: "references", label: "References & Related Documents", type: "textarea" },
  ]),
  section("approval", "Approval", [
    { id: "preparedBy", label: "Prepared By", type: "text", required: true },
    FIELD_BLUEPRINTS.signature,
    FIELD_BLUEPRINTS.signatureDate,
  ]),
];

const maintenanceDoc: ArchetypeBuilder = (meta) => [
  companySection(),
  section("log", meta.name, [
    { id: "assetId", label: "Asset ID / Tag", type: "text" },
    { id: "maintenanceEntries", label: "Maintenance Records", type: "table", required: true, tableColumns: COL.maintenanceRows },
    FIELD_BLUEPRINTS.notes,
  ]),
];

const rmaDoc: ArchetypeBuilder = (meta) => [
  companySection(),
  section("customer", "Customer", [FIELD_BLUEPRINTS.clientName, FIELD_BLUEPRINTS.clientEmail, FIELD_BLUEPRINTS.clientPhone]),
  section("return", meta.name, [
    { id: "rmaNumber", label: "RMA / Claim #", type: "text", required: true },
    { id: "originalOrder", label: "Original Order / Invoice #", type: "text", required: true },
    { id: "productDescription", label: "Product Description", type: "textarea", required: true },
    { id: "serialNumber", label: "Serial / Model Number", type: "text" },
    { id: "reason", label: "Reason for Return / Claim", type: "textarea", required: true },
    { id: "resolution", label: "Requested Resolution", type: "select", options: ["Refund", "Replacement", "Repair", "Store credit"] },
  ]),
  section("signatures", "Signatures", [FIELD_BLUEPRINTS.signature, FIELD_BLUEPRINTS.signatureDate]),
];

const vendorRegistration: ArchetypeBuilder = () => [
  companySection([FIELD_BLUEPRINTS.taxId]),
  section("vendor", "Vendor Information", [
    { id: "vendorName", label: "Vendor Legal Name", type: "text", required: true },
    { id: "vendorAddress", label: "Vendor Address", type: "address", required: true },
    { id: "vendorContact", label: "Primary Contact", type: "text", required: true },
    { id: "vendorEmail", label: "Accounts Payable Email", type: "email", required: true },
    { id: "vendorPhone", label: "Phone", type: "phone" },
    { id: "vendorTaxId", label: "Tax ID / EIN", type: "text", required: true },
    { id: "paymentTerms", label: "Payment Terms", type: "text" },
    { id: "bankingInfo", label: "Banking / ACH Details", type: "textarea", helpText: "Store securely — do not email unencrypted" },
  ]),
  section("compliance", "Compliance", [
    { id: "insuranceCert", label: "Insurance Certificate on File", type: "checkbox" },
    { id: "w9Received", label: "W-9 Received", type: "checkbox" },
    FIELD_BLUEPRINTS.notes,
  ]),
];

const hrDiscipline: ArchetypeBuilder = (meta) => [
  section("employer", "Employer", [FIELD_BLUEPRINTS.businessName, FIELD_BLUEPRINTS.businessAddress]),
  section("employee", "Employee", [
    FIELD_BLUEPRINTS.personName,
    { id: "jobTitle", label: "Job Title", type: "text", required: true },
    { id: "department", label: "Department", type: "text" },
  ]),
  section("action", meta.name, [
    { id: "letterDate", label: "Date", type: "date", required: true },
    { id: "subject", label: "Subject", type: "text", required: true },
    { id: "incidentSummary", label: "Summary of Issue / Performance", type: "textarea", required: true },
    { id: "policyViolated", label: "Policy / Standard Violated", type: "textarea" },
    { id: "expectedImprovement", label: "Expected Improvement / Next Steps", type: "textarea", required: true },
    { id: "consequences", label: "Consequences if Not Corrected", type: "textarea" },
  ]),
  section("signatures", "Acknowledgment", [
    FIELD_BLUEPRINTS.signature,
    { id: "employeeSignature", label: "Employee Signature", type: "signature", required: true },
    FIELD_BLUEPRINTS.signatureDate,
  ]),
];

const legalDemand: ArchetypeBuilder = (meta) => [
  section("from", "From", [FIELD_BLUEPRINTS.businessName, FIELD_BLUEPRINTS.businessAddress, FIELD_BLUEPRINTS.businessEmail]),
  section("to", "To", [FIELD_BLUEPRINTS.clientName, FIELD_BLUEPRINTS.clientAddress]),
  section("demand", meta.name, [
    { id: "letterDate", label: "Date", type: "date", required: true },
    { id: "subject", label: "Re:", type: "text", required: true },
    { id: "background", label: "Background", type: "textarea", required: true },
    { id: "demandDetails", label: "Demand / Required Action", type: "textarea", required: true },
    { id: "deadline", label: "Response Deadline", type: "date", required: true },
    { id: "consequences", label: "Consequences of Non-Compliance", type: "textarea" },
  ]),
  section("signatures", "Authorized Signer", [FIELD_BLUEPRINTS.signature, FIELD_BLUEPRINTS.signatureDate]),
];

const projectReport: ArchetypeBuilder = (meta) => [
  section("project", "Project", [
    { id: "projectName", label: "Project Name", type: "text", required: true },
    { id: "projectManager", label: "Project Manager", type: "text", required: true },
    { id: "reportPeriod", label: "Reporting Period", type: "text", required: true },
  ]),
  section("report", meta.name, [
    { id: "reportDate", label: "Report Date", type: "date", required: true },
    { id: "statusSummary", label: "Overall Status", type: "select", options: ["On Track", "At Risk", "Off Track", "Complete"], required: true },
    { id: "accomplishments", label: "Accomplishments This Period", type: "textarea", required: true },
    { id: "upcomingWork", label: "Planned Work Next Period", type: "textarea", required: true },
    { id: "risks", label: "Risks & Issues", type: "textarea" },
    { id: "budgetStatus", label: "Budget Status", type: "textarea" },
  ]),
];

const financialStatement: ArchetypeBuilder = (meta) => [
  companySection([FIELD_BLUEPRINTS.taxId]),
  section("statement", meta.name, [
    { id: "periodEnd", label: "Period End Date", type: "date", required: true },
    { id: "preparedBy", label: "Prepared By", type: "text", required: true },
    { id: "statementLines", label: "Line Items", type: "table", required: true, tableColumns: COL.ledgerLines },
    { id: "totalsNotes", label: "Notes & Disclosures", type: "textarea" },
  ]),
];

const letterDoc: ArchetypeBuilder = (meta) => [
  section("sender", "From", [
    meta.domain === "individual" ? FIELD_BLUEPRINTS.personName : FIELD_BLUEPRINTS.businessName,
    meta.domain === "individual" ? FIELD_BLUEPRINTS.personAddress : FIELD_BLUEPRINTS.businessAddress,
  ]),
  section("recipient", "To", [FIELD_BLUEPRINTS.clientName, FIELD_BLUEPRINTS.clientAddress]),
  section("letter", meta.name, [
    { id: "letterDate", label: "Date", type: "date", required: true },
    { id: "subject", label: "Subject", type: "text", required: true },
    { id: "body", label: "Message", type: "textarea", required: true },
    { id: "closing", label: "Closing", type: "textarea" },
  ]),
  section("signatures", "Signature", [FIELD_BLUEPRINTS.signature, FIELD_BLUEPRINTS.signatureDate]),
];

const nonprofitProgram: ArchetypeBuilder = (meta) => [
  section("organization", "Organization", [
    FIELD_BLUEPRINTS.businessName,
    FIELD_BLUEPRINTS.businessAddress,
    { id: "orgMission", label: "Mission", type: "textarea" },
  ]),
  section("program", meta.name, [
    { id: "programName", label: "Program Name", type: "text", required: true },
    { id: "reportPeriod", label: "Period", type: "text", required: true },
    { id: "objectives", label: "Objectives", type: "textarea", required: true },
    { id: "activities", label: "Activities & Outcomes", type: "textarea", required: true },
    { id: "participantsServed", label: "Participants Served", type: "number" },
    { id: "budgetUsed", label: "Budget Used", type: "currency" },
    { id: "impactMetrics", label: "Impact Metrics", type: "textarea" },
  ]),
  section("signatures", "Authorized Signer", [FIELD_BLUEPRINTS.signature, FIELD_BLUEPRINTS.signatureDate]),
];

const volunteerLog: ArchetypeBuilder = (meta) => [
  section("organization", "Organization", [FIELD_BLUEPRINTS.businessName]),
  section("log", meta.name, [
    { id: "programName", label: "Program / Event", type: "text", required: true },
    { id: "period", label: "Period", type: "text", required: true },
    { id: "volunteerEntries", label: "Volunteer Hours", type: "table", required: true, tableColumns: COL.volunteerRows },
    { id: "totalHours", label: "Total Hours", type: "number", required: true },
  ]),
];

const policyDoc: ArchetypeBuilder = (meta) => [
  section("organization", "Organization", [FIELD_BLUEPRINTS.businessName, FIELD_BLUEPRINTS.businessAddress]),
  section("policy", meta.name, [
    { id: "effectiveDate", label: "Effective Date", type: "date", required: true },
    { id: "purpose", label: "Purpose", type: "textarea", required: true },
    { id: "policyText", label: "Policy Statement", type: "textarea", required: true },
    { id: "procedures", label: "Procedures", type: "textarea" },
    { id: "reporting", label: "Reporting & Enforcement", type: "textarea" },
  ]),
  section("approval", "Board Approval", [
    { id: "approvedBy", label: "Approved By", type: "text", required: true },
    FIELD_BLUEPRINTS.signature,
    FIELD_BLUEPRINTS.signatureDate,
  ]),
];

const personalPlanner: ArchetypeBuilder = (meta) => [
  section("planner", "Your Information", [FIELD_BLUEPRINTS.personName, { id: "planningPeriod", label: "Planning Period", type: "text", required: true }]),
  section("plan", meta.name, [
    { id: "goals", label: "Goals", type: "textarea", required: true },
    { id: "tasks", label: "Tasks & Schedule", type: "table", tableColumns: TABLE_COLUMNS.actionItems },
    { id: "notes", label: "Notes", type: "textarea" },
  ]),
];

const creditApplication: ArchetypeBuilder = () => [
  companySection(),
  section("applicant", "Customer / Applicant", [
    FIELD_BLUEPRINTS.clientName,
    FIELD_BLUEPRINTS.clientAddress,
    FIELD_BLUEPRINTS.clientEmail,
    FIELD_BLUEPRINTS.clientPhone,
    { id: "yearsInBusiness", label: "Years in Business", type: "number" },
    { id: "requestedLimit", label: "Requested Credit Limit", type: "currency", required: true },
    { id: "bankReferences", label: "Bank & Trade References", type: "textarea", required: true },
  ]),
  section("approval", "Credit Decision", [
    { id: "approvedLimit", label: "Approved Limit", type: "currency" },
    { id: "terms", label: "Payment Terms", type: "text" },
    FIELD_BLUEPRINTS.signature,
    FIELD_BLUEPRINTS.signatureDate,
  ]),
];

const contractParties: ArchetypeBuilder = (meta) => [
  section("parties", "Parties", [
    FIELD_BLUEPRINTS.businessName,
    FIELD_BLUEPRINTS.businessAddress,
    { id: "counterpartyName", label: "Other Party Name", type: "text", required: true },
    { id: "counterpartyAddress", label: "Other Party Address", type: "address" },
  ]),
  section("terms", meta.name, [
    { id: "effectiveDate", label: "Effective Date", type: "date", required: true },
    { id: "termEnd", label: "End / Expiration Date", type: "date" },
    { id: "scope", label: "Scope & Purpose", type: "textarea", required: true },
    { id: "compensation", label: "Compensation / Consideration", type: "textarea" },
    { id: "specialTerms", label: "Special Terms", type: "textarea", required: true },
    FIELD_BLUEPRINTS.notes,
  ]),
  section("signatures", "Signatures", [
    FIELD_BLUEPRINTS.signature,
    { id: "counterSignature", label: "Other Party Signature", type: "signature", required: true },
    FIELD_BLUEPRINTS.signatureDate,
  ]),
];

/** Maps each catalog document id to a specific field archetype */
const DOCUMENT_ARCHETYPE: Record<string, ArchetypeBuilder> = {
  "inventory-sheet": inventorySheet,
  "home-inventory": inventorySheet,
  "packing-slip": shippingDoc,
  "bill-of-lading": shippingDoc,
  "delivery-receipt": shippingDoc,
  "sop": sopDoc,
  "maintenance-log": maintenanceDoc,
  "quality-control-checklist": checklistDoc,
  "safety-inspection-checklist": checklistDoc,
  "audit-preparation-checklist": checklistDoc,
  "employee-onboarding-checklist": checklistDoc,
  "moving-checklist": checklistDoc,
  "event-planning-checklist": checklistDoc,
  "wedding-planning-checklist": checklistDoc,
  "return-authorization": rmaDoc,
  "warranty-claim": rmaDoc,
  "vendor-registration-form": vendorRegistration,
  "equipment-rental": contractParties,
  "performance-review": hrDiscipline,
  "termination-letter": hrDiscipline,
  "warning-letter": hrDiscipline,
  "employee-handbook-acknowledgment": hrDiscipline,
  "training-record": hrDiscipline,
  "job-description": hrDiscipline,
  "demand-letter": legalDemand,
  "collection-letter": legalDemand,
  "cease-and-desist": legalDemand,
  "contract-renewal-notice": legalDemand,
  "contract-amendment": contractParties,
  "subcontractor-agreement": contractParties,
  "vendor-agreement": contractParties,
  "partnership-agreement": contractParties,
  "ip-assignment": contractParties,
  "hipaa-baa": contractParties,
  "power-of-attorney": contractParties,
  "contractor-agreement-personal": contractParties,
  "roommate-agreement": contractParties,
  "event-sponsorship-agreement": contractParties,
  "advisory-board-agreement": contractParties,
  "sports-team-waiver": contractParties,
  "scope-of-work": projectReport,
  "project-status-report": projectReport,
  "project-charter": projectReport,
  "business-plan": projectReport,
  "change-order": projectReport,
  "marketing-plan": projectReport,
  "rfp-response": projectReport,
  "balance-sheet": financialStatement,
  "income-statement": financialStatement,
  "cash-flow-statement": financialStatement,
  "bank-reconciliation": financialStatement,
  "accounts-receivable-aging": financialStatement,
  "petty-cash-voucher": financialStatement,
  "asset-disposal-form": financialStatement,
  "side-business-ledger": financialStatement,
  "personal-net-worth": financialStatement,
  "tax-deduction-tracker": financialStatement,
  "credit-memo": financialStatement,
  "statement-of-account": financialStatement,
  "1099-summary": financialStatement,
  "fund-allocation-report": financialStatement,
  "program-budget": financialStatement,
  "budget-proposal-nonprofit": financialStatement,
  "customer-credit-application": creditApplication,
  "press-release": letterDoc,
  "customer-feedback-form": letterDoc,
  "community-newsletter": letterDoc,
  "inter-office-memo": letterDoc,
  "fundraising-letter": letterDoc,
  "complaint-letter": letterDoc,
  "thank-you-letter": letterDoc,
  "apology-letter": letterDoc,
  "subscription-cancellation": letterDoc,
  "personal-reference-letter": letterDoc,
  "gift-letter": letterDoc,
  "dispute-letter": letterDoc,
  "party-invitation": letterDoc,
  "meeting-agenda": letterDoc,
  "lease-renewal-request": letterDoc,
  "donor-acknowledgment": letterDoc,
  "grant-report": nonprofitProgram,
  "annual-report": nonprofitProgram,
  "program-evaluation-report": nonprofitProgram,
  "capital-campaign-plan": nonprofitProgram,
  "sponsorship-proposal": nonprofitProgram,
  "volunteer-hours-log": volunteerLog,
  "volunteer-signup-sheet": volunteerLog,
  "in-kind-donation-receipt": nonprofitProgram,
  "board-resolution": policyDoc,
  "board-meeting-minutes": policyDoc,
  "committee-charter": policyDoc,
  "strategic-plan": policyDoc,
  "conflict-of-interest-policy": policyDoc,
  "code-of-conduct": policyDoc,
  "whistleblower-policy": policyDoc,
  "hoa-rules-acknowledgment": policyDoc,
  "terms-of-service": policyDoc,
  "babysitter-instructions": personalPlanner,
  "pet-care-agreement": contractParties,
  "travel-itinerary": personalPlanner,
  "meal-planner": personalPlanner,
  "goal-setting-worksheet": personalPlanner,
  "house-rules": policyDoc,
  "interview-prep-worksheet": personalPlanner,
  "school-excuse-note": letterDoc,
  "permission-slip": letterDoc,
  "emergency-contact-sheet": personalPlanner,
};

export function getCatalogFieldTemplate(meta: CatalogMeta): TemplateSection[] | null {
  const builder = DOCUMENT_ARCHETYPE[meta.id];
  return builder ? builder(meta) : null;
}

/** Detect legacy generic operations fallback (Date + Reference # + Description only). */
export function isGenericOperationsTemplate(fieldIds: string[]): boolean {
  const ids = new Set(fieldIds);
  return (
    ids.has("referenceNumber") &&
    ids.has("description") &&
    ids.has("instructions") &&
    !ids.has("inventoryItems") &&
    !ids.has("shipmentItems") &&
    !ids.has("checklistItems")
  );
}
