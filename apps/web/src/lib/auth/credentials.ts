import { hashPin } from "@/lib/profile/security";
import type { AuthDatabase, AuthSession, AuthUser, StoredUser } from "./types";

const AUTH_DB_KEY = "doc-solid-auth";
const SESSION_KEY = "doc-solid-session";
const SESSION_DAYS = 30;

function loadDb(): AuthDatabase {
  if (typeof window === "undefined") return { users: [] };
  const raw = localStorage.getItem(AUTH_DB_KEY);
  if (!raw) return { users: [] };
  try {
    return JSON.parse(raw) as AuthDatabase;
  } catch {
    return { users: [] };
  }
}

function saveDb(db: AuthDatabase): void {
  localStorage.setItem(AUTH_DB_KEY, JSON.stringify(db));
}

export async function signUp(email: string, password: string, name: string): Promise<AuthUser> {
  const db = loadDb();
  const normalized = email.trim().toLowerCase();
  if (db.users.some((u) => u.email === normalized)) {
    throw new Error("An account with this email already exists");
  }
  if (password.length < 8) throw new Error("Password must be at least 8 characters");

  const user: StoredUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    email: normalized,
    name: name.trim(),
    passwordHash: await hashPin(password + normalized),
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  saveDb(db);
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const db = loadDb();
  const normalized = email.trim().toLowerCase();
  const user = db.users.find((u) => u.email === normalized);
  if (!user) throw new Error("Invalid email or password");

  const hash = await hashPin(password + normalized);
  if (hash !== user.passwordHash) throw new Error("Invalid email or password");

  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt };
}

export function createSession(user: AuthUser): AuthSession {
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_DAYS);
  const session: AuthSession = {
    userId: user.id,
    email: user.email,
    name: user.name,
    expiresAt: expires.toISOString(),
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem("doc-solid-last-user", user.id);
  return session;
}

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as AuthSession;
    if (new Date(session.expiresAt) < new Date()) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const db = loadDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error("User not found");
  const hash = await hashPin(currentPassword + user.email);
  if (hash !== user.passwordHash) throw new Error("Current password is incorrect");
  if (newPassword.length < 8) throw new Error("New password must be at least 8 characters");
  user.passwordHash = await hashPin(newPassword + user.email);
  saveDb(db);
}

export async function deleteAccountAuth(userId: string, password: string): Promise<void> {
  const db = loadDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new Error("User not found");
  const hash = await hashPin(password + user.email);
  if (hash !== user.passwordHash) throw new Error("Incorrect password");
  db.users = db.users.filter((u) => u.id !== userId);
  saveDb(db);
  clearSession();
}
