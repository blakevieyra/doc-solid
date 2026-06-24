import { prisma } from "@doc-solid/database";
import { DEFAULT_PROFILE, type UserProfile } from "@/lib/profile/types";
import { generateAccountId } from "@/lib/support/config";
import { hashPassword } from "./password";

function orgSlug(email: string, suffix: string): string {
  const base = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ?? "user";
  return `${base}-${suffix}`.slice(0, 48);
}

export async function registerUser(email: string, password: string, name: string) {
  const normalized = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing) throw new Error("An account with this email already exists");
  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  const passwordHash = await hashPassword(password);
  const accountId = generateAccountId();

  const profile: UserProfile = {
    ...structuredClone(DEFAULT_PROFILE),
    account: {
      ...DEFAULT_PROFILE.account,
      email: normalized,
      displayName: name.trim(),
      accountId,
    },
    personal: {
      ...DEFAULT_PROFILE.personal,
      email: normalized,
    },
  };

  const user = await prisma.user.create({
    data: {
      email: normalized,
      name: name.trim(),
      passwordHash,
      accountData: {
        create: {
          accountId,
          profile: profile as object,
        },
      },
      memberships: {
        create: {
          role: "OWNER",
          organization: {
            create: {
              name: `${name.trim()}'s Workspace`,
              slug: orgSlug(normalized, Date.now().toString(36)),
              email: normalized,
            },
          },
        },
      },
    },
    include: {
      accountData: true,
      memberships: { include: { organization: true } },
    },
  });

  return user;
}

export async function authenticateUser(email: string, password: string) {
  const { verifyPassword } = await import("./password");
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user?.passwordHash) throw new Error("Invalid email or password");

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new Error("Invalid email or password");

  return user;
}

export async function getUserPrimaryOrgId(userId: string): Promise<string> {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    orderBy: { joinedAt: "asc" },
  });
  if (!membership) throw new Error("User has no organization");
  return membership.organizationId;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const data = await prisma.userAccountData.findUnique({ where: { userId } });
  if (!data) return null;
  return data.profile as unknown as UserProfile;
}

export async function saveUserProfile(userId: string, profile: UserProfile): Promise<void> {
  await prisma.userAccountData.upsert({
    where: { userId },
    create: {
      userId,
      accountId: profile.account.accountId || generateAccountId(),
      profile: profile as object,
    },
    update: { profile: profile as object },
  });
}

export async function deleteUserAccount(userId: string): Promise<void> {
  await prisma.user.delete({ where: { id: userId } });
}
