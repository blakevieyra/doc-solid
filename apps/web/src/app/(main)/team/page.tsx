"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { ProfileTeamTab } from "@/components/profile/ProfileTeamTab";
import { JoinTeamSection } from "@/components/team/JoinTeamSection";

function TeamPageContent() {
  return (
    <AppShell title="Team" wide>
      <p className="field-help" style={{ marginBottom: "1.25rem" }}>
        Manage your workspace, members, shared profiles, invites, and document recipients.
      </p>
      <JoinTeamSection />
      <ProfileTeamTab />
    </AppShell>
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={
      <AppShell title="Team" wide>
        <p>Loading team…</p>
      </AppShell>
    }>
      <TeamPageContent />
    </Suspense>
  );
}
