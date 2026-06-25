export type NotificationType = "reminder" | "team" | "share" | "billing" | "system" | "security";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

const KEY_PREFIX = "doc-solid-notifications";

let activeUserKey: string | null = null;

/** Scope in-app notifications to the signed-in user (avoids bleed across accounts on one browser). */
export function setNotificationUserKey(userKey: string | null): void {
  activeUserKey = userKey?.trim() || null;
}

function storageKey(): string {
  return activeUserKey ? `${KEY_PREFIX}-${activeUserKey}` : `${KEY_PREFIX}-anonymous`;
}

function load(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(storageKey()) ?? "[]") as AppNotification[];
  } catch {
    return [];
  }
}

function save(items: AppNotification[]): void {
  localStorage.setItem(storageKey(), JSON.stringify(items));
}

export function getNotifications(): AppNotification[] {
  return load().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getUnreadCount(): number {
  return load().filter((n) => !n.read).length;
}

export function addNotification(
  n: Omit<AppNotification, "id" | "read" | "createdAt"> & { id?: string; createdAt?: string }
): AppNotification {
  const item: AppNotification = {
    ...n,
    id: n.id ?? `notif_${Date.now()}`,
    read: false,
    createdAt: n.createdAt ?? new Date().toISOString(),
  };
  const existing = load();
  const duplicate = existing.find((e) => e.id === item.id);
  if (duplicate) return duplicate;
  save([item, ...existing]);
  return item;
}

export function markRead(id: string): void {
  save(load().map((n) => (n.id === id ? { ...n, read: true } : n)));
}

export function markAllRead(): void {
  save(load().map((n) => ({ ...n, read: true })));
}

export function clearNotifications(): void {
  localStorage.removeItem(storageKey());
}

export function checkDocumentReminders(
  documents: { title: string; fieldData: Record<string, unknown>; localId: string }[],
  remindersEnabled: boolean
): void {
  if (!remindersEnabled) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const doc of documents) {
    const due = doc.fieldData.dueDate as string | undefined;
    if (!due) continue;
    const dueDate = new Date(due + "T00:00:00");
    const diff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff >= 0 && diff <= 3) {
      const existing = load().some(
        (n) => n.type === "reminder" && n.message.includes(doc.localId)
      );
      if (!existing) {
        addNotification({
          type: "reminder",
          title: diff === 0 ? "Due today" : `Due in ${diff} day${diff > 1 ? "s" : ""}`,
          message: doc.title,
          link: "/portal",
        });
      }
    }
  }
}
