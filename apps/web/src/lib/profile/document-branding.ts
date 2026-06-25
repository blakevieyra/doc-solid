import type { UserProfile } from "./types";
import { formatAddress, parseAddressString } from "./types";
import { buildOwnerSignatureValue } from "./signature";
import { resolveProfileIdentity } from "./profile-identity";

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

/** Branding keys frozen to the sender snapshot when a recipient signs or views a share */
export const SNAPSHOT_BRANDING_KEYS = [
  "logo",
  "businessName",
  "businessEmail",
  "businessPhone",
  "businessWebsite",
  "businessAddress",
  "personName",
  "personTitle",
  "personPhone",
  "personEmail",
  "orgMission",
  "providerName",
  "providerAddress",
  "disclosingParty",
] as const;

/** Apply recipient edits without overwriting sender letterhead/branding fields */
export function mergeShareFieldUpdates(
  base: Record<string, string>,
  updates: Record<string, string>,
): Record<string, string> {
  const merged = { ...base, ...updates };
  for (const key of SNAPSHOT_BRANDING_KEYS) {
    if (base[key]?.trim()) merged[key] = base[key];
  }
  return merged;
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
  const identity = resolveProfileIdentity(profile);

  const logo =
    values.logo?.trim() ||
    identity.logo ||
    null;

  const companyName =
    values.businessName?.trim() ||
    identity.name ||
    profile.account.displayName ||
    "Your Company";

  const tagline =
    values.orgMission?.trim() ||
    identity.tagline ||
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
  values: Record<string, string>,
  options?: { valuesOnly?: boolean },
): DocumentLetterhead {
  if (options?.valuesOnly) {
    return {
      logo: values.logo?.trim() || null,
      companyName: values.businessName?.trim() || "",
      tagline: values.orgMission?.trim() || "",
      address: values.businessAddress?.trim() || "",
      phone: values.businessPhone?.trim() || "",
      email: values.businessEmail?.trim() || "",
      website: values.businessWebsite?.trim() || "",
      pocName: values.personName?.trim() || "",
      pocTitle: values.personTitle?.trim() || "",
      pocPhone: values.personPhone?.trim() || "",
      pocEmail: values.personEmail?.trim() || "",
    };
  }

  const branding = resolveDocumentBranding(profile, values);
  const identity = resolveProfileIdentity(profile);

  const address =
    values.businessAddress?.trim() ||
    identity.address ||
    formatAddress(profile.personal.address);

  const phone =
    values.businessPhone?.trim() ||
    identity.phone;

  const email =
    values.businessEmail?.trim() ||
    identity.email ||
    profile.account.email;

  const website =
    values.businessWebsite?.trim() ||
    identity.website;

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
  values: Record<string, string>,
  options?: { freezeLetterhead?: boolean },
): Record<string, string> {
  const next = { ...values };

  if (options?.freezeLetterhead) {
    const letterhead = resolveDocumentLetterhead(profile, values);
    const identity = resolveProfileIdentity(profile);

    if (letterhead.logo) next.logo = letterhead.logo;
    if (letterhead.companyName) next.businessName = letterhead.companyName;
    if (letterhead.tagline) next.orgMission = letterhead.tagline;
    if (letterhead.address) next.businessAddress = letterhead.address;
    if (letterhead.phone) next.businessPhone = letterhead.phone;
    if (letterhead.email) next.businessEmail = letterhead.email;
    if (letterhead.website) next.businessWebsite = letterhead.website;
    if (letterhead.pocName) next.personName = letterhead.pocName;
    if (letterhead.pocTitle) next.personTitle = letterhead.pocTitle;
    if (letterhead.pocPhone) next.personPhone = letterhead.pocPhone;
    if (letterhead.pocEmail) next.personEmail = letterhead.pocEmail;
    if (identity.name) {
      if (!next.providerName?.trim()) next.providerName = identity.name;
      if (!next.disclosingParty?.trim()) next.disclosingParty = identity.name;
      if (!next.providerAddress?.trim()) next.providerAddress = letterhead.address;
    }
    return next;
  }

  const identity = resolveProfileIdentity(profile);

  if (!next.logo?.trim() && identity.logo) {
    next.logo = identity.logo;
  }
  if (!next.businessName?.trim() && identity.name) {
    next.businessName = identity.name;
  }
  if (!next.businessEmail?.trim() && identity.email) {
    next.businessEmail = identity.email;
  }
  if (!next.businessPhone?.trim() && identity.phone) {
    next.businessPhone = identity.phone;
  }
  if (!next.businessWebsite?.trim() && identity.website) {
    next.businessWebsite = identity.website;
  }
  if (!next.businessAddress?.trim() && identity.address) {
    next.businessAddress = identity.address;
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
  const identity = resolveProfileIdentity(profile);

  return {
    businessName: identity.name,
    logo: identity.logo ?? "",
    businessAddress: identity.address,
    businessPhone: identity.phone,
    businessEmail: identity.email,
    businessWebsite: identity.website,
    taxId: profile.security.encryptSensitive ? "" : identity.taxId,
    personName: profile.personal.fullName,
    personTitle: profile.personal.title,
    personAddress: formatAddress(profile.personal.address),
    personEmail: profile.personal.email,
    personPhone: profile.personal.phone,
    providerName: identity.name,
    providerAddress: identity.address,
    disclosingParty: identity.name,
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
