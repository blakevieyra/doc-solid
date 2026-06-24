import { getUserProfile } from "@/lib/server/users";
import type { UserProfile } from "@/lib/profile/types";

export function publicIdentityFromProfile(profile: UserProfile | null, fallbackName?: string | null) {
  const username = profile?.personal?.username?.trim() || undefined;
  const avatarUrl =
    profile?.personal?.photo ||
    profile?.business?.logo ||
    profile?.organization?.logo ||
    null;
  const name =
    profile?.account?.displayName ||
    profile?.personal?.fullName ||
    fallbackName?.trim() ||
    undefined;
  return { username, avatarUrl, name };
}

export async function loadPublicIdentityForEmail(email: string) {
  const { prisma } = await import("@doc-solid/database");
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, name: true, avatarUrl: true },
  });
  if (!user) return null;
  const profile = await getUserProfile(user.id);
  const identity = publicIdentityFromProfile(profile, user.name);
  return {
    email: user.email,
    name: identity.name ?? user.name?.trim() ?? user.email.split("@")[0] ?? user.email,
    username: identity.username,
    avatarUrl: identity.avatarUrl ?? user.avatarUrl ?? null,
  };
}
