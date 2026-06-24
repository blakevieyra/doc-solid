import type { TemplateSection } from "../types";
import { FIELD_BLUEPRINTS, TABLE_COLUMNS, section, LANDLORD_SIGNATURE, LENDER_SIGNATURE } from "../generator/blueprints";

/** Per-document form overrides for catalog entries that need specific fields. */
export const TEMPLATE_OVERRIDES: Record<string, TemplateSection[]> = {
  "vehicle-bill-of-sale": [
    section("seller", "Seller", [
      FIELD_BLUEPRINTS.personName,
      FIELD_BLUEPRINTS.personAddress,
      FIELD_BLUEPRINTS.personPhone,
      { id: "sellerEmail", label: "Seller Email", type: "email", defaultFromProfile: "personal.email" },
    ], "State DMV title transfer requirements"),
    section("buyer", "Buyer", [
      { id: "buyerName", label: "Buyer Full Name", type: "text", required: true },
      { id: "buyerAddress", label: "Buyer Address", type: "address", required: true },
      { id: "buyerPhone", label: "Buyer Phone", type: "phone" },
    ]),
    section("vehicle", "Vehicle Details", [
      { id: "saleDate", label: "Date of Sale", type: "date", required: true },
      { id: "vehicleYear", label: "Year", type: "text", required: true },
      { id: "vehicleMake", label: "Make", type: "text", required: true },
      { id: "vehicleModel", label: "Model", type: "text", required: true },
      { id: "vin", label: "VIN", type: "text", required: true },
      { id: "odometer", label: "Odometer Reading", type: "text", required: true },
      { id: "licensePlate", label: "License Plate", type: "text" },
      { id: "color", label: "Color", type: "text" },
    ]),
    section("sale", "Sale Terms", [
      { id: "salePrice", label: "Sale Price", type: "currency", required: true },
      { id: "paymentMethod", label: "Payment Method", type: "text", placeholder: "Cash, check, wire, etc." },
      { id: "asIs", label: "Sold As-Is", type: "checkbox" },
      FIELD_BLUEPRINTS.notes,
    ]),
    section("signatures", "Signatures", [
      { id: "sellerSignature", label: "Seller Signature", type: "signature", required: true, ownerSignature: true, defaultFromProfile: "signature.owner" },
      { id: "buyerSignature", label: "Buyer Signature", type: "signature", required: true },
      FIELD_BLUEPRINTS.signatureDate,
    ]),
  ],

  "cover-letter": [
    section("sender", "Your Information", [
      FIELD_BLUEPRINTS.personName,
      FIELD_BLUEPRINTS.personAddress,
      FIELD_BLUEPRINTS.personEmail,
      FIELD_BLUEPRINTS.personPhone,
    ]),
    section("recipient", "Recipient", [
      { id: "hiringManager", label: "Hiring Manager / Recipient", type: "text", required: true },
      { id: "companyName", label: "Company Name", type: "text", required: true },
      { id: "companyAddress", label: "Company Address", type: "address" },
    ]),
    section("letter", "Cover Letter", [
      { id: "date", label: "Date", type: "date", required: true },
      { id: "position", label: "Position Applied For", type: "text", required: true },
      { id: "opening", label: "Opening Paragraph", type: "textarea", required: true },
      { id: "body", label: "Body", type: "textarea", required: true },
      { id: "closing", label: "Closing", type: "textarea", required: true },
    ]),
  ],

  "resignation-letter": [
    section("employee", "Employee", [
      FIELD_BLUEPRINTS.personName,
      FIELD_BLUEPRINTS.personEmail,
      { id: "jobTitle", label: "Job Title", type: "text", required: true },
    ]),
    section("employer", "Employer", [
      { id: "managerName", label: "Manager Name", type: "text", required: true },
      FIELD_BLUEPRINTS.businessName,
    ]),
    section("resignation", "Resignation Details", [
      { id: "letterDate", label: "Date", type: "date", required: true },
      { id: "lastDay", label: "Last Working Day", type: "date", required: true },
      { id: "reason", label: "Reason (optional)", type: "textarea" },
      { id: "body", label: "Letter Body", type: "textarea", required: true },
    ]),
    section("signatures", "Signatures", [
      FIELD_BLUEPRINTS.signature,
      FIELD_BLUEPRINTS.signatureDate,
    ]),
  ],

  "quote-estimate": [
    section("from", "From", [
      FIELD_BLUEPRINTS.businessName,
      FIELD_BLUEPRINTS.businessAddress,
      FIELD_BLUEPRINTS.businessPhone,
      FIELD_BLUEPRINTS.businessEmail,
    ]),
    section("client", "Client", [
      FIELD_BLUEPRINTS.clientName,
      FIELD_BLUEPRINTS.clientAddress,
      FIELD_BLUEPRINTS.clientEmail,
    ]),
    section("quote", "Quote Details", [
      { id: "quoteNumber", label: "Quote Number", type: "text", required: true },
      { id: "quoteDate", label: "Quote Date", type: "date", required: true },
      { id: "validUntil", label: "Valid Until", type: "date", required: true },
      { id: "projectScope", label: "Scope of Work", type: "textarea", required: true },
      FIELD_BLUEPRINTS.lineItems,
      FIELD_BLUEPRINTS.subtotal,
      FIELD_BLUEPRINTS.taxAmount,
      FIELD_BLUEPRINTS.total,
      FIELD_BLUEPRINTS.notes,
    ]),
  ],

  "proposal": [
    section("from", "Prepared By", [
      FIELD_BLUEPRINTS.businessName,
      FIELD_BLUEPRINTS.businessAddress,
      FIELD_BLUEPRINTS.businessEmail,
    ]),
    section("client", "Client", [
      FIELD_BLUEPRINTS.clientName,
      FIELD_BLUEPRINTS.clientAddress,
    ]),
    section("proposal", "Proposal", [
      { id: "proposalDate", label: "Date", type: "date", required: true },
      { id: "executiveSummary", label: "Executive Summary", type: "textarea", required: true },
      { id: "objectives", label: "Objectives", type: "textarea", required: true },
      { id: "approach", label: "Approach / Methodology", type: "textarea", required: true },
      { id: "timeline", label: "Timeline", type: "textarea" },
      { id: "investment", label: "Investment / Pricing", type: "textarea", required: true },
    ]),
  ],

  "work-order": [
    section("company", "Service Provider", [
      FIELD_BLUEPRINTS.businessName,
      FIELD_BLUEPRINTS.businessPhone,
      FIELD_BLUEPRINTS.businessAddress,
    ]),
    section("client", "Client / Site", [
      FIELD_BLUEPRINTS.clientName,
      FIELD_BLUEPRINTS.clientAddress,
      FIELD_BLUEPRINTS.clientPhone,
    ]),
    section("order", "Work Order", [
      { id: "workOrderNumber", label: "Work Order #", type: "text", required: true },
      { id: "orderDate", label: "Date", type: "date", required: true },
      { id: "scheduledDate", label: "Scheduled Date", type: "date" },
      { id: "description", label: "Work Description", type: "textarea", required: true },
      { id: "materials", label: "Materials / Parts", type: "textarea" },
      { id: "laborHours", label: "Estimated Labor Hours", type: "number" },
      { id: "estimatedCost", label: "Estimated Cost", type: "currency" },
    ]),
  ],

  "purchase-order": [
    section("buyer", "Buyer", [
      FIELD_BLUEPRINTS.businessName,
      FIELD_BLUEPRINTS.businessAddress,
      FIELD_BLUEPRINTS.taxId,
    ]),
    section("vendor", "Vendor", [
      { id: "vendorName", label: "Vendor Name", type: "text", required: true },
      { id: "vendorAddress", label: "Vendor Address", type: "address" },
    ]),
    section("order", "Purchase Order", [
      { id: "poNumber", label: "PO Number", type: "text", required: true },
      { id: "orderDate", label: "Order Date", type: "date", required: true },
      { id: "deliveryDate", label: "Requested Delivery", type: "date" },
      FIELD_BLUEPRINTS.lineItems,
      FIELD_BLUEPRINTS.total,
      FIELD_BLUEPRINTS.notes,
    ]),
  ],

  "sales-order": [
    section("seller", "Seller", [FIELD_BLUEPRINTS.businessName, FIELD_BLUEPRINTS.businessAddress]),
    section("customer", "Customer", [FIELD_BLUEPRINTS.clientName, FIELD_BLUEPRINTS.clientAddress]),
    section("order", "Sales Order", [
      { id: "soNumber", label: "Sales Order #", type: "text", required: true },
      { id: "orderDate", label: "Order Date", type: "date", required: true },
      { id: "shipDate", label: "Ship Date", type: "date" },
      FIELD_BLUEPRINTS.lineItems,
      FIELD_BLUEPRINTS.total,
    ]),
  ],

  "client-intake-form": [
    section("provider", "Your Organization", [FIELD_BLUEPRINTS.businessName, FIELD_BLUEPRINTS.businessEmail]),
    section("client", "Client Information", [
      FIELD_BLUEPRINTS.clientName,
      FIELD_BLUEPRINTS.clientEmail,
      FIELD_BLUEPRINTS.clientPhone,
      FIELD_BLUEPRINTS.clientAddress,
      { id: "referralSource", label: "How did you hear about us?", type: "text" },
    ]),
    section("intake", "Intake Details", [
      { id: "serviceNeeded", label: "Service Needed", type: "textarea", required: true },
      { id: "goals", label: "Goals", type: "textarea", required: true },
      { id: "budget", label: "Budget Range", type: "text" },
      { id: "timeline", label: "Desired Timeline", type: "text" },
      { id: "additionalNotes", label: "Additional Notes", type: "textarea" },
    ]),
  ],

  "residential-lease": [
    section("landlord", "Landlord", [
      FIELD_BLUEPRINTS.businessName,
      FIELD_BLUEPRINTS.businessAddress,
      FIELD_BLUEPRINTS.businessPhone,
    ]),
    section("tenant", "Tenant", [
      FIELD_BLUEPRINTS.personName,
      FIELD_BLUEPRINTS.personAddress,
      FIELD_BLUEPRINTS.personEmail,
      FIELD_BLUEPRINTS.personPhone,
    ]),
    section("property", "Property", [
      { id: "propertyAddress", label: "Rental Property Address", type: "address", required: true },
      { id: "unit", label: "Unit / Apt", type: "text" },
    ]),
    section("terms", "Lease Terms", [
      { id: "leaseStart", label: "Lease Start Date", type: "date", required: true },
      { id: "leaseEnd", label: "Lease End Date", type: "date", required: true },
      { id: "monthlyRent", label: "Monthly Rent", type: "currency", required: true },
      { id: "securityDeposit", label: "Security Deposit", type: "currency", required: true },
      { id: "lateFee", label: "Late Fee Policy", type: "text" },
      { id: "utilities", label: "Utilities Included", type: "textarea" },
      { id: "rules", label: "Rules & Restrictions", type: "textarea" },
    ]),
    section("signatures", "Signatures", [
      LANDLORD_SIGNATURE,
      { id: "tenantSignature", label: "Tenant Signature", type: "signature", required: true },
      FIELD_BLUEPRINTS.signatureDate,
    ]),
  ],

  "rental-application": [
    section("applicant", "Applicant", [
      FIELD_BLUEPRINTS.personName,
      FIELD_BLUEPRINTS.personEmail,
      FIELD_BLUEPRINTS.personPhone,
      { id: "currentAddress", label: "Current Address", type: "address", required: true },
      { id: "employer", label: "Employer", type: "text", required: true },
      { id: "monthlyIncome", label: "Monthly Income", type: "currency", required: true },
    ]),
    section("property", "Property Applied For", [
      { id: "propertyAddress", label: "Property Address", type: "address", required: true },
      { id: "moveInDate", label: "Desired Move-In Date", type: "date", required: true },
    ]),
    section("references", "References", [
      { id: "priorLandlord", label: "Prior Landlord Contact", type: "textarea" },
      { id: "personalReference", label: "Personal Reference", type: "textarea" },
    ]),
  ],

  "personal-budget": [
    section("planner", "Planner", [FIELD_BLUEPRINTS.personName, { id: "budgetMonth", label: "Budget Month", type: "text", required: true }]),
    section("income", "Income", [
      { id: "incomeSources", label: "Income Sources", type: "table", required: true, tableColumns: TABLE_COLUMNS.incomeSources },
      { id: "totalIncome", label: "Total Income", type: "currency" },
    ]),
    section("expenses", "Expenses", [
      { id: "expenseCategories", label: "Expense Categories", type: "table", required: true, tableColumns: TABLE_COLUMNS.expenseCategories },
      { id: "totalExpenses", label: "Total Expenses", type: "currency" },
      { id: "savingsGoal", label: "Savings Goal", type: "currency" },
    ]),
  ],

  "receipt": [
    section("issuer", "From", [FIELD_BLUEPRINTS.businessName, FIELD_BLUEPRINTS.businessAddress]),
    section("recipient", "Received From", [FIELD_BLUEPRINTS.clientName]),
    section("receipt", "Receipt", [
      { id: "receiptNumber", label: "Receipt Number", type: "text", required: true },
      { id: "receiptDate", label: "Date", type: "date", required: true },
      { id: "amountReceived", label: "Amount Received", type: "currency", required: true },
      { id: "paymentFor", label: "Payment For", type: "textarea", required: true },
      { id: "paymentMethod", label: "Payment Method", type: "text" },
    ]),
  ],

  "expense-report": [
    section("employee", "Employee", [FIELD_BLUEPRINTS.personName, FIELD_BLUEPRINTS.businessName]),
    section("report", "Expense Report", [
      { id: "reportPeriod", label: "Report Period", type: "text", required: true },
      { id: "expenses", label: "Expenses", type: "table", required: true, tableColumns: TABLE_COLUMNS.expenses },
      { id: "totalExpenses", label: "Total Reimbursable", type: "currency", required: true },
      FIELD_BLUEPRINTS.notes,
    ]),
    section("signatures", "Signatures", [
      FIELD_BLUEPRINTS.signature,
      FIELD_BLUEPRINTS.signatureDate,
    ]),
  ],

  "timesheet": [
    section("employee", "Employee", [
      FIELD_BLUEPRINTS.personName,
      { id: "employeeId", label: "Employee ID", type: "text" },
      { id: "department", label: "Department", type: "text" },
    ]),
    section("period", "Pay Period", [
      { id: "periodStart", label: "Period Start", type: "date", required: true },
      { id: "periodEnd", label: "Period End", type: "date", required: true },
    ]),
    section("hours", "Time Entries", [
      { id: "timeEntries", label: "Daily Hours", type: "table", required: true, tableColumns: TABLE_COLUMNS.timeEntries },
      { id: "totalHours", label: "Total Hours", type: "number", required: true },
    ]),
    section("signatures", "Signatures", [
      {
        id: "employeeSignature",
        label: "Employee Signature",
        type: "signature",
        required: true,
        ownerSignature: true,
        defaultFromProfile: "signature.owner",
      },
      FIELD_BLUEPRINTS.signatureDate,
      {
        id: "supervisorSignature",
        label: "Supervisor Signature",
        type: "signature",
        required: true,
      },
    ]),
  ],

  "business-plan": [
    section("company", "Company Overview", [
      FIELD_BLUEPRINTS.businessName,
      { id: "legalStructure", label: "Legal Structure", type: "text", required: true },
      { id: "foundingDate", label: "Founded / Planned Start", type: "text" },
      FIELD_BLUEPRINTS.businessAddress,
    ]),
    section("executive-summary", "Executive Summary", [
      { id: "executiveSummary", label: "Executive Summary", type: "textarea", required: true },
    ]),
    section("products", "Products & Services", [
      { id: "productsServices", label: "Products & Services", type: "textarea", required: true },
      { id: "competitiveAdvantage", label: "Competitive Advantage", type: "textarea", required: true },
    ]),
    section("market", "Market Analysis", [
      { id: "targetMarket", label: "Target Market", type: "textarea", required: true },
      { id: "marketSize", label: "Market Size & Trends", type: "textarea", required: true },
      { id: "competition", label: "Competition", type: "textarea" },
    ]),
    section("operations", "Operations & Management", [
      { id: "managementTeam", label: "Management Team", type: "textarea", required: true },
      { id: "operationsPlan", label: "Operations Plan", type: "textarea", required: true },
    ]),
    section("marketing", "Marketing & Sales", [
      { id: "marketingStrategy", label: "Marketing Strategy", type: "textarea", required: true },
      { id: "salesStrategy", label: "Sales Strategy", type: "textarea" },
    ]),
    section("financials", "Financial Projections", [
      { id: "startupCosts", label: "Startup Costs / Funding Needs", type: "textarea", required: true },
      { id: "revenueProjections", label: "Revenue Projections", type: "textarea", required: true },
      { id: "breakEven", label: "Break-even Analysis", type: "textarea" },
    ]),
    section("signatures", "Authorization", [
      FIELD_BLUEPRINTS.signature,
      FIELD_BLUEPRINTS.signatureDate,
    ]),
  ],

  "incident-report": [
    section("reporter", "Reporter", [
      FIELD_BLUEPRINTS.businessName,
      { id: "reporterName", label: "Reporter Name", type: "text", required: true },
      { id: "reportDate", label: "Report Date", type: "date", required: true },
    ]),
    section("incident", "Incident Details", [
      { id: "incidentDate", label: "Incident Date & Time", type: "text", required: true },
      { id: "location", label: "Location", type: "text", required: true },
      { id: "description", label: "Description of Incident", type: "textarea", required: true },
      { id: "injuries", label: "Injuries / Damage", type: "textarea" },
      { id: "witnesses", label: "Witnesses", type: "textarea" },
      { id: "correctiveActions", label: "Corrective Actions", type: "textarea" },
    ]),
  ],

  "payment-reminder": [
    section("from", "From", [FIELD_BLUEPRINTS.businessName, FIELD_BLUEPRINTS.businessEmail, FIELD_BLUEPRINTS.businessPhone]),
    section("to", "To", [FIELD_BLUEPRINTS.clientName, FIELD_BLUEPRINTS.clientEmail]),
    section("reminder", "Payment Reminder", [
      { id: "invoiceNumber", label: "Invoice / Reference #", type: "text", required: true },
      { id: "amountDue", label: "Amount Due", type: "currency", required: true },
      { id: "dueDate", label: "Original Due Date", type: "date", required: true },
      { id: "message", label: "Reminder Message", type: "textarea", required: true },
    ]),
  ],

  "freelance-invoice": [
    section("from", "From", [
      FIELD_BLUEPRINTS.personName,
      FIELD_BLUEPRINTS.personAddress,
      FIELD_BLUEPRINTS.personEmail,
      FIELD_BLUEPRINTS.personPhone,
    ]),
    section("client", "Bill To", [FIELD_BLUEPRINTS.clientName, FIELD_BLUEPRINTS.clientAddress]),
    section("invoice", "Invoice", [
      { id: "invoiceNumber", label: "Invoice Number", type: "text", required: true },
      { id: "invoiceDate", label: "Invoice Date", type: "date", required: true },
      FIELD_BLUEPRINTS.dueDate,
      FIELD_BLUEPRINTS.lineItems,
      FIELD_BLUEPRINTS.total,
      FIELD_BLUEPRINTS.notes,
    ]),
  ],

  "employment-offer-letter": [
    section("employer", "Employer", [
      FIELD_BLUEPRINTS.businessName,
      FIELD_BLUEPRINTS.businessAddress,
      { id: "hrContact", label: "HR Contact", type: "text" },
    ]),
    section("candidate", "Candidate", [
      { id: "candidateName", label: "Candidate Name", type: "text", required: true },
      { id: "candidateAddress", label: "Candidate Address", type: "address" },
    ]),
    section("offer", "Offer Details", [
      { id: "offerDate", label: "Offer Date", type: "date", required: true },
      { id: "jobTitle", label: "Job Title", type: "text", required: true },
      { id: "startDate", label: "Start Date", type: "date", required: true },
      { id: "salary", label: "Salary / Compensation", type: "text", required: true },
      { id: "employmentType", label: "Employment Type", type: "select", options: ["Full-time", "Part-time", "Temporary"], required: true },
      { id: "reportingTo", label: "Reports To", type: "text" },
      { id: "benefits", label: "Benefits Summary", type: "textarea" },
      { id: "atWill", label: "At-Will Employment Acknowledgment", type: "textarea", required: true },
      { id: "contingencies", label: "Contingencies", type: "textarea", helpText: "Background check, I-9, etc." },
    ]),
    section("acceptance", "Signatures", [
      FIELD_BLUEPRINTS.signature,
      { id: "candidateSignature", label: "Candidate Signature", type: "signature", required: true },
      FIELD_BLUEPRINTS.signatureDate,
    ], "Review with employment counsel before sending"),
  ],

  "independent-contractor-agreement": [
    section("company", "Company", [FIELD_BLUEPRINTS.businessName, FIELD_BLUEPRINTS.businessAddress, FIELD_BLUEPRINTS.taxId]),
    section("contractor", "Contractor", [
      { id: "contractorName", label: "Contractor Name", type: "text", required: true },
      { id: "contractorAddress", label: "Contractor Address", type: "address", required: true },
      { id: "contractorTaxId", label: "Contractor Tax ID / SSN", type: "text" },
    ]),
    section("scope", "Scope & Compensation", [
      { id: "effectiveDate", label: "Effective Date", type: "date", required: true },
      { id: "services", label: "Services Description", type: "textarea", required: true },
      { id: "compensation", label: "Compensation", type: "textarea", required: true },
      { id: "paymentSchedule", label: "Payment Schedule", type: "text", required: true },
      { id: "termEnd", label: "Term / End Date", type: "date" },
    ]),
    section("terms", "Legal Terms", [
      { id: "independentStatus", label: "Independent Contractor Status", type: "textarea", required: true },
      { id: "ipOwnership", label: "Intellectual Property", type: "textarea", required: true },
      { id: "confidentiality", label: "Confidentiality", type: "textarea", required: true },
      { id: "indemnification", label: "Indemnification", type: "textarea" },
    ]),
    section("signatures", "Signatures", [
      FIELD_BLUEPRINTS.signature,
      { id: "contractorSignature", label: "Contractor Signature", type: "signature", required: true },
      FIELD_BLUEPRINTS.signatureDate,
    ], "1099 contractor — not an employee"),
  ],

  "volunteer-agreement": [
    section("organization", "Organization", [
      FIELD_BLUEPRINTS.logo,
      FIELD_BLUEPRINTS.businessName,
      FIELD_BLUEPRINTS.businessEmail,
      FIELD_BLUEPRINTS.businessPhone,
    ]),
    section("volunteer", "Volunteer", [
      FIELD_BLUEPRINTS.personName,
      FIELD_BLUEPRINTS.personEmail,
      FIELD_BLUEPRINTS.personPhone,
      { id: "emergencyContact", label: "Emergency Contact", type: "text", required: true },
    ]),
    section("assignment", "Volunteer Assignment", [
      { id: "startDate", label: "Start Date", type: "date", required: true },
      { id: "role", label: "Volunteer Role", type: "text", required: true },
      { id: "schedule", label: "Expected Schedule", type: "textarea" },
      { id: "supervisor", label: "Supervisor", type: "text", required: true },
    ]),
    section("terms", "Terms", [
      { id: "liabilityWaiver", label: "Liability Waiver", type: "textarea", required: true },
      { id: "codeOfConduct", label: "Code of Conduct", type: "textarea" },
    ]),
    section("signatures", "Signatures", [
      FIELD_BLUEPRINTS.signature,
      { id: "volunteerSignature", label: "Volunteer Signature", type: "signature", required: true },
      FIELD_BLUEPRINTS.signatureDate,
    ]),
  ],

  "membership-application": [
    section("organization", "Organization", [FIELD_BLUEPRINTS.businessName, FIELD_BLUEPRINTS.businessAddress]),
    section("applicant", "Applicant", [
      FIELD_BLUEPRINTS.personName,
      FIELD_BLUEPRINTS.personEmail,
      FIELD_BLUEPRINTS.personPhone,
      FIELD_BLUEPRINTS.personAddress,
    ]),
    section("membership", "Membership Details", [
      { id: "membershipTier", label: "Membership Tier", type: "select", options: ["Individual", "Family", "Business", "Lifetime"], required: true },
      { id: "dues", label: "Annual Dues", type: "currency", required: true },
      { id: "startDate", label: "Membership Start Date", type: "date", required: true },
      { id: "referral", label: "Referred By", type: "text" },
    ]),
    section("emergency", "Emergency Contact", [
      { id: "emergencyName", label: "Emergency Contact Name", type: "text", required: true },
      { id: "emergencyPhone", label: "Emergency Contact Phone", type: "phone", required: true },
    ]),
  ],

  "grant-application": [
    section("organization", "Applicant Organization", [
      FIELD_BLUEPRINTS.businessName,
      FIELD_BLUEPRINTS.businessAddress,
      FIELD_BLUEPRINTS.taxId,
      { id: "orgMission", label: "Mission Statement", type: "textarea", required: true },
    ]),
    section("grant", "Grant Request", [
      { id: "grantNumber", label: "Application Reference #", type: "text" },
      { id: "projectTitle", label: "Project Title", type: "text", required: true },
      { id: "amountRequested", label: "Amount Requested", type: "currency", required: true },
      { id: "projectSummary", label: "Project Summary", type: "textarea", required: true },
      { id: "objectives", label: "Objectives & Outcomes", type: "textarea", required: true },
      { id: "budget", label: "Budget Breakdown", type: "table", required: true, tableColumns: TABLE_COLUMNS.budgetBreakdown },
      { id: "timeline", label: "Project Timeline", type: "textarea", required: true },
    ]),
    section("contact", "Authorized Signer", [
      { id: "contactName", label: "Contact Name", type: "text", required: true },
      FIELD_BLUEPRINTS.businessEmail,
    ]),
    section("signatures", "Signatures", [
      FIELD_BLUEPRINTS.signature,
      FIELD_BLUEPRINTS.signatureDate,
    ]),
  ],

  "meeting-minutes": [
    section("meeting", "Meeting Info", [
      { id: "organizationName", label: "Organization", type: "text", required: true, defaultFromProfile: "business.name" },
      { id: "meetingDate", label: "Meeting Date", type: "date", required: true },
      { id: "meetingTime", label: "Meeting Time", type: "text" },
      { id: "location", label: "Location / Virtual Link", type: "text" },
      { id: "facilitator", label: "Facilitator / Chair", type: "text", required: true },
      { id: "attendees", label: "Attendees", type: "textarea", required: true },
      { id: "quorum", label: "Quorum Met", type: "checkbox" },
    ]),
    section("minutes", "Minutes", [
      { id: "agenda", label: "Agenda Items", type: "textarea", required: true },
      { id: "discussion", label: "Discussion Summary", type: "textarea", required: true },
      { id: "decisions", label: "Decisions & Resolutions", type: "textarea", required: true },
      { id: "actionItems", label: "Action Items", type: "table", tableColumns: TABLE_COLUMNS.actionItems },
      { id: "nextMeeting", label: "Next Meeting Date", type: "date" },
    ]),
    section("approval", "Signatures", [
      { id: "secretary", label: "Recorded By", type: "text", required: true },
      FIELD_BLUEPRINTS.signature,
      FIELD_BLUEPRINTS.signatureDate,
    ]),
  ],

  "accounts-payable-voucher": [
    section("company", "Company", [FIELD_BLUEPRINTS.businessName, FIELD_BLUEPRINTS.taxId]),
    section("vendor", "Vendor", [
      { id: "vendorName", label: "Vendor Name", type: "text", required: true },
      { id: "vendorInvoiceNumber", label: "Vendor Invoice #", type: "text", required: true },
    ]),
    section("voucher", "AP Voucher", [
      { id: "voucherNumber", label: "Voucher Number", type: "text", required: true },
      { id: "voucherDate", label: "Voucher Date", type: "date", required: true },
      { id: "glAccount", label: "GL Account Code", type: "text", required: true },
      { id: "department", label: "Department / Cost Center", type: "text" },
      { id: "amount", label: "Amount", type: "currency", required: true },
      { id: "description", label: "Description", type: "textarea", required: true },
      { id: "approver", label: "Approved By", type: "text", required: true },
    ]),
  ],

  "journal-entry": [
    section("company", "Company", [FIELD_BLUEPRINTS.businessName]),
    section("entry", "Journal Entry", [
      { id: "entryNumber", label: "Entry Number", type: "text", required: true },
      { id: "entryDate", label: "Entry Date", type: "date", required: true },
      { id: "description", label: "Description", type: "textarea", required: true },
      { id: "journalLines", label: "Debit / Credit Lines", type: "table", required: true, tableColumns: TABLE_COLUMNS.journalLines },
      { id: "preparedBy", label: "Prepared By", type: "text", required: true },
      { id: "reviewedBy", label: "Reviewed By", type: "text" },
    ], "Double-entry — debits must equal credits"),
  ],

  "w9-request": [
    section("requester", "Requester", [FIELD_BLUEPRINTS.businessName, FIELD_BLUEPRINTS.businessAddress, FIELD_BLUEPRINTS.taxId]),
    section("payee", "Payee Information", [
      { id: "payeeName", label: "Name (as shown on tax return)", type: "text", required: true },
      { id: "businessName", label: "Business Name / DBA", type: "text" },
      { id: "taxClassification", label: "Federal Tax Classification", type: "select", options: ["Individual/Sole proprietor", "C Corporation", "S Corporation", "Partnership", "LLC", "Other"], required: true },
      { id: "payeeAddress", label: "Address", type: "address", required: true },
      { id: "taxId", label: "Taxpayer Identification Number (TIN)", type: "text", required: true },
      { id: "certification", label: "Certification", type: "textarea", required: true, helpText: "Under penalties of perjury certification per IRS Form W-9" },
    ], "IRS Form W-9 equivalent — handle TIN securely"),
    section("signatures", "Signatures", [
      FIELD_BLUEPRINTS.signature,
      FIELD_BLUEPRINTS.signatureDate,
    ]),
  ],

  "privacy-policy": [
    section("company", "Data Controller", [
      FIELD_BLUEPRINTS.businessName,
      FIELD_BLUEPRINTS.businessAddress,
      FIELD_BLUEPRINTS.businessEmail,
      { id: "effectiveDate", label: "Effective Date", type: "date", required: true },
    ]),
    section("policy", "Privacy Policy", [
      { id: "dataCollected", label: "Data We Collect", type: "textarea", required: true },
      { id: "purposes", label: "How We Use Data", type: "textarea", required: true },
      { id: "sharing", label: "Data Sharing & Processors", type: "textarea", required: true },
      { id: "retention", label: "Data Retention", type: "textarea", required: true },
      { id: "userRights", label: "Your Rights (access, delete, opt-out)", type: "textarea", required: true },
      { id: "contact", label: "Privacy Contact", type: "text", required: true },
    ], "GDPR / CCPA — legal review recommended"),
  ],

  "personal-loan-agreement": [
    section("lender", "Lender", [
      { id: "lenderName", label: "Lender Name", type: "text", required: true },
      { id: "lenderAddress", label: "Lender Address", type: "address" },
    ]),
    section("borrower", "Borrower", [
      FIELD_BLUEPRINTS.personName,
      FIELD_BLUEPRINTS.personAddress,
      FIELD_BLUEPRINTS.personEmail,
    ]),
    section("loan", "Loan Terms", [
      { id: "loanDate", label: "Loan Date", type: "date", required: true },
      { id: "principal", label: "Principal Amount", type: "currency", required: true },
      { id: "interestRate", label: "Interest Rate (%)", type: "number", required: true },
      { id: "repaymentSchedule", label: "Repayment Schedule", type: "textarea", required: true },
      { id: "lateFees", label: "Late Payment Terms", type: "textarea" },
      { id: "defaultTerms", label: "Default Provisions", type: "textarea" },
    ]),
    section("signatures", "Signatures", [
      LENDER_SIGNATURE,
      { id: "borrowerSignature", label: "Borrower Signature", type: "signature", required: true },
      FIELD_BLUEPRINTS.signatureDate,
    ]),
  ],

  "commercial-lease": [
    section("landlord", "Landlord", [FIELD_BLUEPRINTS.businessName, FIELD_BLUEPRINTS.businessAddress, FIELD_BLUEPRINTS.businessPhone]),
    section("tenant", "Tenant", [
      { id: "tenantName", label: "Tenant / Business Name", type: "text", required: true },
      { id: "tenantAddress", label: "Tenant Address", type: "address" },
    ]),
    section("premises", "Premises", [
      { id: "propertyAddress", label: "Property Address", type: "address", required: true },
      { id: "squareFootage", label: "Square Footage", type: "text" },
      { id: "permittedUse", label: "Permitted Use", type: "textarea", required: true },
    ]),
    section("terms", "Lease Terms", [
      { id: "leaseStart", label: "Commencement Date", type: "date", required: true },
      { id: "leaseTerm", label: "Lease Term", type: "text", required: true },
      { id: "baseRent", label: "Base Rent (monthly)", type: "currency", required: true },
      { id: "camCharges", label: "CAM / Operating Expenses", type: "textarea" },
      { id: "securityDeposit", label: "Security Deposit", type: "currency", required: true },
      { id: "renewalOptions", label: "Renewal Options", type: "textarea" },
    ]),
    section("signatures", "Signatures", [
      LANDLORD_SIGNATURE,
      { id: "tenantSignature", label: "Tenant Signature", type: "signature", required: true },
      FIELD_BLUEPRINTS.signatureDate,
    ]),
  ],

  "medical-history-form": [
    section("patient", "Patient", [
      FIELD_BLUEPRINTS.personName,
      { id: "dateOfBirth", label: "Date of Birth", type: "date", required: true },
      FIELD_BLUEPRINTS.personPhone,
      FIELD_BLUEPRINTS.personEmail,
    ]),
    section("history", "Medical History", [
      { id: "allergies", label: "Allergies", type: "textarea", required: true },
      { id: "medications", label: "Current Medications", type: "textarea", required: true },
      { id: "conditions", label: "Medical Conditions", type: "textarea", required: true },
      { id: "surgeries", label: "Past Surgeries", type: "textarea" },
      { id: "familyHistory", label: "Family Medical History", type: "textarea" },
    ]),
    section("consent", "Consent & Signatures", [
      { id: "hipaaNotice", label: "HIPAA Privacy Notice Acknowledgment", type: "textarea", required: true },
      FIELD_BLUEPRINTS.signature,
      FIELD_BLUEPRINTS.signatureDate,
    ], "PHI — store securely and scan before sharing"),
  ],
};
