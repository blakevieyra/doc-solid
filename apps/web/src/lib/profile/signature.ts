import type { UserProfile, SignatureSettings } from "./types";

export interface SignaturePayload {
  v: 1;
  name: string;
  title: string;
  entity: string;
  image: string | null;
  mode: "drawn" | "typed";
}

const SIGNATURE_PREFIX = "ds-sig:";

export function resolveOwnerIdentity(profile: UserProfile): {
  signerName: string;
  signerTitle: string;
  entityName: string;
} {
  const { profileType } = profile;

  if (profileType === "individual") {
    return {
      signerName: profile.personal.fullName || profile.account.displayName,
      signerTitle: profile.personal.title || "Individual",
      entityName: "",
    };
  }

  if (profileType === "organization") {
    return {
      signerName: profile.personal.fullName || profile.account.displayName,
      signerTitle: profile.personal.title || "Authorized Representative",
      entityName: profile.organization.name,
    };
  }

  // business or mixed — prefer business entity with personal signer
  return {
    signerName: profile.personal.fullName || profile.account.displayName,
    signerTitle: profile.personal.title || "Authorized Signer",
    entityName: profile.business.name || profile.organization.name,
  };
}

export function syncSignatureSettings(profile: UserProfile): SignatureSettings {
  const identity = resolveOwnerIdentity(profile);
  const existing = profile.signature ?? {
    signerName: "",
    signerTitle: "",
    entityName: "",
    drawnSignature: null,
    useDrawnSignature: true,
  };

  return {
    ...existing,
    signerName: existing.signerName || identity.signerName,
    signerTitle: existing.signerTitle || identity.signerTitle,
    entityName: existing.entityName || identity.entityName,
  };
}

export function buildOwnerSignatureValue(profile: UserProfile): string {
  const sig = syncSignatureSettings(profile);
  if (!sig.signerName && !sig.drawnSignature) return "";

  const payload: SignaturePayload = {
    v: 1,
    name: sig.signerName,
    title: sig.signerTitle,
    entity: sig.entityName,
    image: sig.useDrawnSignature ? sig.drawnSignature : null,
    mode: sig.useDrawnSignature && sig.drawnSignature ? "drawn" : "typed",
  };

  return `${SIGNATURE_PREFIX}${JSON.stringify(payload)}`;
}

export function parseSignatureValue(raw: string | undefined | null): SignaturePayload | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith(SIGNATURE_PREFIX)) {
    try {
      const parsed = JSON.parse(trimmed.slice(SIGNATURE_PREFIX.length)) as SignaturePayload;
      if (parsed.v === 1 && parsed.name) return parsed;
    } catch {
      return legacyTypedSignature(trimmed.slice(SIGNATURE_PREFIX.length));
    }
  }
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as SignaturePayload;
      if (parsed.v === 1 && parsed.name) return parsed;
    } catch {
      /* fall through */
    }
  }
  return legacyTypedSignature(trimmed);
}

function legacyTypedSignature(name: string): SignaturePayload {
  return {
    v: 1,
    name,
    title: "",
    entity: "",
    image: null,
    mode: "typed",
  };
}

export function serializeSignaturePayload(payload: SignaturePayload): string {
  return `${SIGNATURE_PREFIX}${JSON.stringify(payload)}`;
}

export function signatureDisplayName(payload: SignaturePayload | null): string {
  if (!payload) return "";
  return payload.name;
}

export function isImportantFormCategory(category: string): boolean {
  return ["legal", "compliance", "hr", "real-estate", "financial", "governance"].includes(category);
}

const OWNER_SIGNATURE_IDS = new Set([
  "signature",
  "sellerSignature",
  "ownerSignature",
  "authorizedSignature",
  "landlordSignature",
  "lessorSignature",
  "employerSignature",
  "lenderSignature",
]);

const COUNTERPARTY_SIGNATURE_IDS = new Set([
  "buyerSignature",
  "clientSignature",
  "counterSignature",
  "tenantSignature",
  "receivingPartySignature",
  "witnessSignature",
  "guestSignature",
  "candidateSignature",
  "contractorSignature",
  "volunteerSignature",
  "employeeSignature",
  "purchaserSignature",
  "vendorSignature",
  "customerSignature",
  "recipientSignature",
  "borrowerSignature",
  "supervisorSignature",
]);

export function isOwnerSignatureField(
  field: { id?: string; ownerSignature?: boolean; defaultFromProfile?: string; type: string },
  _docCategory?: string
): boolean {
  if (field.type !== "signature") return false;
  if (field.ownerSignature || field.defaultFromProfile === "signature.owner") return true;
  if (field.id && OWNER_SIGNATURE_IDS.has(field.id)) return true;
  if (field.id && COUNTERPARTY_SIGNATURE_IDS.has(field.id)) return false;
  return field.id === "signature";
}

export function isCounterpartySignatureField(
  field: { id?: string; ownerSignature?: boolean; defaultFromProfile?: string; type: string },
  docCategory?: string
): boolean {
  if (field.type !== "signature") return false;
  return !isOwnerSignatureField(field, docCategory);
}

export function shouldAutofillOwnerSignature(
  field: { id?: string; ownerSignature?: boolean; defaultFromProfile?: string; type: string },
  docCategory?: string
): boolean {
  return isOwnerSignatureField(field, docCategory);
}

export function signatureMatchesOwnerIdentity(
  payload: SignaturePayload,
  profile: UserProfile
): boolean {
  const identity = resolveOwnerIdentity(profile);
  const sig = syncSignatureSettings(profile);
  const expected = (sig.signerName || identity.signerName).trim().toLowerCase();
  if (!expected) return false;
  return payload.name.trim().toLowerCase() === expected;
}
