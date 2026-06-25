import type { ProfileType } from "@/lib/profile/types";
import { getDocumentById } from "@doc-solid/documents";

export interface IndustryOption {
  id: string;
  label: string;
  description: string;
}

export const INDUSTRY_OPTIONS: IndustryOption[] = [
  { id: "construction", label: "Construction & Trades", description: "Contractors, builders, HVAC, plumbing" },
  { id: "retail", label: "Retail & E-commerce", description: "Stores, online shops, wholesale" },
  { id: "professional-services", label: "Professional Services", description: "Consulting, agencies, legal, accounting" },
  { id: "healthcare", label: "Healthcare & Wellness", description: "Clinics, dental, therapy, home health" },
  { id: "hospitality", label: "Restaurant & Hospitality", description: "Restaurants, hotels, catering, events" },
  { id: "real-estate", label: "Real Estate", description: "Agents, property management, leasing" },
  { id: "technology", label: "Technology & SaaS", description: "Software, IT services, startups" },
  { id: "manufacturing", label: "Manufacturing & Logistics", description: "Production, warehousing, shipping" },
  { id: "nonprofit", label: "Nonprofit & Community", description: "Charities, churches, associations" },
  { id: "education", label: "Education & Training", description: "Schools, tutors, training providers" },
  { id: "freelance", label: "Freelance & Creative", description: "Designers, writers, photographers" },
  { id: "general", label: "General Business", description: "Other industries and mixed operations" },
];

const INDUSTRY_DOCUMENTS: Record<string, string[]> = {
  construction: [
    "quote-estimate", "invoice", "work-order", "change-order", "subcontractor-agreement",
    "scope-of-work", "safety-inspection-checklist", "incident-report", "delivery-receipt",
  ],
  retail: [
    "invoice", "receipt", "sales-order", "purchase-order", "return-authorization",
    "inventory-sheet", "customer-credit-application", "packing-slip", "payment-reminder",
  ],
  "professional-services": [
    "proposal", "quote-estimate", "invoice", "service-agreement", "nda",
    "client-intake-form", "timesheet", "scope-of-work", "independent-contractor-agreement",
  ],
  healthcare: [
    "hipaa-baa", "service-agreement", "nda", "client-intake-form", "incident-report",
    "employee-onboarding-checklist", "timesheet", "privacy-policy",
  ],
  hospitality: [
    "invoice", "purchase-order", "employment-offer-letter", "timesheet",
    "safety-inspection-checklist", "vendor-registration-form", "expense-report",
  ],
  "real-estate": [
    "commercial-lease", "residential-lease", "rental-application", "scope-of-work",
    "invoice", "service-agreement", "client-intake-form",
  ],
  technology: [
    "nda", "service-agreement", "proposal", "invoice", "independent-contractor-agreement",
    "terms-of-service", "privacy-policy", "client-intake-form",
  ],
  manufacturing: [
    "purchase-order", "work-order", "quality-control-checklist", "delivery-receipt",
    "inventory-sheet", "invoice", "packing-slip", "vendor-registration-form",
  ],
  nonprofit: [
    "donation-receipt", "grant-application", "volunteer-agreement", "fundraising-letter",
    "membership-application", "annual-report", "volunteer-hours-log", "program-budget",
  ],
  education: [
    "permission-slip", "meeting-minutes", "incident-report", "employment-offer-letter",
    "client-intake-form", "volunteer-agreement",
  ],
  freelance: [
    "freelance-invoice", "quote-estimate", "proposal", "nda",
    "independent-contractor-agreement", "service-agreement", "timesheet",
  ],
  general: [
    "invoice", "quote-estimate", "receipt", "nda", "service-agreement",
    "expense-report", "proposal", "client-intake-form",
  ],
};

const PROFILE_TYPE_DOCUMENTS: Record<ProfileType, string[]> = {
  business: ["invoice", "quote-estimate", "nda", "service-agreement", "expense-report"],
  individual: ["resume", "cover-letter", "freelance-invoice", "personal-budget", "rental-application"],
  organization: ["donation-receipt", "membership-application", "volunteer-agreement", "meeting-minutes", "grant-application"],
  mixed: ["invoice", "quote-estimate", "receipt", "nda", "service-agreement", "expense-report"],
};

/** Personal/career docs that should not appear in business or org recommendations */
const INDIVIDUAL_ONLY_RECOMMENDATIONS = new Set([
  "resume",
  "cover-letter",
  "personal-budget",
  "resignation-letter",
  "personal-loan-agreement",
]);

function isRecommendationAppropriate(
  docId: string,
  profileType: ProfileType,
  industryKey: string | null
): boolean {
  const doc = getDocumentById(docId);
  if (!doc) return false;

  if (profileType === "individual") {
    return doc.domain === "individual" || doc.domain === "business";
  }

  if (profileType === "organization") {
    if (INDIVIDUAL_ONLY_RECOMMENDATIONS.has(docId)) return false;
    return doc.domain === "organization" || doc.domain === "business";
  }

  // business or mixed
  if (INDIVIDUAL_ONLY_RECOMMENDATIONS.has(docId)) return false;
  if (doc.domain === "individual" && industryKey !== "freelance") return false;
  return true;
}

export interface RecommendedDocument {
  id: string;
  name: string;
  description: string;
  domain: string;
  category: string;
}

export function getIndustryLabel(industryId: string): string {
  return INDUSTRY_OPTIONS.find((o) => o.id === industryId)?.label ?? industryId;
}

export function resolveIndustryKey(industry: string, profileType: ProfileType): string {
  const normalized = industry.toLowerCase().trim();
  const match = INDUSTRY_OPTIONS.find(
    (o) => o.id === normalized || o.label.toLowerCase() === normalized
  );
  if (match) return match.id;
  if (profileType === "organization") return "nonprofit";
  if (profileType === "individual") return "freelance";
  return "general";
}

export function getRecommendedDocumentIds(
  profileType: ProfileType,
  industry?: string
): string[] {
  const industryKey = industry ? resolveIndustryKey(industry, profileType) : null;
  const fromIndustry = industryKey ? INDUSTRY_DOCUMENTS[industryKey] ?? [] : [];
  const fromProfile = PROFILE_TYPE_DOCUMENTS[profileType] ?? PROFILE_TYPE_DOCUMENTS.business;

  const merged = [...fromIndustry, ...fromProfile];
  const seen = new Set<string>();
  return merged.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    if (getDocumentById(id) == null) return false;
    return isRecommendationAppropriate(id, profileType, industryKey);
  }).slice(0, 8);
}

export function getRecommendedDocuments(
  profileType: ProfileType,
  industry?: string
): RecommendedDocument[] {
  const results: RecommendedDocument[] = [];
  for (const id of getRecommendedDocumentIds(profileType, industry)) {
    const doc = getDocumentById(id);
    if (!doc) continue;
    results.push({
      id: doc.id,
      name: doc.name,
      description: doc.description,
      domain: doc.domain,
      category: doc.category,
    });
  }
  return results;
}

export function getRecommendationHeading(
  profileType: ProfileType,
  industry?: string
): string {
  if (industry) {
    return `Popular for ${getIndustryLabel(resolveIndustryKey(industry, profileType))}`;
  }
  if (profileType === "individual") return "Recommended for you";
  if (profileType === "organization") return "Recommended for your organization";
  return "Recommended for your business";
}

export function resolveRecommendationIndustry(profile: {
  profileType: ProfileType;
  business: { industry?: string };
}): string | undefined {
  if (profile.profileType === "organization") {
    return profile.business.industry || "nonprofit";
  }
  if (profile.profileType === "individual") {
    return profile.business.industry || "freelance";
  }
  return profile.business.industry || undefined;
}
