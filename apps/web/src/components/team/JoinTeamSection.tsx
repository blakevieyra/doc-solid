"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useProfile } from "@/components/ProfileProvider";
import { joinTeamByCode } from "@/lib/team/roster-client";
import { useNotifications } from "@/components/NotificationProvider";
import type { TeamRole, UserProfile } from "@/lib/profile/types";
import type { TeamView } from "@/lib/team/roster-client";

function applyTeamView(profile: UserProfile, team: TeamView): UserProfile {
  return {
    ...profile,
    team: {
      ...profile.team,
      enabled: true,
      orgName: team.orgName,
      teamId: team.teamId,
      createdAt: team.createdAt,
      ownerEmail: team.ownerEmail,
      ownerName: team.ownerName,
      myRole: team.myRole,
      shareBusinessProfile: team.shareBusinessProfile,
      shareOrganizationProfile: team.shareOrganizationProfile,
      members: team.members.map((m) => ({
        id: m.id,
        email: m.email,
        name: m.name,
        role: m.role as TeamRole,
        shareProfile: true,
        invitedAt: m.joinedAt,
        acceptedAt: m.joinedAt,
      })),
    },
  };
}

export function JoinTeamSection() {
  const { updateProfile } = useProfile();
  const { notify } = useNotifications();
  const searchParams = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const prefill = searchParams?.get("code");
    if (prefill) setCode(prefill.toUpperCase());
  }, [searchParams]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setJoining(true);
    try {
      const result = await joinTeamByCode(code);
      if ("error" in result) {
        setError(result.error);
        return;
      }

      await updateProfile((current) => applyTeamView(current, result.team));

      notify({
        type: "team",
        title: "Joined team",
        message: `You joined ${result.team.orgName}`,
        link: "/team",
      });

      setSuccess(`Welcome to ${result.team.orgName}!`);
      setCode("");
    } finally {
      setJoining(false);
    }
  }

  return (
    <section id="join-team" className="card team-join-section" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
      <h2 className="section-title" style={{ marginTop: 0 }}>Join a team</h2>
      <p className="field-help">Have an invite code from a colleague? Enter it here to join their workspace.</p>
      <form onSubmit={handleJoin} className="team-join-form">
        <div className="field-group">
          <label htmlFor="team-invite-code">Invite code</label>
          <input
            id="team-invite-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="DS-XXXX-XXXX"
            className="invite-code-input"
          />
        </div>
        {error && <p className="field-error">{error}</p>}
        {success && <p className="field-success">{success}</p>}
        <button type="submit" className="btn btn-secondary" disabled={joining || !code.trim()}>
          {joining ? "Joining…" : "Join with code"}
        </button>
      </form>
    </section>
  );
}
