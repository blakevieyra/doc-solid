"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useProfile } from "./ProfileProvider";

interface DeleteDataModalProps {
  onClose: () => void;
}

export function DeleteDataModal({ onClose }: DeleteDataModalProps) {
  const { deleteAccount, logout } = useAuth();
  const { wipeData } = useProfile();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setError("");
    setLoading(true);
    try {
      await wipeData();
      try {
        await deleteAccount(password);
      } catch {
        logout();
      }
      router.push("/signup");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deletion failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card delete-modal">
        <h2>Delete all data</h2>
        {step === 1 && (
          <>
            <p>This permanently deletes:</p>
            <ul className="delete-list">
              <li>Your profile and business information</li>
              <li>All saved documents</li>
              <li>Team memberships and shares</li>
              <li>Notifications and preferences</li>
              <li>Your account login</li>
            </ul>
            <p className="field-error">This action cannot be undone.</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={() => setStep(2)}>Continue</button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <p>Type <strong>DELETE</strong> to confirm:</p>
            <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" className="delete-confirm-input" />
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button type="button" className="btn btn-danger" disabled={confirmText !== "DELETE"} onClick={() => setStep(3)}>Continue</button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <p>Enter your password to permanently delete your account:</p>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
            {error && <p className="field-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
              <button type="button" className="btn btn-danger" disabled={loading || !password} onClick={handleDelete}>
                {loading ? "Deleting..." : "Delete Everything"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
