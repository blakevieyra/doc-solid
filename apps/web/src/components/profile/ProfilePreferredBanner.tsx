"use client";

import type { SignatureContext } from "@/lib/profile/types";
import type { UserProfile } from "@/lib/profile/types";
import {
  isPreferredProfileSection,
  profileSectionLabel,
  signatureContextToProfileType,
  type ProfileIdentityContext,
} from "@/lib/profile/profile-identity";
import { syncSignatureContextForProfileType } from "@/lib/profile/signature-library";

const SECTION_CONTEXT: Record<ProfileIdentityContext, SignatureContext> = {
  business: "business",
  individual: "individual",
  organization: "organization",
};

export function profileContextFromTab(
  tab: "business" | "personal" | "organization",
): ProfileIdentityContext {
  if (tab === "personal") return "individual";
  if (tab === "organization") return "organization";
  return "business";
}

export function buildPreferredProfilePatch(
  current: UserProfile,
  section: ProfileIdentityContext,
): UserProfile {
  const profileType = signatureContextToProfileType(section);
  const next = { ...current, profileType };
  const signaturePatch = syncSignatureContextForProfileType(next);
  return signaturePatch ? { ...next, ...signaturePatch } : next;
}

export function ProfilePreferredBanner({
  section,
  profile,
  onApply,
}: {
  section: ProfileIdentityContext;
  profile: UserProfile;
  onApply: (next: UserProfile) => void | Promise<void>;
}) {
  const isPreferred = isPreferredProfileSection(profile.profileType, section);
  const label = profileSectionLabel(section);

  function handleSetPreferred() {
    void onApply(buildPreferredProfilePatch(profile, section));
  }

  return (
    <div className={`profile-preferred-banner${isPreferred ? " profile-preferred-banner-active" : ""}`}>
      {isPreferred ? (
        <p className="profile-preferred-label">
          <strong>Preferred profile</strong> — documents, logos, photos, and signatures default to
          your {label} information.
        </p>
      ) : (
        <>
          <p className="field-help" style={{ margin: 0 }}>
            Use your {label} details on new documents, previews, and autofill.
          </p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleSetPreferred}>
            Set {label} as preferred
          </button>
        </>
      )}
    </div>
  );
}
