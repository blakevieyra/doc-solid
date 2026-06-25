import type {
  ProfileType,
  SignatureContext,
  SignatureLibrary,
  SignatureSettings,
  UserProfile,
} from "./types";
import { DEFAULT_PROFILE } from "./types";

export const SIGNATURE_CONTEXTS: SignatureContext[] = ["individual", "business", "organization"];

export const SIGNATURE_CONTEXT_LABELS: Record<SignatureContext, string> = {
  individual: "Personal",
  business: "Business",
  organization: "Organization",
};

export function emptySignatureSettings(): SignatureSettings {
  return structuredClone(DEFAULT_PROFILE.signature);
}

export function defaultActiveSignatureContext(profileType: ProfileType): SignatureContext {
  if (profileType === "individual") return "individual";
  if (profileType === "organization") return "organization";
  return "business";
}

export function resolveOwnerIdentityForContext(
  profile: UserProfile,
  context: SignatureContext,
): Pick<SignatureSettings, "signerName" | "signerTitle" | "entityName"> {
  const signerName = profile.personal.fullName || profile.account.displayName;

  if (context === "individual") {
    return {
      signerName,
      signerTitle: profile.personal.title || "Individual",
      entityName: "",
    };
  }

  if (context === "organization") {
    return {
      signerName,
      signerTitle: profile.personal.title || "Authorized Representative",
      entityName: profile.organization.name,
    };
  }

  return {
    signerName,
    signerTitle: profile.personal.title || "Authorized Signer",
    entityName: profile.business.name || profile.organization.name,
  };
}

export function syncSignatureSettingsForContext(
  profile: UserProfile,
  context: SignatureContext,
  existing?: SignatureSettings,
): SignatureSettings {
  const identity = resolveOwnerIdentityForContext(profile, context);
  const base = existing ?? emptySignatureSettings();

  return {
    ...base,
    signerName: base.signerName || identity.signerName,
    signerTitle: base.signerTitle || identity.signerTitle,
    entityName: base.entityName ?? identity.entityName,
  };
}

function seedLibraryFromLegacy(profile: UserProfile): SignatureLibrary {
  const activeContext = defaultActiveSignatureContext(profile.profileType);
  const legacy = profile.signature ?? emptySignatureSettings();
  const hasLegacy = Boolean(legacy.signerName.trim() || legacy.drawnSignature);

  const byContext = {
    individual: syncSignatureSettingsForContext(profile, "individual"),
    business: syncSignatureSettingsForContext(profile, "business"),
    organization: syncSignatureSettingsForContext(profile, "organization"),
  };

  if (hasLegacy) {
    byContext[activeContext] = {
      ...byContext[activeContext],
      ...legacy,
      signerName: legacy.signerName || byContext[activeContext].signerName,
      signerTitle: legacy.signerTitle || byContext[activeContext].signerTitle,
      entityName: legacy.entityName ?? byContext[activeContext].entityName,
    };
  }

  return { activeContext, byContext };
}

export function ensureSignatureLibrary(profile: UserProfile): SignatureLibrary {
  if (profile.signatures?.byContext) {
    const activeContext =
      profile.signatures.activeContext ??
      defaultActiveSignatureContext(profile.profileType);
    return {
      activeContext,
      byContext: {
        individual: syncSignatureSettingsForContext(
          profile,
          "individual",
          profile.signatures.byContext.individual,
        ),
        business: syncSignatureSettingsForContext(
          profile,
          "business",
          profile.signatures.byContext.business,
        ),
        organization: syncSignatureSettingsForContext(
          profile,
          "organization",
          profile.signatures.byContext.organization,
        ),
      },
    };
  }

  return seedLibraryFromLegacy(profile);
}

export function getActiveSignatureContext(profile: UserProfile): SignatureContext {
  return ensureSignatureLibrary(profile).activeContext;
}

export function getSignatureSettings(
  profile: UserProfile,
  context?: SignatureContext,
): SignatureSettings {
  const library = ensureSignatureLibrary(profile);
  const key = context ?? library.activeContext;
  return library.byContext[key];
}

export function patchSignatureLibrary(
  profile: UserProfile,
  context: SignatureContext,
  settings: SignatureSettings,
  options?: { setActive?: boolean },
): Pick<UserProfile, "signatures" | "signature"> {
  const library = ensureSignatureLibrary(profile);
  const activeContext = options?.setActive ? context : library.activeContext;
  const byContext = { ...library.byContext, [context]: settings };
  const signatures: SignatureLibrary = { activeContext, byContext };

  return {
    signatures,
    signature: byContext[activeContext],
  };
}

export function mergeSignatureLibraries(
  primary: SignatureLibrary,
  secondary: SignatureLibrary,
): SignatureLibrary {
  const mergeSettings = (a: SignatureSettings, b: SignatureSettings): SignatureSettings => ({
    signerName: a.signerName || b.signerName,
    signerTitle: a.signerTitle || b.signerTitle,
    entityName: a.entityName || b.entityName,
    drawnSignature: a.drawnSignature ?? b.drawnSignature,
    useDrawnSignature: a.useDrawnSignature ?? b.useDrawnSignature,
  });

  return {
    activeContext: primary.activeContext || secondary.activeContext,
    byContext: {
      individual: mergeSettings(primary.byContext.individual, secondary.byContext.individual),
      business: mergeSettings(primary.byContext.business, secondary.byContext.business),
      organization: mergeSettings(
        primary.byContext.organization,
        secondary.byContext.organization,
      ),
    },
  };
}

export function applyProfileSignaturePatch(
  current: UserProfile,
  patch: Partial<Pick<UserProfile, "signature" | "signatures">>,
): Pick<UserProfile, "signature" | "signatures"> {
  if (patch.signatures) {
    const library = patch.signatures;
    return {
      signatures: library,
      signature: library.byContext[library.activeContext],
    };
  }

  if (patch.signature) {
    const library = ensureSignatureLibrary(current);
    return patchSignatureLibrary(current, library.activeContext, {
      ...getSignatureSettings(current, library.activeContext),
      ...patch.signature,
    });
  }

  return {
    signatures: current.signatures,
    signature: current.signature,
  };
}

/** Switch default signature context when account profile type changes */
export function syncSignatureContextForProfileType(
  profile: UserProfile,
): Pick<UserProfile, "signatures" | "signature"> | null {
  const library = ensureSignatureLibrary(profile);
  const expected = defaultActiveSignatureContext(profile.profileType);
  if (library.activeContext === expected) return null;
  return patchSignatureLibrary(profile, expected, library.byContext[expected], {
    setActive: true,
  });
}
