"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IndexedDBStorage, type LocalDocument } from "@doc-solid/storage";
import { generateTemplate, getDocumentById } from "@doc-solid/documents";
import { AppShell } from "@/components/AppShell";
import { DocumentPreview } from "@/components/DocumentPreview";
import { EmailPacketModal } from "@/components/EmailPacketModal";
import { useProfile } from "@/components/ProfileProvider";
import { useAuth } from "@/components/AuthProvider";
import { useSubscription } from "@/lib/subscription/useSubscription";
import { getProfileFieldValue } from "@/lib/profile/storage";
import type { UserProfile } from "@/lib/profile/types";
import {
  createPacket,
  deletePacket,
  getPackets,
  addTemplateToPacket,
  addSavedDocToPacket,
  removePacketItem,
  movePacketItem,
  normalizePacketItems,
} from "@/lib/documents/packets";
import { exportMultipleElementsPdf, packetPdfFilename } from "@/lib/pdf/exportDocument";
import { getFavoriteTemplateIds } from "@/lib/documents/favorites";

function templateExportId(templateId: string) {
  return `packet-export-tpl-${templateId}`;
}

function savedExportId(localId: string) {
  return `packet-export-doc-${localId}`;
}

function buildTemplateValues(
  templateId: string,
  autofill: Record<string, string>,
  profile: UserProfile
): Record<string, string> {
  const meta = getDocumentById(templateId);
  if (!meta) return { ...autofill };
  const template = generateTemplate(meta);
  const values = { ...autofill };
  for (const section of template.sections) {
    for (const field of section.fields) {
      if (!values[field.id] && field.defaultFromProfile) {
        values[field.id] = getProfileFieldValue(profile, field.defaultFromProfile);
      }
    }
  }
  return values;
}

export default function PacketsPage() {
  const { profile, documentProfile, updateProfile, autofill } = useProfile();
  const { session } = useAuth();
  const { effective, maxPackets, maxPacketItems } = useSubscription();
  const [savedDocs, setSavedDocs] = useState<LocalDocument[]>([]);
  const [activePacketId, setActivePacketId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [msg, setMsg] = useState("");
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showContentsPanel, setShowContentsPanel] = useState(true);

  const packets = getPackets(profile);
  const favorites = getFavoriteTemplateIds(profile);
  const activePacket = packets.find((p) => p.id === activePacketId) ?? packets[0] ?? null;

  const orderedItems = useMemo(
    () => (activePacket ? normalizePacketItems(activePacket) : []),
    [activePacket]
  );

  useEffect(() => {
    const storage = new IndexedDBStorage();
    void storage.getDocumentsForUser(session?.userId ?? null).then(setSavedDocs);
  }, [session?.userId]);

  const exportPreviewIds = useMemo(() => {
    return orderedItems.map((item) =>
      item.type === "template" ? templateExportId(item.id) : savedExportId(item.id)
    );
  }, [orderedItems]);

  const totalItems = orderedItems.length;
  const canExport = totalItems > 0;

  async function handleCreatePacket() {
    setMsg("");
    const result = createPacket(profile, newName);
    if (result.error) {
      setMsg(result.error);
      return;
    }
    if (!result.packet) return;
    await updateProfile({
      library: {
        ...profile.library,
        packets: [...packets, result.packet],
      },
    });
    setNewName("");
    setActivePacketId(result.packet.id);
  }

  async function handleDeletePacket(id: string) {
    if (!confirm("Delete this packet? Items stay in your library.")) return;
    await updateProfile({
      library: { ...profile.library, packets: deletePacket(profile, id) },
    });
    if (activePacketId === id) setActivePacketId(null);
  }

  async function handleAddTemplate(templateId: string) {
    if (!activePacket) return;
    const result = addTemplateToPacket(profile, activePacket.id, templateId);
    if (result.error) {
      setMsg(result.error);
      return;
    }
    setMsg("");
    await updateProfile({ library: { ...profile.library, packets: result.packets } });
  }

  async function handleAddSaved(localId: string) {
    if (!activePacket) return;
    const result = addSavedDocToPacket(profile, activePacket.id, localId);
    if (result.error) {
      setMsg(result.error);
      return;
    }
    setMsg("");
    await updateProfile({ library: { ...profile.library, packets: result.packets } });
  }

  async function waitForPreviews() {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }

  async function handleMoveItem(index: number, direction: "up" | "down") {
    if (!activePacket) return;
    await updateProfile({
      library: {
        ...profile.library,
        packets: movePacketItem(profile, activePacket.id, index, direction),
      },
    });
  }

  async function handleExportPdf() {
    if (!activePacket || !canExport) {
      setMsg("Add at least one template or saved document to download a PDF.");
      return;
    }
    setExporting(true);
    setMsg("");
    try {
      await waitForPreviews();
      await exportMultipleElementsPdf(
        exportPreviewIds,
        packetPdfFilename(activePacket.name),
        { watermark: !effective.isProActive }
      );
    } catch {
      setMsg("PDF export failed. Refresh the page and try again.");
    } finally {
      setExporting(false);
    }
  }

  const limitHint = effective.isProActive
    ? "Pro: unlimited packets and items."
    : `Free: up to ${maxPackets === Infinity ? 3 : maxPackets} packets, ${maxPacketItems === Infinity ? 50 : maxPacketItems} items each.`;

  return (
    <AppShell title="Document Packets" wide>
      <p className="page-lead">
        Group templates and saved files into a packet — then download one combined PDF or email it.
        {" "}{limitHint}
      </p>

      <div className="packets-layout">
        <aside className="card packets-sidebar">
          <h2 className="packets-sidebar-title">Your packets</h2>
          <ul className="packets-list">
            {packets.length === 0 && (
              <li className="packets-empty-hint">No packets yet — create one below.</li>
            )}
            {packets.map((p, index) => {
              const count = normalizePacketItems(p).length;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`packets-list-item${activePacket?.id === p.id ? " active" : ""}`}
                    onClick={() => { setActivePacketId(p.id); setMsg(""); setShowContentsPanel(true); }}
                  >
                    <span className="packets-list-order" aria-hidden="true">{index + 1}</span>
                    <span className="packets-list-item-body">
                      <strong>{p.name}</strong>
                      <span>{count} item{count !== 1 ? "s" : ""}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="packets-create-compact">
            <input
              type="text"
              placeholder="New packet name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newName.trim() && void handleCreatePacket()}
              className="packets-create-input"
            />
            <button
              type="button"
              className="btn btn-primary btn-sm btn-block"
              onClick={() => void handleCreatePacket()}
              disabled={!newName.trim()}
            >
              + Create packet
            </button>
          </div>
        </aside>

        <div className="packets-main">
          {!activePacket ? (
            <div className="card packets-empty-state">
              <h2>Select or create a packet</h2>
              <p>Packets let you bundle invoices, contracts, and other docs for a client, hire, or closing.</p>
            </div>
          ) : (
            <>
              <div className="card packets-header">
                <div className="packets-header-text">
                  <h2>{activePacket.name}</h2>
                  <div className="packets-stat-row">
                    <span className="packets-stat">
                      <strong>{activePacket.templateIds.length}</strong> template{activePacket.templateIds.length !== 1 ? "s" : ""}
                    </span>
                    <span className="packets-stat-sep">·</span>
                    <span className="packets-stat">
                      <strong>{activePacket.savedLocalIds.length}</strong> saved file{activePacket.savedLocalIds.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="packets-export-hint">
                    {canExport
                      ? `Download or email one PDF with ${totalItems} document${totalItems !== 1 ? "s" : ""}. Templates use your profile auto-fill; saved files include filled-in data.`
                      : "Add templates or saved files from My Files to build your packet."}
                  </p>
                </div>
                <div className="packets-toolbar">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleExportPdf()}
                    disabled={exporting || !canExport}
                    title={canExport ? "Download combined PDF" : "Add items first"}
                  >
                    {exporting ? "Preparing PDF…" : effective.isProActive ? "Download PDF" : "Download PDF (watermarked)"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => { setMsg(""); setShowEmail(true); }}
                    disabled={!canExport}
                    title={canExport ? "Email combined PDF" : "Add items first"}
                  >
                    Email packet
                  </button>
                  <button type="button" className="btn btn-danger btn-sm packets-delete-btn" onClick={() => void handleDeletePacket(activePacket.id)}>
                    Delete
                  </button>
                </div>
              </div>

              {msg && <p className="field-error packets-msg">{msg}</p>}

              <section className="card packets-add-panel packets-contents-panel">
                <button
                  type="button"
                  className="packets-add-toggle"
                  onClick={() => setShowContentsPanel((v) => !v)}
                  aria-expanded={showContentsPanel}
                >
                  <span>
                    What&apos;s in this packet
                    <span className="packets-toggle-meta"> · {totalItems} item{totalItems !== 1 ? "s" : ""}</span>
                  </span>
                  <span className="packets-add-toggle-icon">{showContentsPanel ? "−" : "+"}</span>
                </button>

                {showContentsPanel && (
                  <div className="packets-add-body">
                    {totalItems === 0 ? (
                      <p className="packets-empty-items">Nothing added yet. Use the panel below to add favorites or files from My Files.</p>
                    ) : (
                      <ul className="packets-unified-list">
                    {orderedItems.map((item, index) => {
                      if (item.type === "template") {
                        const meta = getDocumentById(item.id);
                        return (
                          <li key={`tpl-${item.id}`} className="packets-unified-item">
                            <span className="packets-item-order" aria-hidden="true">{index + 1}</span>
                            <div className="packets-reorder-col">
                              <button
                                type="button"
                                className="packets-reorder-btn"
                                disabled={index === 0}
                                onClick={() => void handleMoveItem(index, "up")}
                                aria-label="Move up"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                className="packets-reorder-btn"
                                disabled={index === orderedItems.length - 1}
                                onClick={() => void handleMoveItem(index, "down")}
                                aria-label="Move down"
                              >
                                ↓
                              </button>
                            </div>
                            <div className="packets-unified-main">
                              <span className="packets-type-badge">Template</span>
                              <div>
                                <strong>{meta?.name ?? item.id}</strong>
                                <span className="field-help">Profile auto-fill · open editor to customize before saving</span>
                              </div>
                            </div>
                            <div className="packets-item-actions">
                              <Link href={`/documents/${item.id}`} className="btn btn-primary btn-sm">Open & fill</Link>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => void updateProfile({
                                  library: {
                                    ...profile.library,
                                    packets: removePacketItem(profile, activePacket.id, { type: "template", id: item.id }),
                                  },
                                })}
                              >
                                Remove
                              </button>
                            </div>
                          </li>
                        );
                      }

                      const doc = savedDocs.find((d) => d.localId === item.id);
                      if (!doc) return null;
                      const meta = getDocumentById(doc.templateId);
                      return (
                        <li key={`doc-${item.id}`} className="packets-unified-item">
                          <span className="packets-item-order" aria-hidden="true">{index + 1}</span>
                          <div className="packets-reorder-col">
                            <button
                              type="button"
                              className="packets-reorder-btn"
                              disabled={index === 0}
                              onClick={() => void handleMoveItem(index, "up")}
                              aria-label="Move up"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="packets-reorder-btn"
                              disabled={index === orderedItems.length - 1}
                              onClick={() => void handleMoveItem(index, "down")}
                              aria-label="Move down"
                            >
                              ↓
                            </button>
                          </div>
                          <div className="packets-unified-main">
                            <span className="packets-type-badge packets-type-badge-saved">Saved</span>
                            <div>
                              <strong>{doc.title}</strong>
                              <span className="field-help">{meta?.name ?? "Document"} · filled & saved from My Files</span>
                            </div>
                          </div>
                          <div className="packets-item-actions">
                            <Link href={`/portal/view/${doc.localId}`} className="btn btn-secondary btn-sm">View</Link>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => void updateProfile({
                                library: {
                                  ...profile.library,
                                  packets: removePacketItem(profile, activePacket.id, { type: "saved", id: item.id }),
                                },
                              })}
                            >
                              Remove
                            </button>
                          </div>
                        </li>
                      );
                    })}
                      </ul>
                    )}
                  </div>
                )}
              </section>

              <section className="card packets-add-panel">
                <button
                  type="button"
                  className="packets-add-toggle"
                  onClick={() => setShowAddPanel((v) => !v)}
                  aria-expanded={showAddPanel}
                >
                  <span>Add to packet</span>
                  <span className="packets-add-toggle-icon">{showAddPanel ? "−" : "+"}</span>
                </button>

                {showAddPanel && (
                  <div className="packets-add-body">
                    {favorites.length > 0 && (
                      <div className="packets-add-group">
                        <p className="packets-add-label">From favorites</p>
                        <div className="portal-type-chips">
                          {favorites.map((id) => {
                            const meta = getDocumentById(id);
                            if (!meta) return null;
                            const inPacket = activePacket.templateIds.includes(id);
                            return (
                              <button
                                key={id}
                                type="button"
                                className={`portal-type-chip${inPacket ? " active" : ""}`}
                                disabled={inPacket}
                                onClick={() => void handleAddTemplate(id)}
                              >
                                {inPacket ? `${meta.name} ✓` : meta.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {savedDocs.length > 0 ? (
                      <div className="packets-add-group">
                        <p className="packets-add-label">From My Files</p>
                        <ul className="packets-saved-pick-list">
                          {savedDocs.slice(0, 25).map((doc) => {
                            const inPacket = activePacket.savedLocalIds.includes(doc.localId);
                            return (
                              <li key={doc.localId}>
                                <span>{doc.title}</span>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  disabled={inPacket}
                                  onClick={() => void handleAddSaved(doc.localId)}
                                >
                                  {inPacket ? "Added" : "Add"}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ) : (
                      <p className="field-help packets-add-empty">
                        No saved files yet.{" "}
                        <Link href="/documents">Create a document</Link> and save it to My Files, then add it here.
                      </p>
                    )}

                    {favorites.length === 0 && (
                      <p className="field-help packets-add-empty">
                        Star templates on the <Link href="/documents">Documents</Link> page to add them quickly.
                      </p>
                    )}
                  </div>
                )}
              </section>

              {/* Off-screen previews used for PDF export */}
              <div className="packets-export-stack" aria-hidden="true">
                {orderedItems.map((item) => {
                  if (item.type === "template") {
                    const meta = getDocumentById(item.id);
                    const template = meta ? generateTemplate(meta) : null;
                    if (!meta || !template) return null;
                    return (
                      <DocumentPreview
                        key={`export-tpl-${item.id}`}
                        previewId={templateExportId(item.id)}
                        meta={{ ...meta, sections: template.sections }}
                        values={buildTemplateValues(item.id, autofill, documentProfile)}
                        profile={documentProfile}
                      />
                    );
                  }

                  const doc = savedDocs.find((d) => d.localId === item.id);
                  if (!doc) return null;
                  const meta = getDocumentById(doc.templateId);
                  const template = meta ? generateTemplate(meta) : null;
                  if (!meta || !template) return null;
                  return (
                    <DocumentPreview
                      key={`export-doc-${item.id}`}
                      previewId={savedExportId(item.id)}
                      meta={{ ...meta, sections: template.sections }}
                      values={doc.fieldData as Record<string, string>}
                      profile={documentProfile}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {showEmail && activePacket && canExport && (
        <EmailPacketModal
          packetName={activePacket.name}
          previewElementIds={exportPreviewIds}
          onClose={() => setShowEmail(false)}
        />
      )}
    </AppShell>
  );
}
