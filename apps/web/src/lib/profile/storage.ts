import {
  DEFAULT_PROFILE,
  SENSITIVE_PATHS,
  type UserProfile,
  type Address,
} from "./types";
import { syncSignatureSettings, buildOwnerSignatureValue } from "./signature";
import { ensureSignatureLibrary } from "./signature-library";
import { resolveOnboardingComplete } from "./onboarding";
import { buildDocumentAutofill } from "./document-branding";

export { resolveOnboardingComplete } from "./onboarding";
import { generateAccountId } from "@/lib/support/config";
import { getProfileStorageKey } from "@/lib/data/wipeAll";
import {
  getLegacyKey,
  encryptValue,
  decryptValue,
  isEncrypted,
} from "./security";

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== "object") {
      current[keys[i]] = {};
    }
    current = current[keys[i]] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
}

async function encryptSensitiveFields(
  profile: UserProfile,
  passphrase: string
): Promise<UserProfile> {
  const copy = structuredClone(profile);
  const record = copy as unknown as Record<string, unknown>;
  for (const path of SENSITIVE_PATHS) {
    const val = getNestedValue(record, path);
    if (typeof val === "string" && val && !isEncrypted(val)) {
      setNestedValue(record, path, await encryptValue(val, passphrase));
    }
  }
  return copy;
}

async function decryptSensitiveFields(
  profile: UserProfile,
  passphrase: string
): Promise<UserProfile> {
  const copy = structuredClone(profile);
  const record = copy as unknown as Record<string, unknown>;
  for (const path of SENSITIVE_PATHS) {
    const val = getNestedValue(record, path);
    if (typeof val === "string" && isEncrypted(val)) {
      try {
        setNestedValue(record, path, await decryptValue(val, passphrase));
      } catch {
        setNestedValue(record, path, "");
      }
    }
  }
  return copy;
}

function migrateLegacyProfile(raw: string): UserProfile | null {
  try {
    const legacy = JSON.parse(raw) as {
      business?: Record<string, string>;
      personal?: Record<string, string>;
    };
    const profile = structuredClone(DEFAULT_PROFILE);
    if (legacy.business) {
      profile.business.name = legacy.business.name ?? "";
      profile.business.phone = legacy.business.phone ?? "";
      profile.business.email = legacy.business.email ?? "";
      profile.business.taxId = legacy.business.taxId ?? "";
      if (legacy.business.address) {
        profile.business.address.street = legacy.business.address;
      }
    }
    if (legacy.personal) {
      profile.personal.fullName = legacy.personal.fullName ?? "";
      profile.personal.phone = legacy.personal.phone ?? "";
      profile.personal.email = legacy.personal.email ?? "";
      if (legacy.personal.address) {
        profile.personal.address.street = legacy.personal.address;
      }
    }
    profile.onboardingComplete = !!(profile.business.name || profile.personal.fullName);
    return profile;
  } catch {
    return null;
  }
}

function syncSignatureFromProfile(profile: UserProfile): UserProfile["signature"] {
  const library = ensureSignatureLibrary(profile);
  return library.byContext[library.activeContext];
}

function attachSignatureLibrary(profile: UserProfile): UserProfile {
  const library = ensureSignatureLibrary(profile);
  return {
    ...profile,
    signatures: library,
    signature: library.byContext[library.activeContext],
  };
}

function normalizeProfile(raw: Partial<UserProfile>): UserProfile {
  const base = structuredClone(DEFAULT_PROFILE);
  const merged = {
    ...base,
    ...raw,
    business: { ...base.business, ...raw.business },
    personal: { ...base.personal, ...raw.personal },
    organization: { ...base.organization, ...raw.organization },
    security: { ...base.security, ...raw.security },
    subscription: { ...base.subscription, ...raw.subscription },
    team: {
      ...base.team,
      ...raw.team,
      members: raw.team?.members ?? base.team.members,
      memberships: raw.team?.memberships ?? base.team.memberships,
    },
    account: { ...base.account, ...raw.account },
    preferences: { ...base.preferences, ...raw.preferences },
    signature: { ...base.signature, ...raw.signature },
    signatures: raw.signatures,
    library: {
      ...base.library,
      ...raw.library,
      favoriteTemplateIds: raw.library?.favoriteTemplateIds ?? base.library.favoriteTemplateIds,
      favoriteLocalIds: raw.library?.favoriteLocalIds ?? base.library.favoriteLocalIds,
      packets: raw.library?.packets ?? base.library.packets,
      contacts: raw.library?.contacts ?? base.library.contacts,
    },
  };
  merged.signature = syncSignatureFromProfile(merged);
  merged.onboardingComplete =
    merged.onboardingComplete || resolveOnboardingComplete(merged);
  const withDefaults = ensureAccountId(merged);
  if (!withDefaults.account.displayName) {
    withDefaults.account.displayName =
      withDefaults.personal.fullName || withDefaults.business.name || withDefaults.organization.name || "";
  }
  if (!withDefaults.account.email) {
    withDefaults.account.email =
      withDefaults.business.email || withDefaults.personal.email || withDefaults.organization.email || "";
  }
  return attachSignatureLibrary(withDefaults);
}

/** Assign a stable system account ID when missing */
export function ensureAccountId(profile: UserProfile): UserProfile {
  if (profile.account.accountId?.trim()) return profile;
  return {
    ...profile,
    account: { ...profile.account, accountId: generateAccountId() },
  };
}

export async function loadProfile(userId?: string | null, unlockPin?: string): Promise<UserProfile> {
  if (typeof window === "undefined") return structuredClone(DEFAULT_PROFILE);

  const key = getProfileStorageKey(userId ?? null);
  let raw = localStorage.getItem(key);
  if (!raw) {
    const legacy = localStorage.getItem(getLegacyKey());
    if (legacy) {
      const migrated = migrateLegacyProfile(legacy);
      if (migrated) {
        await saveProfile(migrated, userId);
        localStorage.removeItem(getLegacyKey());
        return migrated;
      }
    }
    return structuredClone(DEFAULT_PROFILE);
  }

  let parsed: Partial<UserProfile>;
  try {
    parsed = JSON.parse(raw) as Partial<UserProfile>;
  } catch {
    console.warn("[DocSolid] Corrupt profile data — resetting to defaults");
    clearProfile(userId ?? null);
    return structuredClone(DEFAULT_PROFILE);
  }

  const profile = normalizeProfile(parsed);

  if (profile.security.encryptSensitive && unlockPin) {
    return decryptSensitiveFields(profile, unlockPin);
  }

  return profile;
}

/** Read PIN settings from on-device storage (authoritative for unlock). */
export async function loadDeviceSecuritySettings(
  userId?: string | null,
): Promise<Pick<UserProfile["security"], "pinEnabled" | "pinHash" | "encryptSensitive">> {
  const profile = await loadProfile(userId);
  return {
    pinEnabled: profile.security.pinEnabled,
    pinHash: profile.security.pinHash,
    encryptSensitive: profile.security.encryptSensitive,
  };
}

export async function saveProfile(
  profile: UserProfile,
  userId?: string | null,
  lockPin?: string
): Promise<UserProfile> {
  const toSave = structuredClone(profile);
  toSave.updatedAt = new Date().toISOString();
  const key = getProfileStorageKey(userId ?? null);

  if (toSave.security.encryptSensitive && lockPin) {
    const encrypted = await encryptSensitiveFields(toSave, lockPin);
    localStorage.setItem(key, JSON.stringify(encrypted));
  } else {
    localStorage.setItem(key, JSON.stringify(toSave));
  }
  return toSave;
}

export function clearProfile(userId?: string | null): void {
  localStorage.removeItem(getProfileStorageKey(userId ?? null));
  localStorage.removeItem(getLegacyKey());
}

export function exportProfile(profile: UserProfile): string {
  const exportable = structuredClone(profile);
  exportable.security.pinHash = null;
  return JSON.stringify(exportable, null, 2);
}

export function importProfile(json: string): UserProfile {
  const parsed = JSON.parse(json) as Partial<UserProfile>;
  const profile = normalizeProfile(parsed);
  profile.updatedAt = new Date().toISOString();
  return profile;
}

/** Parse CSV row-based import: field,value format or header row */
export function importFromCsv(csv: string): Partial<UserProfile> {
  const lines = csv.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const updates: Record<string, string> = {};

  for (const line of lines) {
    const [field, ...rest] = line.split(",");
    const value = rest.join(",").trim().replace(/^"|"$/g, "");
    if (field && value) updates[field.trim().toLowerCase()] = value;
  }

  const profile = structuredClone(DEFAULT_PROFILE);

  const map: Record<string, (v: string) => void> = {
    "business.name": (v) => { profile.business.name = v; },
    "business.email": (v) => { profile.business.email = v; },
    "business.phone": (v) => { profile.business.phone = v; },
    "business.taxid": (v) => { profile.business.taxId = v; },
    "business.website": (v) => { profile.business.website = v; },
    "business.tagline": (v) => { profile.business.tagline = v; },
    "business.industry": (v) => { profile.business.industry = v; },
    "business.street": (v) => { profile.business.address.street = v; },
    "business.city": (v) => { profile.business.address.city = v; },
    "business.state": (v) => { profile.business.address.state = v; },
    "business.zip": (v) => { profile.business.address.zip = v; },
    "personal.fullname": (v) => { profile.personal.fullName = v; },
    "personal.email": (v) => { profile.personal.email = v; },
    "personal.phone": (v) => { profile.personal.phone = v; },
    "personal.title": (v) => { profile.personal.title = v; },
    "personal.linkedin": (v) => { profile.personal.linkedin = v; },
    "organization.name": (v) => { profile.organization.name = v; },
    "organization.email": (v) => { profile.organization.email = v; },
    "organization.mission": (v) => { profile.organization.mission = v; },
  };

  for (const [key, value] of Object.entries(updates)) {
    map[key]?.(value);
  }

  return profile;
}

export function getProfileFieldValue(profile: UserProfile, path: string): string {
  if (path === "signature.owner") {
    return buildOwnerSignatureValue(profile);
  }
  if (path === "signature.signerName") {
    return syncSignatureSettings(profile).signerName;
  }
  if (path === "signature.entityName") {
    return syncSignatureSettings(profile).entityName;
  }
  const val = getNestedValue(profile as unknown as Record<string, unknown>, path);
  if (val == null) return "";
  if (typeof val === "string") return isEncrypted(val) ? "••••••" : val;
  if (typeof val === "object" && "street" in (val as Address)) {
    const addr = val as Address;
    return [addr.street, addr.city, addr.state, addr.zip, addr.country].filter(Boolean).join(", ");
  }
  return String(val);
}

export function buildAutofillValues(profile: UserProfile): Record<string, string> {
  return buildDocumentAutofill(profile);
}
