/**
 * Smoke + light stress checks for favorites persistence rules and plan gating.
 * Run: npm run test:smoke --workspace=@doc-solid/web
 */
import { DEFAULT_PROFILE, type UserProfile } from "../src/lib/profile/types";
import {
  toggleFavorite,
  getFavoriteTemplateIds,
  canManageFavorites,
} from "../src/lib/documents/favorites";
import {
  canUseFeature,
  maxFavorites,
  getEffectiveSubscription,
} from "../src/lib/subscription/plans";
import { mergeProfiles } from "../src/lib/profile/cloud-sync";
import { isGuestBrowsePath } from "../src/lib/auth/guest-browse";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`FAIL: ${label}`);
}

function profileWithFavorites(ids: string[]): UserProfile {
  return {
    ...DEFAULT_PROFILE,
    library: { ...DEFAULT_PROFILE.library, favoriteTemplateIds: ids },
  };
}

function stressToggleFavorite(iterations: number): void {
  let profile = structuredClone(DEFAULT_PROFILE);
  for (let i = 0; i < iterations; i += 1) {
    const id = `template-${i % 25}`;
    const result = toggleFavorite(profile, id);
    if (result.error) break;
    profile = {
      ...profile,
      library: { ...profile.library, favoriteTemplateIds: result.favorites },
    };
  }
  const count = getFavoriteTemplateIds(profile).length;
  assert(count <= 20, `stress toggle caps free favorites at 20 (got ${count})`);
}

console.log("DocSolid smoke audit\n");

assert(!canManageFavorites(false), "guests cannot manage favorites");
assert(canManageFavorites(true), "signed-in users can manage favorites");
assert(getFavoriteTemplateIds(DEFAULT_PROFILE).length === 0, "default profile has no favorites");

const freeSub = DEFAULT_PROFILE.subscription;
const proSub = {
  ...freeSub,
  plan: "monthly" as const,
  status: "active" as const,
};

assert(maxFavorites(freeSub) === 20, "free max favorites is 20");
assert(maxFavorites(proSub) === Infinity, "pro max favorites is unlimited");

let freeProfile = profileWithFavorites([]);
for (let i = 0; i < 20; i += 1) {
  const r = toggleFavorite(freeProfile, `doc-${i}`);
  assert(!r.error, `free user can add favorite ${i}`);
  freeProfile = { ...freeProfile, library: { ...freeProfile.library, favoriteTemplateIds: r.favorites } };
}
const blocked = toggleFavorite(freeProfile, "doc-overflow");
assert(Boolean(blocked.error), "free user blocked at 21st favorite");

assert(!canUseFeature(freeSub, "pdfClean"), "free cannot export clean PDF");
assert(!canUseFeature(freeSub, "teamSharing"), "free cannot use team sharing");
assert(!canUseFeature(freeSub, "securityScan"), "free cannot scan/redact");
assert(canUseFeature(freeSub, "documentPackets"), "free can use packets (with limits)");
assert(canUseFeature(proSub, "pdfClean"), "pro can export clean PDF");
assert(canUseFeature(proSub, "teamSharing"), "pro can use team sharing");
assert(getEffectiveSubscription(freeSub).isProActive === false, "free subscription not pro");
assert(getEffectiveSubscription(proSub).isProActive === true, "active monthly is pro");

const local = profileWithFavorites(["invoice", "quote"]);
const server = profileWithFavorites(["nda"]);
const merged = mergeProfiles(local, server);
assert(
  merged.library.favoriteTemplateIds.sort().join(",") === "invoice,nda,quote",
  "mergeProfiles unions favorites for backend sync",
);

assert(isGuestBrowsePath("/documents"), "guest can browse documents list");
assert(isGuestBrowsePath("/documents/invoice"), "guest can browse template preview");
assert(!isGuestBrowsePath("/portal"), "guest cannot browse portal without auth");

stressToggleFavorite(500);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("All smoke checks passed.");
