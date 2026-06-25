import type { ProfileType, UserProfile } from "./types";
import { formatAddress } from "./types";

export type ProfileIdentityContext = "business" | "organization" | "individual";

export function resolveProfileIdentityContext(profileType: ProfileType): ProfileIdentityContext {
  if (profileType === "organization") return "organization";
  if (profileType === "individual") return "individual";
  return "business";
}

/** Primary name, logo, and contact block for the user's selected profile type */
export function resolveProfileIdentity(profile: UserProfile) {
  const context = resolveProfileIdentityContext(profile.profileType);

  if (context === "organization") {
    return {
      context,
      name: profile.organization.name || profile.business.name || profile.team.orgName,
      logo: profile.organization.logo ?? profile.business.logo ?? profile.personal.photo,
      tagline: profile.organization.mission || profile.business.tagline,
      email: profile.organization.email || profile.business.email || profile.personal.email,
      phone: profile.organization.phone || profile.business.phone || profile.personal.phone,
      website: profile.organization.website || profile.business.website,
      address: formatAddress(profile.organization.address) || formatAddress(profile.business.address),
      taxId: profile.organization.taxId || profile.business.taxId,
    };
  }

  if (context === "individual") {
    return {
      context,
      name:
        profile.personal.fullName ||
        profile.account.displayName ||
        profile.business.name,
      logo: profile.personal.photo ?? profile.business.logo ?? profile.organization.logo,
      tagline: profile.personal.title || profile.business.tagline,
      email: profile.personal.email || profile.account.email || profile.business.email,
      phone: profile.personal.phone || profile.business.phone,
      website: profile.business.website || profile.organization.website,
      address:
        formatAddress(profile.personal.address) ||
        formatAddress(profile.business.address),
      taxId: profile.business.taxId,
    };
  }

  return {
    context,
    name:
      profile.business.name ||
      profile.organization.name ||
      profile.personal.fullName ||
      profile.team.orgName,
    logo: profile.business.logo ?? profile.organization.logo ?? profile.personal.photo,
    tagline: profile.business.tagline || profile.organization.mission,
    email: profile.business.email || profile.organization.email || profile.personal.email,
    phone: profile.business.phone || profile.organization.phone || profile.personal.phone,
    website: profile.business.website || profile.organization.website,
    address:
      formatAddress(profile.business.address) ||
      formatAddress(profile.organization.address),
    taxId: profile.business.taxId || profile.organization.taxId,
  };
}

export function profileSettingsHint(profileType: ProfileType): string {
  if (profileType === "individual") {
    return "Tailored to your personal profile. Update details in Profile → Personal.";
  }
  if (profileType === "organization") {
    return "Tailored to your organization. Update details in Profile → Organization.";
  }
  return "Tailored to your business profile. Update industry in Profile → Business.";
}
