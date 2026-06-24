"use client";

import { AuthProvider } from "@/components/AuthProvider";
import { ProfileProvider } from "@/components/ProfileProvider";
import { NotificationProvider } from "@/components/NotificationProvider";
import { AppGate } from "@/components/AppGate";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProfileProvider>
        <NotificationProvider>
          <AppGate>{children}</AppGate>
        </NotificationProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
