import type { TeamRole } from "@/lib/profile/types";

import type { TeamSharedProfile } from "@/lib/profile/document-branding";

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

export function dispatchTeamRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("docsolid:team-refresh"));
}

export async function fetchTeamView(): Promise<TeamView | null> {
  const res = await fetch("/api/team/roster", { credentials: "include", cache: "no-store" });
  if (res.status === 401 || res.status === 503) return null;
  if (!res.ok) return null;
  const data = (await res.json()) as { team: TeamView | null };
  return data.team;
}

export async function joinTeamByCode(code: string): Promise<{ team: TeamView } | { error: string }> {
  const res = await fetch("/api/team/join", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: code.trim().toUpperCase() }),
  });
  const data = (await res.json()) as { team?: TeamView; error?: string };
  if (!res.ok) return { error: data.error ?? "Could not join team" };
  if (!data.team) return { error: "Could not join team" };
  return { team: data.team };
}

export async function syncTeamRoster(payload: {
  teamId: string;
  orgName: string;
  ownerName: string;
  ownerEmail: string;
  shareBusinessProfile: boolean;
  shareOrganizationProfile: boolean;
  members: Array<{ email: string; name: string; role: TeamRole; joinedAt: string }>;
}): Promise<boolean> {
  const res = await fetch("/api/team/roster", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.ok;
}
