import { IndexedDBStorage } from "@doc-solid/storage";
import { clearSession } from "@/lib/auth/credentials";

import { clearSequenceRegistry } from "@/lib/documents/sequencing";

const PROFILE_PREFIX = "doc-solid-profile-v1";
const LEGACY_PROFILE = "doc-solid-profile";

export async function wipeAllUserData(userId?: string): Promise<void> {
  const storage = new IndexedDBStorage();
  if (userId) {
    await storage.deleteDocumentsForUser(userId);
  } else {
    await storage.clearAll();
  }

  if (userId) {
    localStorage.removeItem(`${PROFILE_PREFIX}-${userId}`);
    clearSequenceRegistry(userId);
  }
  clearSequenceRegistry(null);
  localStorage.removeItem(PROFILE_PREFIX);
  localStorage.removeItem(LEGACY_PROFILE);
  localStorage.removeItem("doc-solid-notifications");
  localStorage.removeItem("doc-solid-team-invites");
  localStorage.removeItem("doc-solid-document-shares");

  clearSession();
}

export function getProfileStorageKey(userId: string | null): string {
  if (userId) return `${PROFILE_PREFIX}-${userId}`;
  return PROFILE_PREFIX;
}
