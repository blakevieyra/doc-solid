import type { DocumentShare, ShareAuditEvent } from "@/lib/team/invites";
import { addNotification } from "./store";

const SEEN_EVENTS_KEY = "doc-solid-seen-share-events";
const SEEN_SHARES_KEY = "doc-solid-seen-share-ids";

function loadSeenEvents(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_EVENTS_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveSeenEvents(seen: Set<string>): void {
  localStorage.setItem(SEEN_EVENTS_KEY, JSON.stringify([...seen].slice(-500)));
}

function loadSeenShareIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_SHARES_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveSeenShareIds(seen: Set<string>): void {
  localStorage.setItem(SEEN_SHARES_KEY, JSON.stringify([...seen].slice(-200)));
}

function eventKey(shareId: string, event: ShareAuditEvent): string {
  return `${shareId}:${event.type}:${event.timestamp}`;
}

function shareLink(share: DocumentShare): string {
  return `/portal/view/${share.documentId}?shareId=${share.id}`;
}

export function processShareNotifications(shares: DocumentShare[], userEmail: string): void {
  const email = userEmail.trim().toLowerCase();
  if (!email) return;

  const seenEvents = loadSeenEvents();
  const seenShares = loadSeenShareIds();
  let eventsChanged = false;
  let sharesChanged = false;

  for (const share of shares) {
    const isSender = share.fromEmail.trim().toLowerCase() === email;
    const isRecipient = share.toEmail.trim().toLowerCase() === email;

    if (isRecipient && !seenShares.has(share.id)) {
      const title =
        share.shareType === "signature_request"
          ? "Signature requested"
          : share.shareType === "review_request"
            ? "Review requested"
            : "Shared with you";
      addNotification({
        type: "share",
        title,
        message: `${share.fromName} sent "${share.documentTitle}"`,
        link: shareLink(share),
        createdAt: share.createdAt,
      });
      seenShares.add(share.id);
      sharesChanged = true;
    }

    for (const event of share.auditLog ?? []) {
      const key = eventKey(share.id, event);
      if (seenEvents.has(key)) continue;

      if (isSender) {
        if (event.type === "completed") {
          addNotification({
            id: `share_${share.id}_${event.type}_${event.timestamp}`,
            type: "share",
            title: "Document signed & returned",
            message: `${share.toName || share.toEmail} completed "${share.documentTitle}"`,
            link: shareLink(share),
            createdAt: event.timestamp,
          });
        } else if (event.type === "signed") {
          addNotification({
            id: `share_${share.id}_${event.type}_${event.timestamp}`,
            type: "share",
            title: "Document signed",
            message: `${share.toName || share.toEmail} signed "${share.documentTitle}"`,
            link: shareLink(share),
            createdAt: event.timestamp,
          });
        } else if (event.type === "correction_requested") {
          addNotification({
            id: `share_${share.id}_${event.type}_${event.timestamp}`,
            type: "share",
            title: "Returned with comments",
            message: `${share.toName || share.toEmail} returned "${share.documentTitle}" with comments`,
            link: shareLink(share),
            createdAt: event.timestamp,
          });
        }
      }

      seenEvents.add(key);
      eventsChanged = true;
    }
  }

  if (eventsChanged) saveSeenEvents(seenEvents);
  if (sharesChanged) saveSeenShareIds(seenShares);
}
