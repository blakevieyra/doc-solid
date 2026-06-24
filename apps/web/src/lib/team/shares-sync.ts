import type { DocumentShare, ShareAuditEvent } from "./invites";
import { getSharesForUser, loadShares } from "./invites";

function persistAllShares(shares: DocumentShare[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("doc-solid-document-shares", JSON.stringify(shares));
}

export function mergeShareLists(local: DocumentShare[], remote: DocumentShare[]): DocumentShare[] {
  const map = new Map<string, DocumentShare>();
  for (const s of local) map.set(s.id, s);
  for (const s of remote) {
    const existing = map.get(s.id);
    if (!existing || (s.auditLog?.length ?? 0) >= (existing.auditLog?.length ?? 0)) {
      map.set(s.id, s);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function upsertLocalShare(share: DocumentShare): void {
  const all = loadShares();
  const index = all.findIndex((s) => s.id === share.id);
  if (index === -1) {
    persistAllShares([share, ...all]);
    return;
  }
  const next = [...all];
  next[index] = share;
  persistAllShares(next);
}

export async function pushShareToServer(share: DocumentShare): Promise<void> {
  try {
    const res = await fetch("/api/team/shares", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ share }),
    });
    if (res.ok) {
      const data = (await res.json()) as { share?: DocumentShare };
      if (data.share) upsertLocalShare(data.share);
    }
  } catch {
    /* local copy remains */
  }
}

export async function patchShareOnServer(
  shareId: string,
  patch: {
    auditEvent?: ShareAuditEvent;
    completedAt?: string | null;
    signedAt?: string | null;
    fieldDataSnapshot?: Record<string, string>;
  }
): Promise<DocumentShare | null> {
  try {
    const res = await fetch("/api/team/shares", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareId, ...patch }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { share?: DocumentShare };
    if (data.share) {
      upsertLocalShare(data.share);
      return data.share;
    }
  } catch {
    /* fall through */
  }
  return null;
}

export async function loadSharesForRecipient(
  email: string,
  authMode: "local" | "server"
): Promise<DocumentShare[]> {
  return loadSharesForUser(email, authMode);
}

export async function loadSharesForUser(
  email: string,
  authMode: "local" | "server"
): Promise<DocumentShare[]> {
  const local = getSharesForUser(email);
  if (authMode !== "server" || !email) return local;

  try {
    const res = await fetch("/api/team/shares", { credentials: "include", cache: "no-store" });
    if (!res.ok) return local;
    const data = (await res.json()) as { shares?: DocumentShare[] };
    const remote = data.shares ?? [];
    const merged = mergeShareLists(local, remote);

    const all = loadShares();
    const mergedById = new Map(merged.map((s) => [s.id, s]));
    const updatedAll = all.map((s) => mergedById.get(s.id) ?? s);
    for (const s of merged) {
      if (!all.some((x) => x.id === s.id)) updatedAll.unshift(s);
    }
    persistAllShares(updatedAll);

    return merged;
  } catch {
    return local;
  }
}
