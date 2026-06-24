import { NextRequest, NextResponse } from "next/server";
import { prisma, isDatabaseConfigured } from "@doc-solid/database";
import type { AuthSession, AuthUser } from "@/lib/auth/types";

export const SESSION_COOKIE = "doc-solid-session";
const SESSION_DAYS = 30;

export function sessionExpiryDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_DAYS);
  return d;
}

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createServerSession(userId: string): Promise<string> {
  const token = generateToken();
  await prisma.authSession.create({
    data: {
      token,
      userId,
      expiresAt: sessionExpiryDate(),
    },
  });
  return token;
}

export async function deleteServerSession(token: string): Promise<void> {
  await prisma.authSession.deleteMany({ where: { token } });
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  await prisma.authSession.deleteMany({ where: { userId } });
}

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function getTokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get(SESSION_COOKIE)?.value ?? null;
}

export async function getAuthUserFromRequest(req: NextRequest): Promise<{
  user: AuthUser;
  session: AuthSession;
  token: string;
} | null> {
  if (!isDatabaseConfigured()) return null;

  const token = getTokenFromRequest(req);
  if (!token) return null;

  const record = await prisma.authSession.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!record || record.expiresAt < new Date()) {
    if (record) await prisma.authSession.delete({ where: { id: record.id } }).catch(() => null);
    return null;
  }

  const user = record.user;
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? "",
      createdAt: user.createdAt.toISOString(),
    },
    session: {
      userId: user.id,
      email: user.email,
      name: user.name ?? "",
      expiresAt: record.expiresAt.toISOString(),
    },
  };
}

export async function requireAuth(req: NextRequest): Promise<
  | { ok: true; user: AuthUser; session: AuthSession; token: string }
  | { ok: false; response: NextResponse }
> {
  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Cloud database is not configured. Set DATABASE_URL in production." },
        { status: 503 }
      ),
    };
  }

  const auth = await getAuthUserFromRequest(req);
  if (!auth) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { ok: true, ...auth };
}
