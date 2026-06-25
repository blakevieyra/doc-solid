"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  addNotification,
  checkDocumentReminders,
  setNotificationUserKey,
  type AppNotification,
} from "@/lib/notifications/store";
import { processShareNotifications } from "@/lib/notifications/share-events";
import { IndexedDBStorage } from "@doc-solid/storage";
import { useProfile } from "./ProfileProvider";
import { useAuth } from "./AuthProvider";
import { loadSharesForUser } from "@/lib/team/shares-sync";
import { dispatchTeamRefresh } from "@/lib/team/roster-client";

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  refresh: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  notify: (n: Omit<AppNotification, "id" | "read" | "createdAt">) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const { session, authMode } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const refresh = useCallback(() => {
    setNotifications(getNotifications());
  }, []);

  const pollShareNotifications = useCallback(async () => {
    const email = session?.email ?? profile.account.email ?? "";
    if (!email) return;
    const shares = await loadSharesForUser(email, authMode ?? "local");
    processShareNotifications(shares, email);

    if (authMode === "server") {
      try {
        const res = await fetch("/api/notifications", { credentials: "include", cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as {
            notifications?: Array<{
              id: string;
              type: "share" | "team";
              title: string;
              message: string;
              link?: string;
              createdAt: string;
            }>;
          };
          let shouldRefreshTeam = false;
          for (const n of data.notifications ?? []) {
            addNotification({
              id: n.id,
              type: n.type,
              title: n.title,
              message: n.message,
              link: n.link,
              createdAt: n.createdAt,
            });
            if (
              n.type === "team" &&
              (/accepted|joined/i.test(n.title) || /accepted|joined/i.test(n.message))
            ) {
              shouldRefreshTeam = true;
            }
          }
          if (shouldRefreshTeam) {
            dispatchTeamRefresh();
          }
        }
      } catch {
        /* local share events still apply */
      }
    }

    refresh();
  }, [authMode, profile.account.email, refresh, session?.email]);

  const userNotificationKey = session?.userId ?? session?.email ?? profile.account.accountId ?? null;

  useEffect(() => {
    setNotificationUserKey(userNotificationKey);
    refresh();
  }, [userNotificationKey, refresh]);

  useEffect(() => {
    refresh();
    const storage = new IndexedDBStorage();
    storage.getDocumentsForUser(session?.userId ?? null).then((docs) => {
      checkDocumentReminders(
        docs.map((d) => ({ title: d.title, fieldData: d.fieldData as Record<string, unknown>, localId: d.localId })),
        profile.preferences.documentReminders
      );
      refresh();
    });
    void pollShareNotifications();
    const interval = setInterval(() => {
      refresh();
      void pollShareNotifications();
    }, 15000);

    function onVisible() {
      if (document.visibilityState === "visible") {
        void pollShareNotifications();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [pollShareNotifications, profile.preferences.documentReminders, refresh, session?.userId]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount: getUnreadCount(),
      refresh,
      markAsRead: (id: string) => { markRead(id); refresh(); },
      markAllAsRead: () => { markAllRead(); refresh(); },
      notify: (n: Omit<AppNotification, "id" | "read" | "createdAt">) => { addNotification(n); refresh(); },
    }),
    [notifications, refresh]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
