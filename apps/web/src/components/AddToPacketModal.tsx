"use client";

import { useState } from "react";
import Link from "next/link";
import { useProfile } from "./ProfileProvider";
import { useNotifications } from "./NotificationProvider";
import { addSavedDocToPacket, createPacket, getPackets } from "@/lib/documents/packets";

export interface AddToPacketModalProps {
  localId: string;
  documentTitle: string;
  onClose: () => void;
}

export function AddToPacketModal({ localId, documentTitle, onClose }: AddToPacketModalProps) {
  const { profile, updateProfile } = useProfile();
  const { notify } = useNotifications();
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  const packets = getPackets(profile);

  async function persistPackets(nextPackets: ReturnType<typeof getPackets>) {
    await updateProfile({
      library: { ...profile.library, packets: nextPackets },
    });
  }

  async function handleAdd(packetId: string) {
    setError("");
    setAdding(packetId);
    const { packets: next, error: addError } = addSavedDocToPacket(profile, packetId, localId);
    if (addError) {
      setError(addError);
      setAdding(null);
      return;
    }
    await persistPackets(next);
    const packet = next.find((p) => p.id === packetId);
    notify({
      type: "share",
      title: "Added to packet",
      message: `"${documentTitle}" added to ${packet?.name ?? "packet"}`,
    });
    setAdding(null);
    onClose();
  }

  async function handleCreate() {
    setError("");
    const name = newName.trim();
    if (!name) {
      setError("Enter a packet name.");
      return;
    }
    const { packet, error: createError } = createPacket(profile, name);
    if (createError || !packet) {
      setError(createError ?? "Could not create packet.");
      return;
    }
    const withDoc = addSavedDocToPacket(
      { ...profile, library: { ...profile.library, packets: [...getPackets(profile), packet] } },
      packet.id,
      localId
    );
    if (withDoc.error) {
      setError(withDoc.error);
      return;
    }
    await persistPackets(withDoc.packets);
    notify({
      type: "share",
      title: "Packet created",
      message: `"${documentTitle}" added to ${name}`,
    });
    onClose();
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Add to packet</h2>
        <p className="field-help">Add &quot;{documentTitle}&quot; to an existing packet or create a new one.</p>

        {packets.length === 0 ? (
          <p className="field-help">
            No packets yet. Create one below or visit <Link href="/packets">Packets</Link>.
          </p>
        ) : (
          <ul className="team-share-list">
            {packets.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm portal-packet-pick"
                  disabled={adding === p.id}
                  onClick={() => void handleAdd(p.id)}
                >
                  {adding === p.id ? "Adding…" : p.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="field-group" style={{ marginTop: "1rem" }}>
          <label>New packet name</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Tax 2026 bundle"
          />
        </div>

        {error && <p className="field-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!newName.trim()} onClick={() => void handleCreate()}>
            Create & add
          </button>
        </div>
      </div>
    </div>
  );
}
