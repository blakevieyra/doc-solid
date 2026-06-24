"use client";

import { useCallback, useEffect, useState } from "react";
import { useProfile } from "@/components/ProfileProvider";
import { useNotifications } from "@/components/NotificationProvider";
import { fetchTeamView } from "@/lib/team/roster-client";
import type { TeamRole, UserProfile } from "@/lib/profile/types";

interface PendingInvite {
  id: string;
  teamId: string;
  orgName: string;
  inviterName: string;
  inviterEmail: string;
  role: TeamRole;
  createdAt: string;
}

function applyAcceptedTeam(profile: UserProfile, team: {
  teamId: string;
  orgName: string;
  myRole: TeamRole;
}): UserProfile {
  return {
    ...profile,
    team: {
      ...profile.team,
      enabled: true,
      teamId: team.teamId,
      orgName: team.orgName,
      myRole: team.myRole,
    },
  };
}

export function TeamPendingInvites({ highlightInviteId }: { highlightInviteId?: string | null }) {
  const { updateProfile } = useProfile();
  const { notify, refresh } = useNotifications();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadInvites = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/team/invites/pending", { credentials: "include", cache: "no-store" });
      if (!res.ok) {
        setInvites([]);
        return;
      }
      const data = (await res.json()) as { invites?: PendingInvite[] };
      setInvites(data.invites ?? []);
    } catch {
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  async function respond(inviteId: string, action: "accept" | "decline") {
    setActingId(inviteId);
    setMessage("");
    try {
      const res = await fetch("/api/team/members/respond", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId, action }),
      });
      const data = (await res.json()) as {
        error?: string;
        status?: string;
        team?: { teamId: string; orgName: string; myRole: TeamRole };
      };
      if (!res.ok) throw new Error(data.error ?? "Request failed");

      if (action === "accept" && data.team) {
        await updateProfile((current) => applyAcceptedTeam(current, data.team!));
        const view = await fetchTeamView();
        if (view) {
          await updateProfile((current) => ({
            ...applyAcceptedTeam(current, data.team!),
            team: {
              ...current.team,
              enabled: true,
              teamId: view.teamId,
              orgName: view.orgName,
              ownerEmail: view.ownerEmail,
              ownerName: view.ownerName,
              myRole: view.myRole,
              members: view.members.map((m) => ({
                id: m.id,
                email: m.email,
                name: m.name,
                role: m.role,
                shareProfile: true,
                invitedAt: m.joinedAt,
                acceptedAt: m.joinedAt,
                status: "active" as const,
              })),
            },
          }));
        }
        notify({
          type: "team",
          title: "Joined team",
          message: `You joined ${data.team.orgName}`,
          link: "/team",
        });
        setMessage(`You joined ${data.team.orgName}.`);
      } else {
        setMessage("Invitation declined.");
      }

      refresh();
      await loadInvites();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not update invite");
    } finally {
      setActingId(null);
    }
  }

  if (loading) return null;
  if (invites.length === 0) return null;

  return (
    <section className="card team-pending-invites" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
      <h2 className="section-title" style={{ marginTop: 0 }}>Team invitations</h2>
      <p className="field-help">Accept an invitation to appear on each other&apos;s team lists and share documents.</p>
      {message && <p className="field-success">{message}</p>}
      <ul className="team-pending-invites-list">
        {invites.map((invite) => (
          <li
            key={invite.id}
            className={`team-pending-invite-item${highlightInviteId === invite.id ? " highlighted" : ""}`}
          >
            <div>
              <strong>{invite.orgName}</strong>
              <p className="field-help">
                From {invite.inviterName} · {new Date(invite.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="team-pending-invite-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={actingId === invite.id}
                onClick={() => void respond(invite.id, "accept")}
              >
                {actingId === invite.id ? "…" : "Accept"}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={actingId === invite.id}
                onClick={() => void respond(invite.id, "decline")}
              >
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
