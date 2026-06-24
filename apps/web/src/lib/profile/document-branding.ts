import type { UserProfile } from "./types";
import { formatAddress, parseAddressString } from "./types";
import { buildOwnerSignatureValue } from "./signature";

/** Org profile shared with team members via roster API */
export interface TeamSharedProfile {
  orgName: string;
  business: {
    name: string;
    tagline: string;
    phone: string;
    email: string;
    logo: string | null;
    address: string;
  };
  organization: {
    name: string;
    mission: string;
    phone: string;
    email: string;
    logo: string | null;
    address: string;
  };
}

export function resolveDocumentProfile(
  profile: UserProfile,
  shared: TeamSharedProfile | null | undefined
): UserProfile {
  if (!shared || profile.team.myRole === "owner") return profile;
  const useBusiness = profile.team.shareBusinessProfile !== false;
  const useOrg = profile.team.shareOrganizationProfile !== false;
  if (!useBusiness && !useOrg) return profile;

  return {
    ...profile,
    team: {
      ...profile.team,
      orgName: shared.orgName || profile.team.orgName,
    },
    business: useBusiness
      ? {
          ...profile.business,
          name: shared.business.name || profile.business.name,
          tagline: shared.business.tagline || profile.business.tagline,
          phone: shared.business.phone || profile.business.phone,
          email: shared.business.email || profile.business.email,
          logo: shared.business.logo ?? profile.business.logo,
          address: shared.business.address
            ? parseAddressString(shared.business.address)
            : profile.business.address,
        }
      : profile.business,
    organization: useOrg
      ? {
          ...profile.organization,
          name: shared.organization.name || profile.organization.name,
          mission: shared.organization.mission || profile.organization.mission,
          phone: shared.organization.phone || profile.organization.phone,
          email: shared.organization.email || profile.organization.email,
          logo: shared.organization.logo ?? profile.organization.logo,
          address: shared.organization.address
            ? parseAddressString(shared.organization.address)
            : profile.organization.address,
        }
      : profile.organization,
  };
}

/** Header branding — document field values win over the viewer's profile */
export function resolveDocumentBranding(
  profile: UserProfile,
  values: Record<string, string>
): {
  logo: string | null;
  companyName: string;
  tagline: string;
} {
  const logo =
    values.logo?.trim() ||
    profile.business.logo ||
    profile.organization.logo ||
    null;

  const companyName =
    values.businessName?.trim() ||
    profile.business.name ||
    profile.organization.name ||
    profile.team.orgName ||
    "Your Company";

  const tagline =
    values.orgMission?.trim() ||
    profile.business.tagline ||
    profile.organization.mission ||
    "";

  return { logo, companyName, tagline };
}

/** Persist org branding into saved documents so recipients see the sender's identity */
export function snapshotBrandingIntoValues(
  profile: UserProfile,
  values: Record<string, string>
): Record<string, string> {
  const next = { ...values };

  if (!next.logo?.trim()) {
    const logo = profile.business.logo ?? profile.organization.logo;
    if (logo) next.logo = logo;
  }
  if (!next.businessName?.trim() && profile.business.name) {
    next.businessName = profile.business.name;
  }
  if (!next.businessEmail?.trim() && profile.business.email) {
    next.businessEmail = profile.business.email;
  }
  if (!next.businessPhone?.trim() && profile.business.phone) {
    next.businessPhone = profile.business.phone;
  }
  if (!next.businessAddress?.trim()) {
    const addr = formatAddress(profile.business.address);
    if (addr) next.businessAddress = addr;
  }
  if (!next.orgMission?.trim() && profile.organization.mission) {
    next.orgMission = profile.organization.mission;
  }

  return next;
}

export function buildDocumentAutofill(profile: UserProfile): Record<string, string> {
  const today = new Date().toISOString().split("T")[0];
  return {
    businessName: profile.business.name,
    logo: profile.business.logo ?? profile.organization.logo ?? "",
    businessAddress: formatAddress(profile.business.address),
    businessPhone: profile.business.phone,
    businessEmail: profile.business.email,
    taxId: profile.security.encryptSensitive ? "" : profile.business.taxId,
    personName: profile.personal.fullName,
    personAddress: formatAddress(profile.personal.address),
    personEmail: profile.personal.email,
    personPhone: profile.personal.phone,
    providerName: profile.business.name,
    providerAddress: formatAddress(profile.business.address),
    disclosingParty: profile.business.name,
    orgMission: profile.organization.mission,
    documentDate: today,
    invoiceDate: today,
    signatureDate: today,
    donationDate: today,
    effectiveDate: today,
    linkedin: profile.personal.linkedin,
    paymentTerms: profile.preferences.defaultPaymentTerms,
    signature: buildOwnerSignatureValue(profile),
    sellerSignature: buildOwnerSignatureValue(profile),
  };
}
