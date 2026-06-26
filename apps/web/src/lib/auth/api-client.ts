import type { AuthSession, AuthUser } from "./types";

const JSON_HEADERS = { "Content-Type": "application/json" };

export class CloudUnavailableError extends Error {
  constructor() {
    super("Cloud database not configured");
    this.name = "CloudUnavailableError";
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json() as { error?: string };
    return data.error ?? "Request failed";
  } catch {
    return "Request failed";
  }
}

export interface SessionResponse {
  user: AuthUser;
  session: AuthSession;
  mode: "server" | "local";
}

export type FetchServerSessionResult =
  | { kind: "session"; data: SessionResponse }
  | { kind: "unauthenticated" }
  | { kind: "unavailable" };

export async function fetchServerSession(): Promise<FetchServerSessionResult> {
  const res = await fetch("/api/auth/session", { credentials: "include", cache: "no-store" });
  if (res.status === 503) return { kind: "unavailable" };
  if (res.status === 401) return { kind: "unauthenticated" };
  if (!res.ok) return { kind: "unavailable" };
  return { kind: "session", data: (await res.json()) as SessionResponse };
}

export async function apiRegister(
  email: string,
  password: string,
  name: string,
  signupToken?: string
): Promise<SessionResponse> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify({ email, password, name, signupToken }),
  });
  if (res.status === 503) throw new CloudUnavailableError();
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<SessionResponse>;
}

export async function apiLogin(email: string, password: string): Promise<SessionResponse> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 503) throw new CloudUnavailableError();
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<SessionResponse>;
}

export async function apiLogout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => null);
}

export async function apiChangePassword(current: string, next: string): Promise<void> {
  const res = await fetch("/api/auth/password", {
    method: "PATCH",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify({ currentPassword: current, newPassword: next }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function apiDeleteAccount(password: string): Promise<void> {
  const res = await fetch("/api/auth/account", {
    method: "DELETE",
    credentials: "include",
    headers: JSON_HEADERS,
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export function isServerAuthMode(mode: SessionResponse["mode"] | undefined): boolean {
  return mode === "server";
}
