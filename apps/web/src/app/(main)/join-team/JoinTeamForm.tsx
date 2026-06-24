"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useProfile } from "@/components/ProfileProvider";
import { joinTeamByCode } from "@/lib/team/roster-client";
import { useNotifications } from "@/components/NotificationProvider";
import { BrandLogo } from "@/components/BrandLogo";
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

export function JoinTeamForm() {
  const { profile, updateProfile } = useProfile();
  const { notify } = useNotifications();
  const router = useRouter();
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
      setTimeout(() => router.push("/team"), 1500);
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <BrandLogo href="/" size="xl" className="auth-logo" />
        <h1>Join a team</h1>
        <p className="auth-subtitle">Enter the invite code from your team admin</p>
        <form onSubmit={handleJoin} className="auth-form">
          <div className="field-group">
            <label htmlFor="code">Invite Code</label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="DS-XXXX-XXXX"
              required
              className="invite-code-input"
            />
          </div>
          {error && <p className="field-error">{error}</p>}
          {success && <p className="import-msg">{success}</p>}
          <button type="submit" className="btn btn-primary btn-block" disabled={joining}>
            {joining ? "Joining…" : "Join Team"}
          </button>
        </form>
        <p className="auth-footer">
          <Link href="/documents">← Back to documents</Link>
        </p>
      </div>
    </div>
  );
}
