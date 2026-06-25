"use client";

import { useState } from "react";
import { useProfile } from "./ProfileProvider";
import { useAuth } from "./AuthProvider";
import { generateAccountId } from "@/lib/support/config";
import { maxTeamMembers } from "@/lib/subscription/plans";
import { syncTeamRoster } from "@/lib/team/roster-client";
import {
  buildAppContact,
  buildTeamMemberFromContact,
  lookupRegisteredContact,
  mergeTeamMember,
  recipientExistsInProfile,
} from "@/lib/team/recipient-actions";
import type { TeamMember } from "@/lib/profile/types";

export function AddRecipientForm({
  onAdded,
  disabled = false,
  compact = false,
}: {
  onAdded?: (email: string) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { profile, updateProfile } = useProfile();
  const { session, authMode } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"contact" | "invite" | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  const teamLimit = maxTeamMembers(profile.subscription);
  const activeMembers = profile.team.members.filter((m) => m.status !== "pending").length;
  const teamId =
    profile.team.teamId?.trim() ||
    profile.account.accountId?.trim() ||
    "";

  async function ensureTeamId(): Promise<string> {
    const existing = teamId;
    if (existing) return existing;

    const newId = generateAccountId();
    await updateProfile({
      account: { ...profile.account, accountId: newId },
      team: {
        ...profile.team,
        enabled: true,
        teamId: newId,
        orgName: profile.team.orgName || profile.business.name || profile.organization.name || "My Team",
        myRole: profile.team.myRole ?? "owner",
      },
    });
    return newId;
  }

  async function pushRosterMembers(members: TeamMember[], resolvedTeamId: string) {
    if (authMode !== "server" || !resolvedTeamId) return;
    await syncTeamRoster({
      teamId: resolvedTeamId,
      orgName: profile.team.orgName || profile.business.name || "My Team",
      ownerName: session?.name ?? profile.account.displayName,
      ownerEmail: session?.email ?? profile.account.email,
      shareBusinessProfile: profile.team.shareBusinessProfile,
      shareOrganizationProfile: profile.team.shareOrganizationProfile,
      members: members.map((m) => ({
        email: m.email,
        name: m.name,
        role: m.role,
        joinedAt: m.acceptedAt ?? m.invitedAt,
      })),
    });
  }

  async function handleAddContact() {
    setMessage("");
    setIsError(false);
    setBusy("contact");
    try {
      const lookup = await lookupRegisteredContact(email);
      if (!lookup.ok) {
        setIsError(true);
        setMessage(lookup.error);
        return;
      }
      if (recipientExistsInProfile(profile, lookup.contact.email)) {
        setIsError(true);
        setMessage("This person is already in your contacts or team.");
        onAdded?.(lookup.contact.email);
        return;
      }

      const contact = buildAppContact(lookup.contact);
      const teamMember = buildTeamMemberFromContact(lookup.contact);
      const nextMembers = mergeTeamMember(profile, teamMember);
      const resolvedTeamId = await ensureTeamId();

      await updateProfile({
        library: {
          ...profile.library,
          contacts: [...(profile.library?.contacts ?? []), contact],
        },
        team: {
          ...profile.team,
          enabled: true,
          teamId: resolvedTeamId,
          members: nextMembers,
        },
      });

      if (authMode === "server") {
        await pushRosterMembers(nextMembers, resolvedTeamId);
      }

      setEmail("");
      setIsError(false);
      setMessage(`${contact.name} added — select them below to send.`);
      onAdded?.(contact.email);
    } finally {
      setBusy(null);
    }
  }

  async function handleInviteTeam() {
    setMessage("");
    setIsError(false);
    if (activeMembers >= teamLimit) {
      setIsError(true);
      setMessage(`Your plan allows up to ${teamLimit} team members.`);
      return;
    }

    setBusy("invite");
    try {
      const lookup = await lookupRegisteredContact(email);
      if (!lookup.ok) {
        setIsError(true);
        setMessage(lookup.error);
        return;
      }

      const normalized = lookup.contact.email.toLowerCase();
      const alreadyMember = profile.team.members.some(
        (m) => m.email.toLowerCase() === normalized && m.status !== "pending",
      );
      if (alreadyMember) {
        setIsError(true);
        setMessage("They are already on your team. Use Add contact if you only need them as a document contact.");
        onAdded?.(lookup.contact.email);
        return;
      }

      const resolvedTeamId = await ensureTeamId();
      const res = await fetch("/api/team/members/invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: resolvedTeamId,
          orgName: profile.team.orgName || profile.business.name || "My Team",
          inviteeEmail: lookup.contact.email,
          role: "editor",
        }),
      });
      const data = (await res.json()) as { error?: string; emailSent?: boolean };
      if (!res.ok || data.error) {
        setIsError(true);
        setMessage(data.error ?? "Could not send team invite.");
        return;
      }

      setEmail("");
      setIsError(false);
      setMessage(
        data.emailSent
          ? `Team invite sent to ${lookup.contact.name}. They can accept from notifications.`
          : `Invite created for ${lookup.contact.name}. Share the invite from Team if email did not send.`,
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={`add-recipient-form${compact ? " add-recipient-form-compact" : ""}`}>
      {!compact && <p className="add-recipient-form-title">Add recipient</p>}
      <p className="field-help">
        {compact
          ? "Add a registered Doc Solid user by email."
          : "Look up a registered Doc Solid user to add as a document contact or invite to your team."}
      </p>
      <label className="field-group">
        <span>Registered user email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setMessage("");
          }}
          placeholder="name@example.com"
          disabled={disabled || busy !== null}
        />
      </label>
      <div className="add-recipient-form-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={disabled || !email.trim() || busy !== null}
          onClick={() => void handleAddContact()}
        >
          {busy === "contact" ? "Adding…" : "Add contact"}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={disabled || !email.trim() || busy !== null}
          onClick={() => void handleInviteTeam()}
        >
          {busy === "invite" ? "Sending…" : "Invite to team"}
        </button>
      </div>
      {message && (
        <p className={isError ? "field-error" : "field-success"}>{message}</p>
      )}
    </div>
  );
}
