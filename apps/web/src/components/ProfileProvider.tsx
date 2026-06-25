"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/components/AuthProvider";
import { DEFAULT_PROFILE, type UserProfile } from "@/lib/profile/types";
import {
  loadProfile,
  saveProfile,
  clearProfile,
  exportProfile,
  importProfile,
  importFromCsv,
  resolveOnboardingComplete,
} from "@/lib/profile/storage";
import {
  resolveDocumentProfile,
  buildDocumentAutofill,
  type TeamSharedProfile,
} from "@/lib/profile/document-branding";
import { fetchTeamView } from "@/lib/team/roster-client";
import { fetchServerProfile, pushServerProfile, mergeProfiles } from "@/lib/profile/cloud-sync";
import { addNotification } from "@/lib/notifications/store";
import { hashPin, verifyPin } from "@/lib/profile/security";
import { wipeAllUserData } from "@/lib/data/wipeAll";
import { fetchSubscriptionStatus, applySubscriptionFromStripe } from "@/lib/stripe/sync-client";

interface ProfileContextValue {
  profile: UserProfile;
  /** Org profile for documents — uses team owner's branding when applicable */
  documentProfile: UserProfile;
  loading: boolean;
  locked: boolean;
  saveStatus: "idle" | "saving" | "saved" | "local-only";
  autofill: Record<string, string>;
  updateProfile: (updates: Partial<UserProfile> | ((p: UserProfile) => UserProfile)) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  setPin: (pin: string) => Promise<void>;
  removePin: () => Promise<void>;
  exportData: () => string;
  importData: (json: string) => Promise<void>;
  importCsv: (csv: string) => Promise<void>;
  wipeData: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

function mergeProfilePatch(current: UserProfile, patch: Partial<UserProfile>): UserProfile {
  return {
    ...current,
    ...patch,
    business: patch.business ? { ...current.business, ...patch.business } : current.business,
    personal: patch.personal ? { ...current.personal, ...patch.personal } : current.personal,
    organization: patch.organization ? { ...current.organization, ...patch.organization } : current.organization,
    security: patch.security ? { ...current.security, ...patch.security } : current.security,
    subscription: patch.subscription ? { ...current.subscription, ...patch.subscription } : current.subscription,
    team: patch.team ? { ...current.team, ...patch.team, members: patch.team.members ?? current.team.members } : current.team,
    account: patch.account ? { ...current.account, ...patch.account } : current.account,
    preferences: patch.preferences ? { ...current.preferences, ...patch.preferences } : current.preferences,
    signature: patch.signature ? { ...current.signature, ...patch.signature } : current.signature,
    library: patch.library
      ? {
          ...current.library,
          ...patch.library,
          favoriteTemplateIds: patch.library.favoriteTemplateIds ?? current.library.favoriteTemplateIds,
          packets: patch.library.packets ?? current.library.packets,
          contacts: patch.library.contacts ?? current.library.contacts,
        }
      : current.library,
  };
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { session, authMode, user } = useAuth();
  const userId = session?.userId ?? null;
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [teamShared, setTeamShared] = useState<TeamSharedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [sessionPin, setSessionPin] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<ProfileContextValue["saveStatus"]>("idle");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markSaved = useCallback((status: "saved" | "local-only") => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaveStatus(status);
    savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 4000);
  }, []);

  useEffect(() => {
    setLoading(true);
    async function load() {
      let local = await loadProfile(userId);
      if (session) {
        if (!local.account.email) local.account.email = session.email;
        if (!local.account.displayName) local.account.displayName = session.name;
      }

      const resolveOpts = { userCreatedAt: user?.createdAt ?? null };

      if (authMode === "server" && session) {
        const server = await fetchServerProfile();
        if (server) {
          const merged = mergeProfiles(local, server);
          const logosRecovered =
            (merged.business.logo && !server.business.logo) ||
            (merged.organization.logo && !server.organization.logo);
          local = merged;
          if (logosRecovered) {
            await saveProfile(local, userId, sessionPin ?? undefined);
            await pushServerProfile(local);
          }
        }
      }

      const resolved = resolveOnboardingComplete(local, resolveOpts);
      if (resolved && !local.onboardingComplete) {
        local = { ...local, onboardingComplete: true };
        await saveProfile(local, userId, sessionPin ?? undefined);
        if (authMode === "server" && session) {
          await pushServerProfile(local);
        }
      } else if (
        (local.subscription.status === "active" || local.subscription.status === "trialing") &&
        !local.onboardingComplete
      ) {
        local = { ...local, onboardingComplete: true };
        await saveProfile(local, userId, sessionPin ?? undefined);
        if (authMode === "server" && session) {
          await pushServerProfile(local);
        }
      } else if (authMode === "server" && session) {
        await saveProfile(local, userId, sessionPin ?? undefined);
      }

      setProfile(local);
      setLocked(local.security.pinEnabled && !local.security.lastUnlockedAt);
      setLoading(false);
    }
    void load();
  }, [userId, session, authMode, user?.createdAt]);

  useEffect(() => {
    if (loading || !session) return;

    const customerId = profile.subscription.stripeCustomerId;
    const email = profile.account.email || session.email;
    if (!customerId && !email) return;

    fetchSubscriptionStatus({ customerId, email }).then(async (result) => {
      if (!result?.subscription) return;
      setProfile((prev) => {
        const resolved = result.subscription;
        const subscription = applySubscriptionFromStripe(prev.subscription, resolved);
        if (
          subscription.plan === prev.subscription.plan &&
          subscription.status === prev.subscription.status &&
          subscription.stripeSubscriptionId === prev.subscription.stripeSubscriptionId
        ) {
          return prev;
        }
        const next = { ...prev, subscription };
        void saveProfile(next, userId, sessionPin ?? undefined);
        if (authMode === "server") void pushServerProfile(next);
        return next;
      });
    }).catch(() => {});
  }, [loading, session, authMode, profile.subscription.stripeCustomerId, profile.account.email, userId, sessionPin]);

  const refreshTeamShared = useCallback(async () => {
    if (authMode !== "server" || !session) {
      setTeamShared(null);
      return;
    }
    const view = await fetchTeamView();
    setTeamShared(view?.sharedProfile ?? null);
  }, [authMode, session]);

  const persist = useCallback(
    async (next: UserProfile, pin?: string) => {
      setSaveStatus("saving");
      let saved: UserProfile;
      try {
        saved = await saveProfile(next, userId, pin ?? sessionPin ?? undefined);
      } catch {
        setSaveStatus("idle");
        addNotification({
          type: "system",
          title: "Could not save profile",
          message: "Your browser storage may be full. Try removing the logo or clearing old data.",
        });
        throw new Error("local profile save failed");
      }

      let final = saved;
      if (authMode === "server") {
        const synced = await pushServerProfile(saved);
        if (synced.ok) {
          final = mergeProfiles(saved, synced.profile);
          if (final.updatedAt !== saved.updatedAt) {
            final = await saveProfile(final, userId, pin ?? sessionPin ?? undefined);
          }
          void refreshTeamShared();
          markSaved("saved");
        } else {
          markSaved("local-only");
          addNotification({
            type: "system",
            title: "Saved on this device",
            message: synced.error,
          });
        }
      } else {
        markSaved("saved");
      }

      setProfile(final);
    },
    [sessionPin, userId, authMode, refreshTeamShared, markSaved]
  );

  const updateProfile = useCallback(
    async (updates: Partial<UserProfile> | ((p: UserProfile) => UserProfile)) => {
      let nextProfile: UserProfile | null = null;
      setProfile((current) => {
        nextProfile =
          typeof updates === "function"
            ? updates(current)
            : mergeProfilePatch(current, updates);
        return nextProfile;
      });
      if (nextProfile) {
        await persist(nextProfile);
      }
    },
    [persist]
  );

  const completeOnboarding = useCallback(async () => {
    let nextProfile: UserProfile | null = null;
    setProfile((current) => {
      nextProfile = { ...current, onboardingComplete: true };
      return nextProfile;
    });
    if (nextProfile) {
      await persist(nextProfile);
    }
  }, [persist]);

  const unlock = useCallback(
    async (pin: string) => {
      if (!profile.security.pinHash) return true;
      const ok = await verifyPin(pin, profile.security.pinHash);
      if (ok) {
        setSessionPin(pin);
        setLocked(false);
        const decrypted = await loadProfile(userId, pin);
        setProfile({ ...decrypted, security: { ...decrypted.security, lastUnlockedAt: new Date().toISOString() } });
      }
      return ok;
    },
    [profile.security.pinHash, userId]
  );

  const setPinFn = useCallback(
    async (pin: string) => {
      const pinHash = await hashPin(pin);
      setSessionPin(pin);
      const next = { ...profile, security: { ...profile.security, pinEnabled: true, pinHash, encryptSensitive: true } };
      await saveProfile(next, userId, pin);
      setProfile(next);
      setLocked(false);
      if (authMode === "server") void pushServerProfile(next);
    },
    [profile, userId, authMode]
  );

  const removePin = useCallback(async () => {
    setSessionPin(null);
    const next = { ...profile, security: { ...profile.security, pinEnabled: false, pinHash: null } };
    await saveProfile(next, userId);
    setProfile(next);
    setLocked(false);
    if (authMode === "server") void pushServerProfile(next);
  }, [profile, userId, authMode]);

  const exportDataFn = useCallback(() => exportProfile(profile), [profile]);
  const importDataFn = useCallback(async (json: string) => { await persist(importProfile(json)); }, [persist]);
  const importCsvFn = useCallback(async (csv: string) => {
    const partial = importFromCsv(csv);
    await persist({
      ...profile,
      business: { ...profile.business, ...partial.business },
      personal: { ...profile.personal, ...partial.personal },
      organization: { ...profile.organization, ...partial.organization },
    });
  }, [profile, persist]);

  const wipeDataFn = useCallback(async () => {
    await wipeAllUserData(userId ?? undefined);
    clearProfile(userId);
    setProfile(structuredClone(DEFAULT_PROFILE));
    setSessionPin(null);
    setLocked(false);
  }, [userId]);

  useEffect(() => {
    void refreshTeamShared();
  }, [refreshTeamShared]);

  const documentProfile = useMemo(
    () => resolveDocumentProfile(profile, teamShared),
    [profile, teamShared]
  );

  const autofill = useMemo(() => buildDocumentAutofill(documentProfile), [documentProfile]);

  const value = useMemo(
    () => ({
      profile,
      documentProfile,
      loading,
      locked,
      saveStatus,
      autofill,
      updateProfile,
      completeOnboarding,
      unlock,
      setPin: setPinFn,
      removePin,
      exportData: exportDataFn,
      importData: importDataFn,
      importCsv: importCsvFn,
      wipeData: wipeDataFn,
    }),
    [
      profile,
      documentProfile,
      loading,
      locked,
      saveStatus,
      autofill,
      updateProfile,
      completeOnboarding,
      unlock,
      setPinFn,
      removePin,
      exportDataFn,
      importDataFn,
      importCsvFn,
      wipeDataFn,
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
