"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  addNotification,
  checkDocumentReminders,
  type AppNotification,
} from "@/lib/notifications/store";
import { IndexedDBStorage } from "@doc-solid/storage";
import { useProfile } from "./ProfileProvider";
import { useAuth } from "./AuthProvider";

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
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const refresh = useCallback(() => {
    setNotifications(getNotifications());
  }, []);

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
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [profile.preferences.documentReminders, refresh, session?.userId]);

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
