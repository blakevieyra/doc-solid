import { kvGet, kvSet } from "./kv";
import type { DocumentShare } from "@/lib/team/invites";

export interface ServerNotification {
  id: string;
  type: "share";
  title: string;
  message: string;
  link?: string;
  createdAt: string;
  read: boolean;
}

const NOTIFICATION_TTL_SEC = 60 * 60 * 24 * 90;
const MAX_NOTIFICATIONS = 100;

function notificationsKey(email: string): string {
  return `notifications:${email.trim().toLowerCase()}`;
}

async function readNotifications(email: string): Promise<ServerNotification[]> {
  const raw = await kvGet(notificationsKey(email));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ServerNotification[];
  } catch {
    return [];
  }
}

async function writeNotifications(email: string, items: ServerNotification[]): Promise<void> {
  await kvSet(
    notificationsKey(email),
    JSON.stringify(items.slice(0, MAX_NOTIFICATIONS)),
    NOTIFICATION_TTL_SEC
  );
}

export async function fanOutShareNotifications(
  before: DocumentShare | null,
  after: DocumentShare
): Promise<void> {
  const prevKeys = new Set((before?.auditLog ?? []).map((e) => `${e.type}:${e.timestamp}`));
  const senderEmail = after.fromEmail.trim().toLowerCase();
  if (!senderEmail) return;

  const link = `/portal/view/${after.documentId}?shareId=${after.id}`;
  const existing = await readNotifications(senderEmail);
  const knownIds = new Set(existing.map((n) => n.id));
  const toAdd: ServerNotification[] = [];

  for (const event of after.auditLog ?? []) {
    const eventKey = `${event.type}:${event.timestamp}`;
    if (prevKeys.has(eventKey)) continue;

    let title: string | null = null;
    let message: string | null = null;

    if (event.type === "completed") {
      title = "Document signed & returned";
      message = `${after.toName || after.toEmail} completed "${after.documentTitle}"`;
    } else if (event.type === "signed") {
      title = "Document signed";
      message = `${after.toName || after.toEmail} signed "${after.documentTitle}"`;
    } else if (event.type === "correction_requested") {
      title = "Returned for correction";
      message = `${after.toName || after.toEmail} returned "${after.documentTitle}"`;
    }

    if (!title || !message) continue;

    const id = `share_${after.id}_${event.type}_${event.timestamp}`;
    if (knownIds.has(id)) continue;

    toAdd.push({
      id,
      type: "share",
      title,
      message,
      link,
      createdAt: event.timestamp,
      read: false,
    });
    knownIds.add(id);
  }

  if (toAdd.length > 0) {
    await writeNotifications(senderEmail, [...toAdd, ...existing]);
  }
}

export async function getServerNotifications(email: string): Promise<ServerNotification[]> {
  return readNotifications(email);
}
