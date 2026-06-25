"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useProfile } from "@/components/ProfileProvider";
import { createInvite } from "@/lib/team/invites";
import { fetchTeamView, syncTeamRoster, type TeamView } from "@/lib/team/roster-client";
import { roleLabel, mergeTeamMemberDisplays, profileMembersToDisplay, contactsToDisplay } from "@/lib/team/display";
import { TeamMemberIdentity } from "@/components/TeamMemberPickerRow";
import { canUseFeature, maxTeamMembers } from "@/lib/subscription/plans";
import type { AppContact, TeamMember, TeamRole, UserProfile } from "@/lib/profile/types";
import { mergeTeamMembersByEmail } from "@/lib/team/members-merge";
import { generateAccountId } from "@/lib/support/config";

function Field({
  label,
  value,
  onChange,
  type = "text",
  sensitive,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  sensitive?: boolean;
}) {
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={sensitive ? "field-sensitive" : undefined}
      />
    </div>
  );
}

function formatJoined(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function teamViewToMembers(team: TeamView): TeamMember[] {
  return team.members.map((m) => ({
    id: m.id,
    email: m.email,
    name: m.name,
    username: m.username,
    avatarUrl: m.avatarUrl,
    role: m.role,
    shareProfile: true,
    invitedAt: m.joinedAt,
    acceptedAt: m.status === "pending" ? undefined : m.joinedAt,
    status: m.status ?? "active",
  }));
}

function applyTeamView(profile: UserProfile, team: TeamView): UserProfile {
  const ownerEmail = team.ownerEmail ?? profile.team.ownerEmail;
  const members: TeamMember[] = teamViewToMembers(team).map((m) => {
    const role: TeamRole =
      ownerEmail && m.email.toLowerCase() === ownerEmail.toLowerCase()
        ? "owner"
        : m.role === "owner"
          ? "editor"
          : m.role;
    return { ...m, role };
  });
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
      members,
    },
  };
}

export function ProfileTeamTab() {
  const { profile, updateProfile } = useProfile();
  const { session, authMode } = useAuth();
  const teamAllowed = canUseFeature(profile.subscription, "teamSharing");
  const teamLimit = maxTeamMembers(profile.subscription);

  const [teamView, setTeamView] = useState<TeamView | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [inviteCode, setInviteCode] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [memberLookup, setMemberLookup] = useState<{
    email: string;
    name: string;
    username?: string;
    avatarUrl?: string | null;
  } | null>(null);
  const [memberLookupMsg, setMemberLookupMsg] = useState("");
  const [lookingUpMember, setLookingUpMember] = useState(false);
  const [newContactEmail, setNewContactEmail] = useState("");
  const [contactLookupMsg, setContactLookupMsg] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [actionIsError, setActionIsError] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [teamIdCopied, setTeamIdCopied] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);

  const teamId = teamView?.teamId ?? profile.team.teamId ?? profile.account.accountId;
  const teamCreatedAt =
    teamView?.createdAt ??
    profile.team.createdAt ??
    profile.createdAt ??
    null;
  const selfEmail = (session?.email ?? profile.account.email).toLowerCase();
  const isOwner = teamView?.isOwner ?? profile.team.ownerEmail?.toLowerCase() === selfEmail;
  const ownerEmail = teamView?.ownerEmail ?? profile.team.ownerEmail ?? null;
  const displayMembers = useMemo(() => {
    if (teamView?.members?.length) {
      return mergeTeamMemberDisplays(selfEmail, ownerEmail, teamView.members);
    }
    return mergeTeamMemberDisplays(
      selfEmail,
      ownerEmail,
      profileMembersToDisplay(profile, selfEmail),
      contactsToDisplay(profile.library?.contacts ?? [], selfEmail)
    );
  }, [teamView, profile, selfEmail, ownerEmail]);
  const orgName = teamView?.orgName || profile.team.orgName || profile.business.name || profile.organization.name;
  const onTeam = profile.team.enabled || (teamView?.members.length ?? 0) > 1 || !!profile.team.myRole;

  const refreshTeam = useCallback(async () => {
    setLoadingTeam(true);
    try {
      const view = await fetchTeamView();
      if (view) {
        setTeamView(view);
        await updateProfile((current) => {
          if (view.members.length === 0) return current;
          return applyTeamView(current, view);
        });
      }
    } finally {
      setLoadingTeam(false);
    }
  }, [updateProfile, session?.email]);

  function copyTeamId() {
    if (!teamId) return;
    void navigator.clipboard?.writeText(teamId);
    setTeamIdCopied(true);
    setTimeout(() => setTeamIdCopied(false), 2000);
  }

  useEffect(() => {
    void refreshTeam();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function pushRosterMembers(members: TeamMember[]) {
    if (authMode !== "server" || !teamId) return;
    await syncTeamRoster({
      teamId,
      orgName: profile.team.orgName || orgName,
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
    await refreshTeam();
  }

  async function handleGenerateInvite() {
    const invite = await createInvite({
      teamId: teamId || profile.account.accountId,
      orgName: orgName || "My Team",
      inviterName: session?.name ?? profile.account.displayName,
      inviterEmail: session?.email ?? profile.account.email,
      role: "editor",
    });
    setInviteCode(invite.code);
    const link = `${window.location.origin}/join-team?code=${invite.code}`;
    void navigator.clipboard?.writeText(link);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2500);

    if (isOwner && authMode === "server") {
      const ownerEmail = (session?.email ?? profile.account.email).toLowerCase();
      const members = profile.team.members.length
        ? profile.team.members
        : [{
            id: `tm_${Date.now()}`,
            email: ownerEmail,
            name: session?.name ?? profile.account.displayName,
            role: "owner" as TeamRole,
            shareProfile: true,
            invitedAt: new Date().toISOString(),
            acceptedAt: new Date().toISOString(),
          }];
      await pushRosterMembers(members);
    }
  }

  async function ensureTeamId(): Promise<string> {
    const existing =
      teamView?.teamId?.trim() ||
      profile.team.teamId?.trim() ||
      profile.account.accountId?.trim();
    if (existing) return existing;

    const newId = generateAccountId();
    await updateProfile({
      account: { ...profile.account, accountId: newId },
      team: {
        ...profile.team,
        enabled: true,
        teamId: newId,
        orgName: orgName || profile.business.name || profile.organization.name || "My Team",
        myRole: "owner",
      },
    });
    return newId;
  }

  async function lookupMemberByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setMemberLookup(null);
      setMemberLookupMsg("");
      return null;
    }
    setLookingUpMember(true);
    setMemberLookupMsg("");
    try {
      const res = await fetch("/api/contacts/lookup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      const data = await res.json() as {
        registered?: boolean;
        email?: string;
        name?: string;
        username?: string;
        avatarUrl?: string | null;
        error?: string;
      };
      if (!data.registered || !data.email || !data.name) {
        setMemberLookup(null);
        setMemberLookupMsg(data.error ?? "No Doc Solid account found for this email.");
        return null;
      }
      const found = {
        email: data.email,
        name: data.name,
        username: data.username,
        avatarUrl: data.avatarUrl ?? null,
      };
      setMemberLookup(found);
      setMemberLookupMsg("");
      return found;
    } catch {
      setMemberLookup(null);
      setMemberLookupMsg("Could not look up this email. Try again.");
      return null;
    } finally {
      setLookingUpMember(false);
    }
  }

  async function handleInviteMember() {
    if (!newMemberEmail.trim()) return;
    if (displayMembers.filter((m) => m.status !== "pending").length >= teamLimit) {
      alert(`Your plan allows up to ${teamLimit} team members.`);
      return;
    }
    setInviteSending(true);
    setActionMsg("");
    setActionIsError(false);
    try {
      let invitee = memberLookup;
      const normalizedEmail = newMemberEmail.trim().toLowerCase();
      if (!invitee || invitee.email.toLowerCase() !== normalizedEmail) {
        invitee = await lookupMemberByEmail(normalizedEmail);
      }
      if (!invitee) {
        setActionIsError(true);
        setActionMsg(memberLookupMsg || "Enter a registered Doc Solid email address.");
        return;
      }

      const resolvedTeamId = await ensureTeamId();
      const res = await fetch("/api/team/members/invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: resolvedTeamId,
          orgName,
          inviteeEmail: invitee.email,
          role: "editor",
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        emailSent?: boolean;
        inviteLink?: string | null;
        teamId?: string;
        invite?: {
          inviteeEmail?: string;
          inviteeName?: string;
          inviteeUsername?: string;
          inviteeAvatarUrl?: string | null;
        };
      };
      if (!res.ok) throw new Error(data.error ?? "Could not send invite");

      const member: TeamMember = {
        id: `tm_${invitee.email.replace(/[^a-z0-9]/g, "_")}`,
        name: data.invite?.inviteeName ?? invitee.name,
        email: invitee.email,
        username: data.invite?.inviteeUsername ?? invitee.username,
        avatarUrl: data.invite?.inviteeAvatarUrl ?? invitee.avatarUrl,
        role: "editor",
        shareProfile: true,
        invitedAt: new Date().toISOString(),
        status: "pending",
      };
      const next = mergeTeamMembersByEmail(
        profile.team.ownerEmail ?? session?.email ?? profile.account.email,
        profile.team.members,
        [member]
      );
      await updateProfile({
        team: {
          ...profile.team,
          members: next,
          enabled: true,
          teamId: data.teamId ?? resolvedTeamId,
        },
      });
      setNewMemberEmail("");
      setMemberLookup(null);
      setMemberLookupMsg("");
      if (data.emailSent) {
        setActionMsg(`Invite email sent to ${member.name} (${member.email}).`);
      } else if (data.inviteLink) {
        setActionMsg(`Invite saved for ${member.name}. Email could not be sent — share this link: ${data.inviteLink}`);
      } else {
        setActionMsg(`${member.name} invited — they will appear on your team once they accept.`);
      }
      await refreshTeam();
    } catch (err) {
      setActionIsError(true);
      setActionMsg(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setInviteSending(false);
    }
  }

  async function handleLeaveTeam() {
    if (!teamId || isOwner) return;
    if (!window.confirm(`Leave ${orgName}?`)) return;
    try {
      const res = await fetch("/api/team/leave", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not leave team");
      await refreshTeam();
      setActionMsg(`You left ${orgName}.`);
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Could not leave team");
    }
  }

  async function switchActiveTeam(nextTeamId: string) {
    const membership = (profile.team.memberships ?? []).find((m) => m.teamId === nextTeamId);
    if (!membership) return;
    await updateProfile({
      team: {
        ...profile.team,
        teamId: membership.teamId,
        orgName: membership.orgName,
        ownerEmail: membership.ownerEmail,
        ownerName: membership.ownerName,
        myRole: membership.myRole,
      },
    });
    await refreshTeam();
  }

  return (
    <div className="profile-panel card">
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void refreshTeam()} disabled={loadingTeam}>
          {loadingTeam ? "Refreshing…" : "Refresh team"}
        </button>
      </div>

      {actionMsg && <p className={actionIsError ? "field-error" : "field-success"}>{actionMsg}</p>}

      {!loadingTeam && onTeam && (
        <div className="team-summary-card">
          <div className="team-summary-header">
            <div>
              <h4 className="team-summary-name">{orgName}</h4>
              {teamView?.ownerName && !isOwner && (
                <p className="field-help">Team admin: {teamView.ownerName}</p>
              )}
            </div>
            <span className="team-role-badge">{roleLabel(teamView?.myRole ?? profile.team.myRole ?? "editor")}</span>
          </div>
          <dl className="team-summary-meta">
            {teamId && (
              <div className="team-summary-id">
                <dt>Team ID</dt>
                <dd>
                  <code className="team-id-value">{teamId}</code>
                  <button type="button" className="btn btn-secondary btn-sm team-id-copy" onClick={copyTeamId}>
                    {teamIdCopied ? "Copied ✓" : "Copy"}
                  </button>
                </dd>
              </div>
            )}
            {teamCreatedAt && (
              <div>
                <dt>Created</dt>
                <dd>{formatJoined(teamCreatedAt)}</dd>
              </div>
            )}
            {teamView?.ownerEmail && (
              <div>
                <dt>Owner</dt>
                <dd>{teamView.ownerName ? `${teamView.ownerName} · ` : ""}{teamView.ownerEmail}</dd>
              </div>
            )}
            <div>
              <dt>Members</dt>
              <dd>{displayMembers.length}{teamAllowed ? ` / ${teamLimit}` : ""}</dd>
            </div>
            {profile.team.myRole && (
              <div>
                <dt>Your role</dt>
                <dd>{roleLabel(profile.team.myRole)}</dd>
              </div>
            )}
          </dl>
          {!isOwner && onTeam && teamAllowed && (
            <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: "0.75rem" }} onClick={() => void handleLeaveTeam()}>
              Leave team
            </button>
          )}
        </div>
      )}

      {(profile.team.memberships ?? []).length > 1 && (
        <div className="team-memberships-switcher" style={{ marginBottom: "1rem" }}>
          <p className="field-help" style={{ marginBottom: "0.5rem" }}>Your teams</p>
          <div className="portal-type-chips">
            {(profile.team.memberships ?? []).map((m) => (
              <button
                key={m.teamId}
                type="button"
                className={`portal-type-chip${profile.team.teamId === m.teamId ? " active" : ""}`}
                onClick={() => void switchActiveTeam(m.teamId)}
              >
                {m.orgName}
              </button>
            ))}
          </div>
        </div>
      )}

      <h3 className="section-title" style={{ marginTop: onTeam ? "1.5rem" : 0 }}>Team Profile Sharing</h3>
      {!teamAllowed ? (
        <div className="upgrade-notice">
          <p>Team sharing is a Pro feature. Upgrade to share your business profile with team members for consistent auto-fill across documents.</p>
          <Link href="/profile?tab=billing" className="btn btn-primary">View Plans</Link>
        </div>
      ) : (
        <>
          {isOwner ? (
            <>
              <label className="security-toggle">
                <input
                  type="checkbox"
                  checked={profile.team.enabled}
                  onChange={(e) => updateProfile({
                    team: {
                      ...profile.team,
                      enabled: e.target.checked,
                      teamId: profile.team.teamId ?? profile.account.accountId,
                      orgName: profile.team.orgName || profile.business.name || profile.organization.name,
                    },
                  })}
                />
                <div>
                  <strong>Enable team sharing</strong>
                  <span>Share business/org profile with up to {teamLimit} team members</span>
                </div>
              </label>
              {profile.team.enabled && (
                <>
                  <Field
                    label="Team / Org Name"
                    value={profile.team.orgName}
                    onChange={(v) => updateProfile({ team: { ...profile.team, orgName: v } })}
                  />
                  <label className="security-toggle">
                    <input
                      type="checkbox"
                      checked={profile.team.shareBusinessProfile}
                      onChange={(e) => updateProfile({ team: { ...profile.team, shareBusinessProfile: e.target.checked } })}
                    />
                    <div><strong>Share business profile</strong><span>Team uses business info for auto-fill</span></div>
                  </label>
                  <label className="security-toggle">
                    <input
                      type="checkbox"
                      checked={profile.team.shareOrganizationProfile}
                      onChange={(e) => updateProfile({ team: { ...profile.team, shareOrganizationProfile: e.target.checked } })}
                    />
                    <div><strong>Share organization profile</strong><span>Team uses org info for auto-fill</span></div>
                  </label>
                  <div className="team-invite-code-block">
                    <p className="field-help">Share an invite link so colleagues can join your team and receive documents.</p>
                    <div className="team-invite-code-row">
                      {inviteCode && <code className="invite-code-display">{inviteCode}</code>}
                      <button type="button" className="btn btn-secondary" onClick={() => void handleGenerateInvite()}>
                        {inviteCopied ? "Link copied ✓" : inviteCode ? "Copy invite link" : "Generate invite link"}
                      </button>
                    </div>
                  </div>
                  {displayMembers.length < teamLimit && (
                    <div className="team-invite-form">
                      <p className="field-help" style={{ margin: 0 }}>
                        Enter a registered Doc Solid email — we&apos;ll pull their name and photo, then email them an accept link.
                      </p>
                      <Field
                        label="Registered user email"
                        type="email"
                        value={newMemberEmail}
                        onChange={(v) => {
                          setNewMemberEmail(v);
                          setMemberLookup(null);
                          setMemberLookupMsg("");
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={!newMemberEmail.trim() || lookingUpMember}
                        onClick={() => void lookupMemberByEmail(newMemberEmail)}
                      >
                        {lookingUpMember ? "Looking up…" : "Look up user"}
                      </button>
                      {memberLookup && (
                        <div className="team-member-row" style={{ marginTop: "0.25rem" }}>
                          <TeamMemberIdentity
                            recipient={{
                              name: memberLookup.name,
                              email: memberLookup.email,
                              username: memberLookup.username,
                              avatarUrl: memberLookup.avatarUrl,
                              source: "team",
                              role: "editor",
                            }}
                            profile={profile}
                            selfEmail={selfEmail}
                          />
                        </div>
                      )}
                      {memberLookupMsg && <p className="field-error">{memberLookupMsg}</p>}
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={inviteSending || !newMemberEmail.trim() || lookingUpMember}
                        onClick={() => void handleInviteMember()}
                      >
                        {inviteSending ? "Sending…" : memberLookup ? `Send invite to ${memberLookup.name}` : "Send invite email"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <p className="field-help">
              You are a member of <strong>{orgName}</strong>. Team settings are managed by the team owner.
              {" "}
              <Link href="/team#join-team">Join another team</Link>
            </p>
          )}
        </>
      )}

      <h3 className="section-title" style={{ marginTop: "1.5rem" }}>
        Members ({displayMembers.length}{teamAllowed ? `/${teamLimit}` : ""})
      </h3>
      {displayMembers.length === 0 && (
        <p className="field-help">No team members yet. {isOwner ? "Invite colleagues to share your profile." : "Ask your team admin for an invite link."}</p>
      )}
      <ul className="team-member-list">
        {displayMembers.map((m) => (
          <li key={m.id} className="team-member-row">
            <TeamMemberIdentity
              recipient={{
                name: m.name,
                email: m.email,
                username: m.username,
                avatarUrl: m.avatarUrl,
                source: "team",
                role: m.role,
              }}
              profile={profile}
              selfEmail={selfEmail}
            />
            {m.status === "pending" && (
              <span className="share-inbox-badge" style={{ marginLeft: "0.5rem" }}>Request sent</span>
            )}
            {isOwner && teamAllowed && profile.team.enabled && !m.isYou && m.status !== "pending" && (
              <button
                type="button"
                className="line-item-remove"
                onClick={() => {
                  const key = m.email.toLowerCase();
                  const next = profile.team.members.filter((x) => x.email.toLowerCase() !== key);
                  const nextContacts = (profile.library?.contacts ?? []).filter(
                    (x) => x.email.toLowerCase() !== key
                  );
                  void updateProfile({
                    team: { ...profile.team, members: next },
                    library: { ...profile.library, contacts: nextContacts },
                  }).then(() => {
                    void pushRosterMembers(next);
                  });
                }}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>

      <h3 className="section-title" style={{ marginTop: "2rem" }}>Send to your team</h3>
      <p className="field-help" style={{ marginBottom: "0.75rem" }}>
        People you add below appear automatically when you email documents or packets — just open a saved doc or packet and tap <strong>Email</strong>.
      </p>
      {(displayMembers.some((m) => !m.isYou) || (profile.library?.contacts ?? []).length > 0) && (
        <div className="team-send-actions">
          <Link href="/portal" className="btn btn-secondary btn-sm">Open Portal</Link>
          <Link href="/packets" className="btn btn-secondary btn-sm">Open Packets</Link>
        </div>
      )}

      <h3 className="section-title" style={{ marginTop: "1.5rem" }}>Document contacts</h3>
      <p className="field-help" style={{ marginBottom: "1rem" }}>
        Add registered Doc Solid users here. They&apos;ll also be available as email recipients for documents and packets.
      </p>
      {(profile.library?.contacts ?? []).length === 0 && (
        <p className="field-help">No contacts yet.</p>
      )}
      <ul className="team-member-list">
        {(profile.library?.contacts ?? []).map((c) => (
          <li key={c.id} className="team-member-row">
            <TeamMemberIdentity
              recipient={{
                name: c.name,
                email: c.email,
                username: c.username,
                avatarUrl: c.avatarUrl,
                source: "contact",
              }}
              profile={profile}
              selfEmail={selfEmail}
            />
            <button
              type="button"
              className="line-item-remove"
              onClick={() => updateProfile({
                library: {
                  ...profile.library,
                  contacts: (profile.library?.contacts ?? []).filter((x) => x.id !== c.id),
                },
              })}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="team-invite-form" style={{ marginTop: "1rem" }}>
        <Field
          label="Registered user email"
          type="email"
          value={newContactEmail}
          onChange={(v) => { setNewContactEmail(v); setContactLookupMsg(""); }}
        />
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!newContactEmail.trim() || addingContact}
          onClick={async () => {
            setContactLookupMsg("");
            setAddingContact(true);
            try {
              const res = await fetch("/api/contacts/lookup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: newContactEmail.trim() }),
              });
              const data = await res.json() as {
                registered?: boolean;
                email?: string;
                name?: string;
                username?: string;
                avatarUrl?: string | null;
                error?: string;
              };
              if (!data.registered || !data.email) {
                setContactLookupMsg(data.error ?? "This email is not registered on Doc Solid.");
                return;
              }
              const existing = (profile.library?.contacts ?? []).some(
                (c) => c.email.toLowerCase() === data.email!.toLowerCase()
              );
              if (existing) {
                setContactLookupMsg("This contact is already in your list.");
                return;
              }
              const contact: AppContact = {
                id: `ct_${Date.now()}`,
                email: data.email,
                name: data.name ?? data.email.split("@")[0] ?? data.email,
                username: data.username,
                avatarUrl: data.avatarUrl ?? null,
                addedAt: new Date().toISOString(),
              };

              const teamMember: TeamMember = {
                id: `tm_${Date.now()}`,
                email: data.email,
                name: contact.name,
                username: data.username,
                avatarUrl: data.avatarUrl ?? null,
                role: "editor",
                shareProfile: true,
                invitedAt: new Date().toISOString(),
                acceptedAt: new Date().toISOString(),
              };
              const nextMembers = [
                ...profile.team.members.filter((m) => m.email.toLowerCase() !== data.email!.toLowerCase()),
                teamMember,
              ];

              await updateProfile({
                library: {
                  ...profile.library,
                  contacts: [...(profile.library?.contacts ?? []), contact],
                },
                team: {
                  ...profile.team,
                  enabled: true,
                  teamId,
                  members: nextMembers,
                },
              });
              if (authMode === "server") {
                await pushRosterMembers(nextMembers);
              }
              setNewContactEmail("");
              setContactLookupMsg("Contact added.");
              setActionMsg("Contact added — ready to email from any document or packet.");
            } catch {
              setContactLookupMsg("Could not verify email. Try again.");
            } finally {
              setAddingContact(false);
            }
          }}
        >
          {addingContact ? "Checking…" : "Add contact"}
        </button>
        {contactLookupMsg && (
          <p className={contactLookupMsg === "Contact added." ? "field-success" : "field-error"}>{contactLookupMsg}</p>
        )}
      </div>
    </div>
  );
}
