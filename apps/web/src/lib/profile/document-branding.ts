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
    profile.personal.fullName ||
    profile.team.orgName ||
    profile.account.displayName ||
    "Your Company";

  const tagline =
    values.orgMission?.trim() ||
    profile.business.tagline ||
    profile.organization.mission ||
    "";

  return { logo, companyName, tagline };
}

export interface DocumentLetterhead {
  logo: string | null;
  companyName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  pocName: string;
  pocTitle: string;
  pocPhone: string;
  pocEmail: string;
}

/** Full business letterhead for document headers — legal-style name, address, and POC */
export function resolveDocumentLetterhead(
  profile: UserProfile,
  values: Record<string, string>
): DocumentLetterhead {
  const branding = resolveDocumentBranding(profile, values);

  const address =
    values.businessAddress?.trim() ||
    formatAddress(profile.business.address) ||
    formatAddress(profile.organization.address) ||
    formatAddress(profile.personal.address);

  const phone =
    values.businessPhone?.trim() ||
    profile.business.phone ||
    profile.organization.phone ||
    profile.personal.phone;

  const email =
    values.businessEmail?.trim() ||
    profile.business.email ||
    profile.organization.email ||
    profile.personal.email ||
    profile.account.email;

  const website =
    values.businessWebsite?.trim() ||
    profile.business.website ||
    profile.organization.website;

  const pocName =
    values.personName?.trim() ||
    profile.personal.fullName ||
    profile.account.displayName;

  const pocTitle = values.personTitle?.trim() || profile.personal.title;

  const pocPhone =
    values.personPhone?.trim() ||
    profile.personal.phone ||
    phone;

  const pocEmail =
    values.personEmail?.trim() ||
    profile.personal.email ||
    email;

  return {
    ...branding,
    address,
    phone,
    email,
    website,
    pocName,
    pocTitle,
    pocPhone,
    pocEmail,
  };
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
  if (!next.businessName?.trim()) {
    const name =
      profile.business.name ||
      profile.organization.name ||
      profile.personal.fullName ||
      profile.team.orgName;
    if (name) next.businessName = name;
  }
  if (!next.businessEmail?.trim()) {
    const email =
      profile.business.email ||
      profile.organization.email ||
      profile.personal.email;
    if (email) next.businessEmail = email;
  }
  if (!next.businessPhone?.trim()) {
    const phone =
      profile.business.phone ||
      profile.organization.phone ||
      profile.personal.phone;
    if (phone) next.businessPhone = phone;
  }
  if (!next.businessWebsite?.trim() && profile.business.website) {
    next.businessWebsite = profile.business.website;
  }
  if (!next.businessAddress?.trim()) {
    const addr =
      formatAddress(profile.business.address) ||
      formatAddress(profile.organization.address) ||
      formatAddress(profile.personal.address);
    if (addr) next.businessAddress = addr;
  }
  if (!next.personName?.trim() && profile.personal.fullName) {
    next.personName = profile.personal.fullName;
  }
  if (!next.personTitle?.trim() && profile.personal.title) {
    next.personTitle = profile.personal.title;
  }
  if (!next.personPhone?.trim() && profile.personal.phone) {
    next.personPhone = profile.personal.phone;
  }
  if (!next.personEmail?.trim() && profile.personal.email) {
    next.personEmail = profile.personal.email;
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
    businessWebsite: profile.business.website || profile.organization.website,
    taxId: profile.security.encryptSensitive ? "" : profile.business.taxId,
    personName: profile.personal.fullName,
    personTitle: profile.personal.title,
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
