"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ProfileTeamTab } from "@/components/profile/ProfileTeamTab";
import { JoinTeamSection } from "@/components/team/JoinTeamSection";
import { TeamPendingInvites } from "@/components/team/TeamPendingInvites";
import { GuestAuthGate, GuestSignupBanner } from "@/components/GuestSignupBanner";
import { useAuth } from "@/components/AuthProvider";

function TeamPageInner() {
  const searchParams = useSearchParams();
  const highlightInviteId = searchParams?.get("invite");
  const { session } = useAuth();
  const isGuest = !session;

  return (
    <AppShell title="Team" wide>
      <GuestSignupBanner />
      <p className="field-help" style={{ marginBottom: "1.25rem" }}>
        Manage your workspace, members, shared profiles, invites, and document recipients.
      </p>
      {isGuest ? (
        <GuestAuthGate
          title="Team collaboration requires an account"
          description="Sign up free to invite teammates, share documents, request signatures, and sync your workspace."
        />
      ) : (
        <>
          <TeamPendingInvites highlightInviteId={highlightInviteId} />
          <JoinTeamSection />
          <ProfileTeamTab />
        </>
      )}
    </AppShell>
  );
}

function TeamPageContent() {
  return (
    <Suspense fallback={
      <AppShell title="Team" wide>
        <p>Loading team…</p>
      </AppShell>
    }>
      <TeamPageInner />
    </Suspense>
  );
}

export default function TeamPage() {
  return <TeamPageContent />;
}
