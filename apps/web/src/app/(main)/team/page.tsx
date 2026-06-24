"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ProfileTeamTab } from "@/components/profile/ProfileTeamTab";
import { JoinTeamSection } from "@/components/team/JoinTeamSection";
import { TeamPendingInvites } from "@/components/team/TeamPendingInvites";

function TeamPageInner() {
  const searchParams = useSearchParams();
  const highlightInviteId = searchParams?.get("invite");

  return (
    <AppShell title="Team" wide>
      <p className="field-help" style={{ marginBottom: "1.25rem" }}>
        Manage your workspace, members, shared profiles, invites, and document recipients.
      </p>
      <TeamPendingInvites highlightInviteId={highlightInviteId} />
      <JoinTeamSection />
      <ProfileTeamTab />
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
