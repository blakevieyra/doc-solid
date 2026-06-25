import type { AppContact, TeamMember, UserProfile } from "@/lib/profile/types";

export type RegisteredContactLookup = {
  email: string;
  name: string;
  username?: string;
  avatarUrl?: string | null;
};

export async function lookupRegisteredContact(
  email: string,
): Promise<{ ok: true; contact: RegisteredContactLookup } | { ok: false; error: string }> {
  const trimmed = email.trim();
  if (!trimmed) return { ok: false, error: "Enter an email address." };

  try {
    const res = await fetch("/api/contacts/lookup", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmed }),
    });
    const data = (await res.json()) as {
      registered?: boolean;
      email?: string;
      name?: string;
      username?: string;
      avatarUrl?: string | null;
      error?: string;
    };
    if (!data.registered || !data.email) {
      return { ok: false, error: data.error ?? "This email is not registered on Doc Solid." };
    }
    return {
      ok: true,
      contact: {
        email: data.email,
        name: data.name ?? data.email.split("@")[0] ?? data.email,
        username: data.username,
        avatarUrl: data.avatarUrl ?? null,
      },
    };
  } catch {
    return { ok: false, error: "Could not verify email. Try again." };
  }
}

export function recipientExistsInProfile(profile: UserProfile, email: string): boolean {
  const key = email.trim().toLowerCase();
  if (!key) return false;
  if (profile.library?.contacts?.some((c) => c.email.toLowerCase() === key)) return true;
  if (profile.team.members.some((m) => m.email.toLowerCase() === key)) return true;
  return false;
}

export function buildAppContact(data: RegisteredContactLookup): AppContact {
  return {
    id: `ct_${Date.now()}`,
    email: data.email,
    name: data.name,
    username: data.username,
    avatarUrl: data.avatarUrl ?? null,
    addedAt: new Date().toISOString(),
  };
}

export function buildTeamMemberFromContact(data: RegisteredContactLookup): TeamMember {
  return {
    id: `tm_${Date.now()}`,
    email: data.email,
    name: data.name,
    username: data.username,
    avatarUrl: data.avatarUrl ?? null,
    role: "editor",
    shareProfile: true,
    invitedAt: new Date().toISOString(),
    acceptedAt: new Date().toISOString(),
    status: "active",
  };
}

export function mergeTeamMember(profile: UserProfile, member: TeamMember): TeamMember[] {
  const key = member.email.toLowerCase();
  return [...profile.team.members.filter((m) => m.email.toLowerCase() !== key), member];
}
