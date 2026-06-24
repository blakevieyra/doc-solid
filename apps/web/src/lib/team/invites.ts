export interface TeamInvite {
  code: string;
  teamId?: string;
  orgName: string;
  inviterName: string;
  inviterEmail: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

export type ShareAuditEventType =
  | "sent"
  | "received"
  | "opened"
  | "signed"
  | "completed"
  | "correction_requested"
  | "kept";

export interface ShareAuditEvent {
  type: ShareAuditEventType;
  timestamp: string;
  actorEmail?: string;
  actorName?: string;
  details?: string;
}

export interface DocumentShare {
  id: string;
  documentTitle: string;
  documentId: string;
  fromName: string;
  fromEmail: string;
  toEmail: string;
  toName: string;
  message?: string;
  shareType?: "share" | "signature_request" | "review_request";
  /** Counterparty signature field IDs the recipient should fill */
  signatureFieldIds?: string[];
  documentTemplateId?: string;
  /** Snapshot of field values at send time — used when recipient has no local copy */
  fieldDataSnapshot?: Record<string, string>;
  auditLog?: ShareAuditEvent[];
  signedAt?: string;
  completedAt?: string;
  createdAt: string;
}

const INVITES_KEY = "doc-solid-team-invites";
const SHARES_KEY = "doc-solid-document-shares";

function loadInvites(): TeamInvite[] {
  try {
    return JSON.parse(localStorage.getItem(INVITES_KEY) ?? "[]") as TeamInvite[];
  } catch {
    return [];
  }
}

function saveInvites(invites: TeamInvite[]): void {
  localStorage.setItem(INVITES_KEY, JSON.stringify(invites));
}

export function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const part = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 8).toUpperCase();
  return `DS-${part.slice(0, 4)}-${part.slice(4, 8)}`;
}

/** Create invite — persisted server-side (KV) when available, local fallback for dev. */
export async function createInvite(
  invite: Omit<TeamInvite, "code" | "createdAt" | "expiresAt">
): Promise<TeamInvite> {
  try {
    const res = await fetch("/api/team/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invite),
    });
    if (res.ok) {
      const data = await res.json() as { invite: TeamInvite };
      return data.invite;
    }
  } catch {
    /* fall through to local dev storage */
  }

  const expires = new Date();
  expires.setDate(expires.getDate() + 7);
  const full: TeamInvite = {
    ...invite,
    code: generateInviteCode(),
    createdAt: new Date().toISOString(),
    expiresAt: expires.toISOString(),
  };
  saveInvites([...loadInvites(), full]);
  return full;
}

export function findInvite(code: string): TeamInvite | null {
  const normalized = code.trim().toUpperCase();
  const invite = loadInvites().find((i) => i.code === normalized);
  if (!invite) return null;
  if (new Date(invite.expiresAt) < new Date()) return null;
  return invite;
}

/** Resolve invite from server (cross-device) with local fallback. */
export async function findInviteAsync(code: string): Promise<TeamInvite | null> {
  const normalized = code.trim().toUpperCase();
  try {
    const res = await fetch(`/api/team/invites?code=${encodeURIComponent(normalized)}`);
    if (res.ok) {
      const data = await res.json() as { invite: TeamInvite | null };
      return data.invite;
    }
  } catch {
    /* fall through */
  }
  return findInvite(normalized);
}

export function loadShares(): DocumentShare[] {
  try {
    return JSON.parse(localStorage.getItem(SHARES_KEY) ?? "[]") as DocumentShare[];
  } catch {
    return [];
  }
}

function persistShares(shares: DocumentShare[]): void {
  localStorage.setItem(SHARES_KEY, JSON.stringify(shares));
}

export function saveShare(share: Omit<DocumentShare, "id" | "createdAt">): DocumentShare {
  const full: DocumentShare = {
    ...share,
    id: `share_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    auditLog: share.auditLog ?? [],
  };
  persistShares([full, ...loadShares()]);
  return full;
}

export function updateShare(
  shareId: string,
  patch: Partial<Omit<DocumentShare, "id" | "createdAt">>
): DocumentShare | null {
  const shares = loadShares();
  const index = shares.findIndex((s) => s.id === shareId);
  if (index === -1) return null;
  const updated: DocumentShare = { ...shares[index], ...patch };
  shares[index] = updated;
  persistShares(shares);
  return updated;
}

export function recordShareAudit(
  shareId: string,
  type: ShareAuditEventType,
  event: Omit<ShareAuditEvent, "type" | "timestamp">
): DocumentShare | null {
  const shares = loadShares();
  const index = shares.findIndex((s) => s.id === shareId);
  if (index === -1) return null;
  const entry: ShareAuditEvent = {
    type,
    timestamp: new Date().toISOString(),
    ...event,
  };
  const share = shares[index];
  const updated: DocumentShare = {
    ...share,
    auditLog: [...(share.auditLog ?? []), entry],
  };
  shares[index] = updated;
  persistShares(shares);
  return updated;
}

export function getShareById(id: string): DocumentShare | null {
  return loadShares().find((s) => s.id === id) ?? null;
}

export function getSharesForEmail(email: string): DocumentShare[] {
  return loadShares().filter((s) => s.toEmail.toLowerCase() === email.toLowerCase());
}
