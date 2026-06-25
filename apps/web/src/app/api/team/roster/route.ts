import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@doc-solid/database";
import { requireAuth } from "@/lib/server/session";
import { getUserProfile } from "@/lib/server/users";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getTeamRoster, saveTeamRoster, mapDbRole, resolveTeamRoster, type TeamRoster, type TeamRosterMember } from "@/lib/server/team-roster";
import { getPendingInvitesForTeam } from "@/lib/server/team-member-invites";
import { loadPublicIdentityForEmail } from "@/lib/server/public-identity";
import { mergeMemberRole, mergeMemberStatus } from "@/lib/team/member-merge-utils";
import {
  ownerProfileNeedsRosterHeal,
  syncOwnerProfileFromRoster,
} from "@/lib/server/team-profile-sync";
import type { TeamRole, UserProfile } from "@/lib/profile/types";
import { formatAddress } from "@/lib/profile/types";
import type { TeamSharedProfile } from "@/lib/profile/document-branding";

export const runtime = "nodejs";

export interface TeamMemberView {
  id: string;
  email: string;
  name: string;
  username?: string;
  avatarUrl?: string | null;
  role: TeamRole;
  joinedAt: string;
  isYou: boolean;
  status?: "pending" | "active";
}

export interface TeamView {
  source: "roster" | "organization" | "local";
  teamId: string | null;
  orgName: string;
  ownerEmail: string | null;
  ownerName: string | null;
  myRole: TeamRole;
  isOwner: boolean;
  shareBusinessProfile: boolean;
  shareOrganizationProfile: boolean;
  createdAt: string | null;
  sharedProfile: TeamSharedProfile | null;
  members: TeamMemberView[];
}

function memberId(email: string): string {
  return `tm_${email.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
}

function toMemberViews(
  members: Array<{
    email: string;
    name: string;
    role: TeamRole;
    joinedAt: string;
    status?: "pending" | "active";
    username?: string;
    avatarUrl?: string | null;
  }>,
  selfEmail: string
): TeamMemberView[] {
  return members.map((m) => ({
    id: memberId(m.email),
    email: m.email,
    name: m.name,
    username: m.username,
    avatarUrl: m.avatarUrl,
    role: m.role,
    joinedAt: m.joinedAt,
    isYou: m.email.toLowerCase() === selfEmail.toLowerCase(),
    status: m.status ?? "active",
  }));
}

function toSharedProfile(profile: UserProfile, orgName: string): TeamSharedProfile {
  return {
    orgName,
    business: {
      name: profile.business.name,
      tagline: profile.business.tagline,
      phone: profile.business.phone,
      email: profile.business.email,
      logo: profile.business.logo,
      address: formatAddress(profile.business.address),
    },
    organization: {
      name: profile.organization.name,
      mission: profile.organization.mission,
      phone: profile.organization.phone,
      email: profile.organization.email,
      logo: profile.organization.logo,
      address: formatAddress(profile.organization.address),
    },
  };
}

async function loadOwnerSharedProfile(ownerEmail: string | null, orgName: string): Promise<TeamSharedProfile | null> {
  if (!ownerEmail) return null;
  const owner = await prisma.user.findUnique({
    where: { email: ownerEmail.toLowerCase() },
  });
  if (!owner) return null;
  const profile = await getUserProfile(owner.id);
  if (!profile) return null;
  return toSharedProfile(profile, orgName);
}

function fromProfileTeam(profile: UserProfile, selfEmail: string, selfName: string): TeamView {
  const ownerEmail =
    profile.team.ownerEmail ??
    profile.team.members.find((m) => m.role === "owner")?.email ??
    null;
  const isOwner = ownerEmail?.toLowerCase() === selfEmail.toLowerCase();
  const myMember = profile.team.members.find((m) => m.email.toLowerCase() === selfEmail.toLowerCase());

  return {
    source: "local",
    teamId: profile.team.teamId ?? profile.account.accountId ?? null,
    orgName: profile.team.orgName || profile.business.name || profile.organization.name || "My Team",
    ownerEmail: ownerEmail ?? (isOwner ? selfEmail : null),
    ownerName: profile.team.ownerName ?? profile.team.members.find((m) => m.role === "owner")?.name ?? (isOwner ? selfName : null),
    myRole: myMember?.role ?? (isOwner ? "owner" : "editor"),
    isOwner,
    shareBusinessProfile: profile.team.shareBusinessProfile,
    shareOrganizationProfile: profile.team.shareOrganizationProfile,
    createdAt: profile.team.createdAt ?? profile.createdAt ?? null,
    sharedProfile: null,
    members: toMemberViews(
      profile.team.members.map((m) => ({
        email: m.email,
        name: m.name,
        username: m.username,
        avatarUrl: m.avatarUrl,
        role: m.role,
        joinedAt: m.acceptedAt ?? m.invitedAt,
        status: m.status ?? (m.acceptedAt ? "active" : "pending"),
      })),
      selfEmail
    ),
  };
}

function fromRoster(roster: TeamRoster, selfEmail: string): TeamView {
  const isOwner = roster.ownerEmail.toLowerCase() === selfEmail.toLowerCase();
  const myMember = roster.members.find((m) => m.email.toLowerCase() === selfEmail.toLowerCase());

  return {
    source: "roster",
    teamId: roster.teamId,
    orgName: roster.orgName,
    ownerEmail: roster.ownerEmail,
    ownerName: roster.ownerName,
    myRole: myMember?.role ?? (isOwner ? "owner" : "editor"),
    isOwner,
    shareBusinessProfile: roster.shareBusinessProfile,
    shareOrganizationProfile: roster.shareOrganizationProfile,
    createdAt: roster.createdAt ?? null,
    sharedProfile: null,
    members: toMemberViews(roster.members, selfEmail),
  };
}

async function fromOrganization(userId: string, selfEmail: string, selfName: string): Promise<TeamView | null> {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: {
      organization: {
        include: {
          members: {
            include: { user: true },
            orderBy: { joinedAt: "asc" },
          },
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  if (!membership) return null;

  const org = membership.organization;
  const ownerMembership =
    org.members.find((m) => m.role === "OWNER") ?? org.members[0];
  const ownerUser = ownerMembership?.user;
  const isOwner = membership.role === "OWNER";

  const members = org.members.map((m) => ({
    email: m.user.email,
    name: m.user.name ?? m.user.email.split("@")[0] ?? m.user.email,
    role: mapDbRole(m.role),
    joinedAt: m.joinedAt.toISOString(),
  }));

  return {
    source: "organization",
    teamId: org.id,
    orgName: org.name,
    ownerEmail: ownerUser?.email ?? null,
    ownerName: ownerUser?.name ?? null,
    myRole: mapDbRole(membership.role),
    isOwner,
    shareBusinessProfile: true,
    shareOrganizationProfile: true,
    createdAt: org.createdAt.toISOString(),
    sharedProfile: null,
    members: toMemberViews(members, selfEmail),
  };
}

function mergeMemberLists(
  ownerEmail: string | null | undefined,
  ...lists: Array<Array<{
    email: string;
    name: string;
    role: TeamRole;
    joinedAt: string;
    status?: "pending" | "active";
    username?: string;
    avatarUrl?: string | null;
  }>>
): Array<{
  email: string;
  name: string;
  role: TeamRole;
  joinedAt: string;
  status?: "pending" | "active";
  username?: string;
  avatarUrl?: string | null;
}> {
  const byEmail = new Map<string, {
    email: string;
    name: string;
    role: TeamRole;
    joinedAt: string;
    status?: "pending" | "active";
    username?: string;
    avatarUrl?: string | null;
  }>();
  for (const list of lists) {
    for (const m of list) {
      const key = m.email.toLowerCase();
      const prev = byEmail.get(key);
      const joinedAt = prev?.joinedAt && prev.joinedAt <= m.joinedAt ? prev.joinedAt : m.joinedAt;
      const status = mergeMemberStatus(
        m.status,
        prev?.status,
        m.status === "active" || prev?.status === "active" ? joinedAt : undefined
      );
      byEmail.set(key, {
        email: m.email,
        name: m.name || prev?.name || m.email,
        role: mergeMemberRole(key, ownerEmail, m.role, prev?.role),
        joinedAt,
        status,
        username: m.username ?? prev?.username,
        avatarUrl: m.avatarUrl ?? prev?.avatarUrl ?? null,
      });
    }
  }
  return [...byEmail.values()].sort((a, b) => {
    if (a.role === "owner") return -1;
    if (b.role === "owner") return 1;
    return a.joinedAt.localeCompare(b.joinedAt);
  });
}

async function enrichMembersWithIdentity<T extends {
  email: string;
  name: string;
  username?: string;
  avatarUrl?: string | null;
}>(members: T[]): Promise<T[]> {
  return Promise.all(
    members.map(async (m) => {
      const identity = await loadPublicIdentityForEmail(m.email).catch(() => null);
      if (!identity) return m;
      return {
        ...m,
        name: identity.name || m.name,
        username: identity.username ?? m.username,
        avatarUrl: identity.avatarUrl ?? m.avatarUrl ?? null,
      };
    })
  );
}

async function buildTeamView(userId: string, email: string, name: string): Promise<TeamView> {
  let profile = (await getUserProfile(userId)) ?? null;
  const roster = await resolveTeamRoster(profile, email, userId);

  if (
    roster &&
    profile &&
    roster.ownerEmail.toLowerCase() === email.toLowerCase() &&
    ownerProfileNeedsRosterHeal(roster, profile.team.members)
  ) {
    await syncOwnerProfileFromRoster(roster);
    profile = (await getUserProfile(userId)) ?? profile;
  }

  const teamId =
    roster?.teamId ??
    profile?.team.teamId ??
    profile?.account.accountId ??
    userId ??
    null;
  const orgView = await fromOrganization(userId, email, name);
  const profileView = profile ? fromProfileTeam(profile, email, name) : null;

  const rosterMembers = roster?.members.map((m) => ({
    email: m.email,
    name: m.name,
    role: m.role,
    joinedAt: m.joinedAt,
    status: "active" as const,
  })) ?? [];

  const profileMembers =
    profile?.team.members.map((m) => ({
      email: m.email,
      name: m.name,
      username: m.username,
      avatarUrl: m.avatarUrl,
      role: m.role,
      joinedAt: m.acceptedAt ?? m.invitedAt,
      status: (m.status ?? (m.acceptedAt ? "active" : "pending")) as "pending" | "active",
    })) ?? [];

  const contactMembers =
    profile?.library?.contacts.map((c) => ({
      email: c.email,
      name: c.name,
      username: c.username,
      avatarUrl: c.avatarUrl,
      role: "editor" as TeamRole,
      joinedAt: c.addedAt,
    })) ?? [];

  const orgMembers = orgView?.members.map((m) => ({
    email: m.email,
    name: m.name,
    role: m.role,
    joinedAt: m.joinedAt,
  })) ?? [];

  const ownerEmail =
    roster?.ownerEmail ??
    profile?.team.ownerEmail ??
    profileMembers.find((m) => m.role === "owner")?.email ??
    email;

  const mergedMembers = mergeMemberLists(
    ownerEmail,
    orgMembers,
    profileMembers,
    contactMembers,
    rosterMembers
  );

  const rosterEmails = new Set(rosterMembers.map((m) => m.email.toLowerCase()));
  for (let i = mergedMembers.length - 1; i >= 0; i--) {
    const m = mergedMembers[i];
    const key = m.email.toLowerCase();
    const onRoster = rosterEmails.has(key);
    if (onRoster) {
      const rosterRow = rosterMembers.find((r) => r.email.toLowerCase() === key)!;
      mergedMembers[i] = {
        ...m,
        role: mergeMemberRole(key, ownerEmail, rosterRow.role, m.role),
        status: "active",
        name: m.name || rosterRow.name,
      };
    }
  }

  const pendingInvites = teamId ? await getPendingInvitesForTeam(teamId) : [];
  for (const invite of pendingInvites) {
    const key = invite.inviteeEmail.toLowerCase();
    if (rosterEmails.has(key) || mergedMembers.some((m) => m.email.toLowerCase() === key)) continue;
    mergedMembers.push({
      email: invite.inviteeEmail,
      name: invite.inviteeName,
      role: invite.role,
      joinedAt: invite.createdAt,
      status: "pending",
    });
  }

  let base: TeamView;
  if (roster && roster.members.length > 0) {
    base = fromRoster(roster, email);
  } else if (profileView && profileMembers.length > 0) {
    base = profileView;
  } else if (orgView && orgMembers.length > 0) {
    base = orgView;
  } else {
    base = {
      source: "local",
      teamId,
      orgName: profile?.team.orgName || profile?.business.name || name + "'s Workspace",
      ownerEmail: email,
      ownerName: name,
      myRole: "owner",
      isOwner: true,
      shareBusinessProfile: profile?.team.shareBusinessProfile ?? true,
      shareOrganizationProfile: profile?.team.shareOrganizationProfile ?? true,
      createdAt: profile?.team.createdAt ?? profile?.createdAt ?? null,
      sharedProfile: null,
      members: [],
    };
  }

  const membersForView =
    mergedMembers.length > 0
      ? await enrichMembersWithIdentity(mergedMembers)
      : [{ email, name, role: "owner" as TeamRole, joinedAt: profile?.createdAt ?? new Date().toISOString() }];

  const createdAt =
    roster?.createdAt ??
    orgView?.createdAt ??
    profile?.team.createdAt ??
    profile?.createdAt ??
    membersForView.reduce(
      (min, m) => (m.joinedAt < min ? m.joinedAt : min),
      membersForView[0]?.joinedAt ?? new Date().toISOString()
    );

  const source: TeamView["source"] =
    rosterMembers.length > 0 && rosterMembers.length >= profileMembers.length
      ? "roster"
      : profileMembers.length > orgMembers.length
        ? "local"
        : base.source;

  return {
    ...base,
    source,
    teamId: teamId ?? base.teamId,
    orgName: roster?.orgName || profile?.team.orgName || base.orgName,
    ownerEmail: roster?.ownerEmail ?? profile?.team.ownerEmail ?? base.ownerEmail,
    ownerName: roster?.ownerName ?? profile?.team.ownerName ?? base.ownerName,
    createdAt,
    sharedProfile: null,
    members: toMemberViews(membersForView, email),
  };
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const rl = await enforceRateLimit(req, "team-roster-get", 120, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let team = await buildTeamView(auth.user.id, auth.user.email, auth.user.name);

  let sharedProfile: TeamSharedProfile | null = null;
  if (
    !team.isOwner &&
    team.ownerEmail &&
    (team.shareBusinessProfile || team.shareOrganizationProfile)
  ) {
    sharedProfile = await loadOwnerSharedProfile(team.ownerEmail, team.orgName);
  }

  let teamWithShared = { ...team, sharedProfile };

  const ownerProfile = teamWithShared.isOwner ? await getUserProfile(auth.user.id) : null;
  const roster = teamWithShared.teamId
    ? (await resolveTeamRoster(ownerProfile, auth.user.email, auth.user.id)) ??
      (await getTeamRoster(teamWithShared.teamId))
    : null;
  if (
    roster &&
    ownerProfile &&
    ownerProfileNeedsRosterHeal(roster, ownerProfile.team.members)
  ) {
    await syncOwnerProfileFromRoster(roster);
    team = await buildTeamView(auth.user.id, auth.user.email, auth.user.name);
    if (
      !team.isOwner &&
      team.ownerEmail &&
      (team.shareBusinessProfile || team.shareOrganizationProfile)
    ) {
      sharedProfile = await loadOwnerSharedProfile(team.ownerEmail, team.orgName);
    } else {
      sharedProfile = null;
    }
    teamWithShared = { ...team, sharedProfile };
  }

  if (teamWithShared.isOwner && teamWithShared.teamId && teamWithShared.members.length > 0) {
    const existing = roster ?? (await getTeamRoster(teamWithShared.teamId!));
    const existingEmails = new Set((existing?.members ?? []).map((m) => m.email.toLowerCase()));
    const mergedEmails = new Set(teamWithShared.members.map((m) => m.email.toLowerCase()));
    const needsHeal =
      !existing ||
      existing.members.length < teamWithShared.members.length ||
      [...mergedEmails].some((e) => !existingEmails.has(e));

    if (needsHeal) {
      await saveTeamRoster({
        teamId: teamWithShared.teamId!,
        orgName: teamWithShared.orgName,
        ownerEmail: (teamWithShared.ownerEmail ?? auth.user.email).toLowerCase(),
        ownerName: teamWithShared.ownerName ?? auth.user.name,
        shareBusinessProfile: teamWithShared.shareBusinessProfile,
        shareOrganizationProfile: teamWithShared.shareOrganizationProfile,
        createdAt: teamWithShared.createdAt ?? existing?.createdAt,
        members: teamWithShared.members
          .filter((m) => m.status !== "pending")
          .map((m) => ({
            email: m.email.toLowerCase(),
            name: m.name,
            role: m.role,
            joinedAt: m.joinedAt,
          })),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return NextResponse.json({ team: teamWithShared });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const rl = await enforceRateLimit(req, "team-roster-put", 60, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = (await req.json()) as {
    teamId?: string;
    orgName?: string;
    ownerName?: string;
    ownerEmail?: string;
    shareBusinessProfile?: boolean;
    shareOrganizationProfile?: boolean;
    members?: TeamRosterMember[];
  };

  if (!body.teamId?.trim() || !body.orgName?.trim()) {
    return NextResponse.json({ error: "teamId and orgName are required" }, { status: 400 });
  }

  const ownerEmail = (body.ownerEmail ?? auth.user.email).trim().toLowerCase();
  if (ownerEmail !== auth.user.email.toLowerCase()) {
    return NextResponse.json({ error: "Only the team owner can update the roster" }, { status: 403 });
  }

  const existing = await getTeamRoster(body.teamId);
  const incoming = (body.members ?? []).map((m) => ({
    email: m.email.trim().toLowerCase(),
    name: m.name.trim(),
    role: m.role,
    joinedAt: m.joinedAt,
    userId: m.userId,
  }));

  const mergedByEmail = new Map<string, TeamRosterMember>();
  for (const m of existing?.members ?? []) {
    mergedByEmail.set(m.email.toLowerCase(), m);
  }
  for (const m of incoming) {
    const key = m.email.toLowerCase();
    const prev = mergedByEmail.get(key);
    mergedByEmail.set(key, {
      email: m.email,
      name: m.name || prev?.name || m.email,
      role: m.role,
      joinedAt: prev?.joinedAt ?? m.joinedAt,
      userId: m.userId ?? prev?.userId,
    });
  }

  const members = [...mergedByEmail.values()];

  const ownerPresent = members.some(
    (m) => m.email === ownerEmail && m.role === "owner"
  );
  if (!ownerPresent) {
    members.unshift({
      email: ownerEmail,
      name: body.ownerName?.trim() || auth.user.name,
      role: "owner",
      joinedAt: existing?.members.find((m) => m.email === ownerEmail)?.joinedAt ?? new Date().toISOString(),
      userId: auth.user.id,
    });
  }

  const roster: TeamRoster = {
    teamId: body.teamId.trim(),
    orgName: body.orgName.trim(),
    ownerEmail,
    ownerName: body.ownerName?.trim() || auth.user.name,
    shareBusinessProfile: body.shareBusinessProfile ?? existing?.shareBusinessProfile ?? true,
    shareOrganizationProfile: body.shareOrganizationProfile ?? existing?.shareOrganizationProfile ?? true,
    members,
    updatedAt: new Date().toISOString(),
  };

  await saveTeamRoster(roster);
  return NextResponse.json({ team: fromRoster(roster, auth.user.email) });
}
