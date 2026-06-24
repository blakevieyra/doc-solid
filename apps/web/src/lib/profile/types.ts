export type ProfileType = "business" | "individual" | "organization" | "mixed";

export type SubscriptionPlan = "free" | "monthly" | "yearly";
export type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "pending" | "none";

export type TeamRole = "owner" | "admin" | "editor" | "viewer";

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface BusinessProfile {
  name: string;
  tagline: string;
  address: Address;
  phone: string;
  email: string;
  website: string;
  taxId: string;
  logo: string | null;
  industry: string;
}

export interface PersonalProfile {
  fullName: string;
  title: string;
  address: Address;
  phone: string;
  email: string;
  linkedin: string;
}

export interface OrganizationProfile {
  name: string;
  mission: string;
  address: Address;
  phone: string;
  email: string;
  taxId: string;
  logo: string | null;
  website: string;
}

export interface SecuritySettings {
  pinEnabled: boolean;
  pinHash: string | null;
  encryptSensitive: boolean;
  lastUnlockedAt: string | null;
}

export interface Subscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string;
  startedAt?: string;
}

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: TeamRole;
  shareProfile: boolean;
  invitedAt: string;
  acceptedAt?: string;
}

export interface TeamSettings {
  enabled: boolean;
  orgName: string;
  /** Stable team id — typically the owner's account id */
  teamId?: string | null;
  /** When the team workspace was first created */
  createdAt?: string | null;
  ownerEmail?: string | null;
  ownerName?: string | null;
  myRole?: TeamRole | null;
  members: TeamMember[];
  shareBusinessProfile: boolean;
  shareOrganizationProfile: boolean;
}

export interface AccountSettings {
  email: string;
  displayName: string;
  accountId: string;
  timezone: string;
}

export interface PreferencesSettings {
  currency: string;
  dateFormat: "MDY" | "DMY" | "YMD";
  defaultPaymentTerms: string;
  emailNotifications: boolean;
  productUpdates: boolean;
  documentReminders: boolean;
}

/** Saved owner signature used on contracts, bills of sale, and other binding forms */
export interface SignatureSettings {
  signerName: string;
  signerTitle: string;
  /** Business or organization name when signing on behalf of an entity */
  entityName: string;
  /** PNG data URL from the signature pad */
  drawnSignature: string | null;
  /** Prefer drawn signature over typed cursive when both exist */
  useDrawnSignature: boolean;
}

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  category: string;
  status: "open" | "closed";
  createdAt: string;
}

export interface PacketItem {
  type: "template" | "saved";
  id: string;
}

export interface DocumentPacket {
  id: string;
  name: string;
  description?: string;
  /** Catalog template IDs to include as blank starters */
  templateIds: string[];
  /** Saved portal document local IDs with filled data */
  savedLocalIds: string[];
  /** Explicit order when templates and saved files are interleaved */
  items?: PacketItem[];
  createdAt: string;
  updatedAt: string;
}

export interface AppContact {
  id: string;
  email: string;
  name: string;
  addedAt: string;
}

export interface UserLibrary {
  favoriteTemplateIds: string[];
  packets: DocumentPacket[];
  contacts: AppContact[];
}

export interface UserProfile {
  version: 1;
  profileType: ProfileType;
  onboardingComplete: boolean;
  business: BusinessProfile;
  personal: PersonalProfile;
  organization: OrganizationProfile;
  security: SecuritySettings;
  subscription: Subscription;
  team: TeamSettings;
  account: AccountSettings;
  preferences: PreferencesSettings;
  signature: SignatureSettings;
  library: UserLibrary;
  createdAt: string;
  updatedAt: string;
}

export const EMPTY_ADDRESS: Address = {
  street: "",
  city: "",
  state: "",
  zip: "",
  country: "United States",
};

export const DEFAULT_PROFILE: UserProfile = {
  version: 1,
  profileType: "mixed",
  onboardingComplete: false,
  business: {
    name: "",
    tagline: "",
    address: { ...EMPTY_ADDRESS },
    phone: "",
    email: "",
    website: "",
    taxId: "",
    logo: null,
    industry: "",
  },
  personal: {
    fullName: "",
    title: "",
    address: { ...EMPTY_ADDRESS },
    phone: "",
    email: "",
    linkedin: "",
  },
  organization: {
    name: "",
    mission: "",
    address: { ...EMPTY_ADDRESS },
    phone: "",
    email: "",
    taxId: "",
    logo: null,
    website: "",
  },
  security: {
    pinEnabled: false,
    pinHash: null,
    encryptSensitive: true,
    lastUnlockedAt: null,
  },
  subscription: {
    plan: "free",
    status: "none",
  },
  team: {
    enabled: false,
    orgName: "",
    teamId: null,
    ownerEmail: null,
    ownerName: null,
    myRole: null,
    members: [],
    shareBusinessProfile: true,
    shareOrganizationProfile: true,
  },
  account: {
    email: "",
    displayName: "",
    accountId: "",
    timezone: "America/New_York",
  },
  preferences: {
    currency: "USD",
    dateFormat: "MDY",
    defaultPaymentTerms: "Net 30",
    emailNotifications: true,
    productUpdates: true,
    documentReminders: false,
  },
  signature: {
    signerName: "",
    signerTitle: "",
    entityName: "",
    drawnSignature: null,
    useDrawnSignature: true,
  },
  library: {
    favoriteTemplateIds: [],
    packets: [],
    contacts: [],
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const SENSITIVE_PATHS = [
  "business.taxId",
  "organization.taxId",
] as const;

export function formatAddress(addr: Address): string {
  const parts = [addr.street, addr.city, addr.state, addr.zip, addr.country].filter(Boolean);
  return parts.join(", ");
}

export function parseAddressString(value: string): Address {
  const parts = value.split(",").map((p) => p.trim());
  return {
    street: parts[0] ?? "",
    city: parts[1] ?? "",
    state: parts[2] ?? "",
    zip: parts[3] ?? "",
    country: parts[4] ?? "United States",
  };
}
