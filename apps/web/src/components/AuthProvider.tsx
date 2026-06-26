"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthSession, AuthUser } from "@/lib/auth/types";
import {
  signIn,
  signUp,
  createSession,
  getSession,
  clearSession,
  changePassword as localChangePassword,
  deleteAccountAuth,
} from "@/lib/auth/credentials";
import {
  apiLogin,
  apiRegister,
  apiLogout,
  apiChangePassword,
  apiDeleteAccount,
  fetchServerSession,
  isServerAuthMode,
  CloudUnavailableError,
} from "@/lib/auth/api-client";
import { wipeAllUserData } from "@/lib/data/wipeAll";

interface AuthContextValue {
  user: AuthUser | null;
  session: AuthSession | null;
  loading: boolean;
  authMode: "server" | "local" | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, signupToken?: string) => Promise<void>;
  logout: () => void;
  changePassword: (current: string, next: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authMode, setAuthMode] = useState<"server" | "local" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      const result = await fetchServerSession();
      if (result.kind === "session" && isServerAuthMode(result.data.mode)) {
        setSession(result.data.session);
        setUser(result.data.user);
        setAuthMode("server");
        clearSession();
        setLoading(false);
        return;
      }
      if (result.kind === "unauthenticated") {
        clearSession();
        setLoading(false);
        return;
      }

      const local = getSession();
      if (local) {
        setSession(local);
        setUser({
          id: local.userId,
          email: local.email,
          name: local.name,
          createdAt: "",
        });
        setAuthMode("local");
      }
      setLoading(false);
    }
    void bootstrap();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const server = await apiLogin(email, password);
      setSession(server.session);
      setUser(server.user);
      setAuthMode("server");
      clearSession();
      return;
    } catch (err) {
      if (!(err instanceof CloudUnavailableError)) throw err;
    }

    const u = await signIn(email, password);
    const s = createSession(u);
    setSession(s);
    setUser(u);
    setAuthMode("local");
  }, []);

  const register = useCallback(async (email: string, password: string, name: string, signupToken?: string) => {
    try {
      const server = await apiRegister(email, password, name, signupToken);
      setSession(server.session);
      setUser(server.user);
      setAuthMode("server");
      clearSession();
      return;
    } catch (err) {
      if (!(err instanceof CloudUnavailableError)) throw err;
    }

    const u = await signUp(email, password, name);
    const s = createSession(u);
    setSession(s);
    setUser(u);
    setAuthMode("local");
  }, []);

  const logout = useCallback(() => {
    void apiLogout();
    clearSession();
    setSession(null);
    setUser(null);
    setAuthMode(null);
  }, []);

  const handleChangePassword = useCallback(async (current: string, next: string) => {
    if (!session) throw new Error("Not signed in");
    if (authMode === "server") {
      await apiChangePassword(current, next);
      return;
    }
    await localChangePassword(session.userId, current, next);
  }, [session, authMode]);

  const deleteAccount = useCallback(async (password: string) => {
    if (!session) throw new Error("Not signed in");
    if (authMode === "server") {
      await apiDeleteAccount(password);
    } else {
      await deleteAccountAuth(session.userId, password);
      await wipeAllUserData(session.userId);
    }
    clearSession();
    setSession(null);
    setUser(null);
    setAuthMode(null);
  }, [session, authMode]);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      authMode,
      login,
      register,
      logout,
      changePassword: handleChangePassword,
      deleteAccount,
    }),
    [user, session, loading, authMode, login, register, logout, handleChangePassword, deleteAccount]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
