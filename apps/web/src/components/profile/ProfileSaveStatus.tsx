"use client";

import { useProfile } from "@/components/ProfileProvider";

export function ProfileSaveStatus() {
  const { saveStatus } = useProfile();

  return (
    <div className="profile-save-status" aria-live="polite">
      <span className="profile-save-status-hint">
        Changes save automatically as you type — no Save button needed.
      </span>
      {saveStatus === "saving" && (
        <span className="profile-save-status-badge saving">Saving…</span>
      )}
      {saveStatus === "saved" && (
        <span className="profile-save-status-badge saved">Saved to your account</span>
      )}
      {saveStatus === "local-only" && (
        <span className="profile-save-status-badge local-only">Saved on this device only</span>
      )}
    </div>
  );
}
