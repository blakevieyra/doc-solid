"use client";



import Link from "next/link";

import { useEffect, useMemo, useState } from "react";

import {

  IndexedDBStorage,

  searchDocuments,

  documentTypeCounts,

  type LocalDocument,

} from "@doc-solid/storage";

import {

  getDocumentById,

  DOCUMENT_CATEGORIES,

  DOCUMENT_DOMAINS,

} from "@doc-solid/documents";

import { AppShell } from "@/components/AppShell";

import { useAuth } from "@/components/AuthProvider";

import { useProfile } from "@/components/ProfileProvider";

import type { DocumentShare } from "@/lib/team/invites";
import {
  getShareAuditLabel,
  keepShare,
  shareWasReturnedBy,
} from "@/lib/team/share-document";
import { loadSharesForRecipient } from "@/lib/team/shares-sync";

const FAVORITES_FILTER = "__favorites__";

type PortalFilter =
  | "all"
  | "types"
  | "waiting_signature"
  | "DRAFT"
  | "FINAL"
  | "ARCHIVED"
  | typeof FAVORITES_FILTER;

import { syncDocumentsFromCloud } from "@/lib/documents/cloud-sync";

import { PortalCompliancePanel, PortalScanButton } from "@/components/PortalCompliancePanel";

import { AISecurityScanModal } from "@/components/AISecurityScanModal";
import { DocumentAuditTrail } from "@/components/DocumentAuditTrail";
import { ReturnShareModal } from "@/components/ReturnShareModal";
import { SendToContactModal } from "@/components/SendToContactModal";
import { AddToPacketModal } from "@/components/AddToPacketModal";
import { canUseFeature } from "@/lib/subscription/plans";
import { archiveSavedDocument, updateSavedDocumentFields } from "@/lib/documents/persist";
import { getFavoriteTemplateIds } from "@/lib/documents/favorites";
import { createDocumentAuditEvent } from "@/lib/documents/audit";



export default function PortalPage() {

  const { session, authMode } = useAuth();

  const { profile } = useProfile();

  const [documents, setDocuments] = useState<LocalDocument[]>([]);

  const [shares, setShares] = useState<DocumentShare[]>([]);

  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");

  const [domain, setDomain] = useState("all");

  const [category, setCategory] = useState("all");

  const [templateId, setTemplateId] = useState("all");

  const [status, setStatus] = useState("all");
  const [portalFilter, setPortalFilter] = useState<PortalFilter>("all");

  const [scanDoc, setScanDoc] = useState<LocalDocument | null>(null);
  const [expandedShares, setExpandedShares] = useState<Record<string, boolean>>({});
  const [returnShare, setReturnShare] = useState<DocumentShare | null>(null);
  const [sendTarget, setSendTarget] = useState<{ doc: LocalDocument; mode: "share" | "signature" } | null>(null);
  const [packetDoc, setPacketDoc] = useState<LocalDocument | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);



  const pro = canUseFeature(profile.subscription, "aiSecurityScan");
  const teamSharing = canUseFeature(profile.subscription, "teamSharing");
  const userEmail = session?.email ?? profile.account.email ?? "";
  const userName = session?.name ?? profile.account.displayName ?? "You";
  const actor = { email: userEmail, name: userName };
  const favoriteTemplateIds = getFavoriteTemplateIds(profile);

  const favoriteSavedDocs = useMemo(
    () =>
      documents
        .filter((d) => favoriteTemplateIds.includes(d.templateId))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [documents, favoriteTemplateIds]
  );



  useEffect(() => {

    async function loadDocs() {

      const storage = new IndexedDBStorage();

      const userId = session?.userId ?? null;



      if (authMode === "server") {

        await syncDocumentsFromCloud(userId);

      }



      const docs = await storage.getDocumentsForUser(userId);

      setDocuments(docs);

      setLoading(false);

    }

    void loadDocs();

    const email = session?.email ?? "";

    if (email) {
      void loadSharesForRecipient(email, authMode ?? "local").then(setShares);
    }

  }, [session?.email, session?.userId, authMode]);

  function refreshShares() {
    const email = session?.email ?? "";
    if (email) void loadSharesForRecipient(email, authMode ?? "local").then(setShares);
  }



  const typeCounts = useMemo(() => documentTypeCounts(documents), [documents]);

  function selectPortalFilter(next: PortalFilter) {
    setPortalFilter(next);
    if (next === "DRAFT" || next === "FINAL" || next === "ARCHIVED") {
      setStatus(next);
      setTemplateId("all");
    } else {
      setStatus("all");
    }
    if (next === FAVORITES_FILTER) {
      setTemplateId(FAVORITES_FILTER);
    } else if (next !== "types") {
      setTemplateId("all");
    }
  }

  const filtered = useMemo(
    () => {
      const effectiveStatus =
        portalFilter === "DRAFT" || portalFilter === "FINAL" || portalFilter === "ARCHIVED"
          ? portalFilter
          : status === "all"
            ? undefined
            : (status as LocalDocument["status"]);

      const base = searchDocuments(documents, {
        query: query || undefined,
        domain: domain === "all" ? undefined : domain,
        category: category === "all" ? undefined : category,
        templateId:
          templateId === "all" || templateId === FAVORITES_FILTER
            ? undefined
            : templateId,
        status: effectiveStatus,
        sortBy: "updatedAt",
        sortDir: "desc",
      });
      if (templateId === FAVORITES_FILTER) {
        return base.filter((d) => favoriteTemplateIds.includes(d.templateId));
      }
      return base;
    },
    [documents, query, domain, category, templateId, status, portalFilter, favoriteTemplateIds]
  );

  const activeShares = useMemo(
    () => shares.filter((s) => !s.completedAt),
    [shares]
  );

  const archivedShares = useMemo(
    () => shares.filter((s) => Boolean(s.completedAt)),
    [shares]
  );

  const waitingSigShares = useMemo(
    () => activeShares.filter((s) => s.shareType === "signature_request"),
    [activeShares]
  );

  const draftCount = useMemo(
    () => documents.filter((d) => d.status === "DRAFT").length,
    [documents]
  );
  const finalCount = useMemo(
    () => documents.filter((d) => d.status === "FINAL").length,
    [documents]
  );
  const archivedDocCount = useMemo(
    () => documents.filter((d) => d.status === "ARCHIVED").length,
    [documents]
  );
  const archivedTotal = archivedDocCount + archivedShares.length;

  const visibleActiveShares = useMemo(() => {
    if (portalFilter === "waiting_signature") return waitingSigShares;
    if (portalFilter === "ARCHIVED") return [];
    return activeShares;
  }, [portalFilter, waitingSigShares, activeShares]);

  const showSharedSection =
    portalFilter === "waiting_signature" ||
    (shares.length > 0 && (portalFilter === "all" || portalFilter === "ARCHIVED"));

  const showFileGrid = portalFilter !== "waiting_signature";



  const usedTemplateIds = useMemo(
    () => Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a]),
    [typeCounts]
  );

  function documentAuditEvents(doc: LocalDocument) {
    if (doc.auditLog?.length) return doc.auditLog;
    const fallback = [];
    if (doc.createdAt) {
      fallback.push({ ...createDocumentAuditEvent("created", actor, "Document created"), timestamp: doc.createdAt });
    }
    fallback.push({ ...createDocumentAuditEvent("saved", actor, `Status: ${doc.status}`), timestamp: doc.updatedAt });
    return fallback;
  }

  async function handleArchiveDocument(doc: LocalDocument) {
    setArchivingId(doc.localId);
    const updated = await archiveSavedDocument(doc.localId, actor);
    if (updated) {
      setDocuments((prev) => prev.map((d) => (d.localId === updated.localId ? updated : d)));
    }
    setArchivingId(null);
  }

  function renderShareItem(s: DocumentShare, archived: boolean) {
    const rowExpanded = expandedShares[s.id] === true;
    const auditLog = s.auditLog ?? [];
    const latestAudit = auditLog[auditLog.length - 1];
    const canOpen = Boolean(s.documentTemplateId && s.fieldDataSnapshot);
    const previewHref = `/portal/view/${s.documentId}?shareId=${s.id}`;
    const signHref =
      canOpen && !archived && s.documentTemplateId
        ? `/documents/${s.documentTemplateId}?localId=${s.documentId}&sign=1&shareId=${s.id}`
        : null;
    const returnedByMe = shareWasReturnedBy(s, userEmail);
    const showReturn =
      !archived &&
      !returnedByMe &&
      (s.shareType === "signature_request" || s.shareType === "review_request");
    const primaryLabel =
      s.shareType === "signature_request"
        ? "Sign"
        : s.shareType === "review_request"
          ? "Review"
          : "Open";
    const primaryHref = signHref ?? (canOpen ? previewHref : null);

    function handleKeep() {
      keepShare(s.id, { email: userEmail, name: userName });
      refreshShares();
    }

    return (
      <li
        key={s.id}
        className={`share-inbox-item share-inbox-item-row${archived ? " share-inbox-item-archived" : ""}${rowExpanded ? " expanded" : ""}`}
      >
        <div className="share-inbox-row">
          <button
            type="button"
            className="share-inbox-expand"
            onClick={() => setExpandedShares((prev) => ({ ...prev, [s.id]: !rowExpanded }))}
            aria-expanded={rowExpanded}
            aria-label={rowExpanded ? "Collapse details" : "Expand details"}
          >
            {rowExpanded ? "▾" : "▸"}
          </button>

          <div className="share-inbox-summary">
            <span className="share-inbox-title-line">
              <strong>{s.documentTitle}</strong>
              {archived && (
                <span className="share-inbox-badge share-inbox-badge-archived">Completed</span>
              )}
              {!archived && s.shareType === "signature_request" && (
                <span className="share-inbox-badge">Signature requested</span>
              )}
              {!archived && s.shareType === "review_request" && (
                <span className="share-inbox-badge">Review requested</span>
              )}
            </span>
            <span className="share-inbox-oneline">
              From {s.fromName} · {new Date(s.createdAt).toLocaleDateString()}
              {latestAudit ? ` · ${getShareAuditLabel(latestAudit)}` : ""}
              {returnedByMe ? " · Returned" : ""}
            </span>
          </div>

          {!archived && (
            <div className="share-inbox-actions">
              {primaryHref ? (
                <Link href={primaryHref} className="btn btn-primary btn-sm">
                  {primaryLabel}
                </Link>
              ) : (
                <span
                  className="btn btn-primary btn-sm"
                  style={{ opacity: 0.45, pointerEvents: "none" }}
                  title="No document snapshot — ask sender to re-send"
                >
                  Unavailable
                </span>
              )}
              {showReturn ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReturnShare(s)}>
                  Return
                </button>
              ) : returnedByMe ? (
                <span className="btn btn-secondary btn-sm" style={{ opacity: 0.45, pointerEvents: "none" }}>
                  Returned
                </span>
              ) : null}
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleKeep}>
                Keep
              </button>
            </div>
          )}
        </div>

        {rowExpanded && (
          <div className="share-inbox-details">
            {s.message && <p className="field-help">{s.message}</p>}
            {archived && s.completedAt && (
              <p className="field-help">
                Completed {new Date(s.completedAt).toLocaleDateString()}
              </p>
            )}
            {latestAudit && (
              <p className="doc-audit-latest">
                <strong>{getShareAuditLabel(latestAudit)}</strong>
                {" · "}
                {new Date(latestAudit.timestamp).toLocaleString()}
                {latestAudit.actorName ? ` · ${latestAudit.actorName}` : ""}
                {latestAudit.details ? ` — ${latestAudit.details}` : ""}
              </p>
            )}
            {auditLog.length > 0 && (
              <ul className="share-audit-log">
                {[...auditLog].reverse().map((event, i) => (
                  <li key={`${event.type}-${event.timestamp}-${i}`}>
                    <strong>{getShareAuditLabel(event)}</strong>
                    {" · "}
                    {new Date(event.timestamp).toLocaleString()}
                    {event.actorName ? ` · ${event.actorName}` : ""}
                    {event.details ? ` — ${event.details}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {!canOpen && (
              <p className="field-help share-resend-hint">
                This share has no saved document snapshot. Ask {s.fromName} to re-send it from My Files using Send.
              </p>
            )}
          </div>
        )}
      </li>
    );
  }



  return (

    <AppShell title="My File Portal" wide>

      <div className="portal-stats-row portal-stats-row-filter">
        <button
          type="button"
          className={`portal-stat card portal-stat-filter${portalFilter === "all" ? " active" : ""}`}
          onClick={() => selectPortalFilter("all")}
        >
          <span className="portal-stat-value">{documents.length}</span>
          <span className="portal-stat-label">Saved documents</span>
        </button>
        <button
          type="button"
          className={`portal-stat card portal-stat-filter${portalFilter === "types" ? " active" : ""}`}
          onClick={() => selectPortalFilter("types")}
        >
          <span className="portal-stat-value">{usedTemplateIds.length}</span>
          <span className="portal-stat-label">Document types</span>
        </button>
        <button
          type="button"
          className={`portal-stat card portal-stat-filter${portalFilter === "waiting_signature" ? " active" : ""}`}
          onClick={() => selectPortalFilter("waiting_signature")}
        >
          <span className="portal-stat-value">{waitingSigShares.length}</span>
          <span className="portal-stat-label">Waiting signature</span>
        </button>
        <button
          type="button"
          className={`portal-stat card portal-stat-filter${portalFilter === "DRAFT" ? " active" : ""}`}
          onClick={() => selectPortalFilter("DRAFT")}
        >
          <span className="portal-stat-value">{draftCount}</span>
          <span className="portal-stat-label">Draft</span>
        </button>
        <button
          type="button"
          className={`portal-stat card portal-stat-filter${portalFilter === "FINAL" ? " active" : ""}`}
          onClick={() => selectPortalFilter("FINAL")}
        >
          <span className="portal-stat-value">{finalCount}</span>
          <span className="portal-stat-label">Final</span>
        </button>
        <button
          type="button"
          className={`portal-stat card portal-stat-filter${portalFilter === "ARCHIVED" ? " active" : ""}`}
          onClick={() => selectPortalFilter("ARCHIVED")}
        >
          <span className="portal-stat-value">{archivedTotal}</span>
          <span className="portal-stat-label">Archived</span>
        </button>
        <Link href="/documents" className="btn btn-primary portal-new-btn">+ New Document</Link>
      </div>

      {showSharedSection && (
        <section className="portal-shares card" style={{ marginBottom: "1.5rem", padding: "1.25rem" }}>
          <h2 className="section-title" style={{ marginTop: 0 }}>Shared with you</h2>

          {portalFilter === "waiting_signature" && waitingSigShares.length === 0 && (
            <p className="field-help">No documents waiting for your signature.</p>
          )}

          {visibleActiveShares.length > 0 && (
            <>
              <h3 className="share-inbox-subtitle">
                {portalFilter === "waiting_signature" ? "Awaiting your signature" : "Active"}
              </h3>
              <ul className="share-inbox-list">
                {visibleActiveShares.map((s) => renderShareItem(s, false))}
              </ul>
            </>
          )}

          {(portalFilter === "all" || portalFilter === "ARCHIVED") && archivedShares.length > 0 && (
            <>
              <h3 className="share-inbox-subtitle share-inbox-subtitle-archived">Completed shares</h3>
              <p className="field-help share-archived-hint">
                Signed and reviewed documents are archived here for your records.
              </p>
              <ul className="share-inbox-list">
                {archivedShares.map((s) => renderShareItem(s, true))}
              </ul>
            </>
          )}
        </section>
      )}

      {portalFilter === "waiting_signature" && waitingSigShares.length > 0 && (
        <p className="field-help" style={{ marginBottom: "1rem" }}>
          Select a document above to sign or preview. Your saved files are hidden while this filter is active.
        </p>
      )}

      <PortalCompliancePanel documents={documents} />



      {(usedTemplateIds.length > 0 || favoriteTemplateIds.length > 0) && showFileGrid && (

        <div className={`portal-type-index card${portalFilter === "types" ? " portal-type-index-highlight" : ""}`} style={{ marginBottom: "1rem", padding: "1rem" }}>

          <div className="portal-type-index-head">
            <h3 className="section-title" style={{ marginTop: 0, fontSize: "0.95rem" }}>By type</h3>
            {favoriteTemplateIds.length > 0 && (
              <Link href="/documents" className="btn btn-secondary btn-sm">Manage favorites</Link>
            )}
          </div>

          <div className="portal-type-chips">

            {favoriteTemplateIds.length > 0 && (
              <button
                type="button"
                className={`portal-type-chip portal-type-chip-fav${portalFilter === FAVORITES_FILTER ? " active" : ""}`}
                onClick={() => selectPortalFilter(portalFilter === FAVORITES_FILTER ? "types" : FAVORITES_FILTER)}
              >
                ★ Favorites ({favoriteSavedDocs.length})
              </button>
            )}

            {usedTemplateIds.map((id) => {

              const meta = getDocumentById(id);

              return (

                <button

                  key={id}

                  type="button"

                  className={`portal-type-chip${templateId === id ? " active" : ""}`}

                  onClick={() => {
                    setPortalFilter("types");
                    setStatus("all");
                    setTemplateId(templateId === id ? "all" : id);
                  }}

                >

                  {meta?.name ?? id} ({typeCounts[id]})

                </button>

              );

            })}

          </div>

          {templateId === FAVORITES_FILTER && favoriteSavedDocs.length === 0 && (
            <div className="portal-type-chips" style={{ marginTop: "0.75rem" }}>
              {favoriteTemplateIds.map((id) => {
                const meta = getDocumentById(id);
                return (
                  <Link key={id} href={`/documents/${id}`} className="portal-type-chip">
                    + {meta?.name ?? id}
                  </Link>
                );
              })}
            </div>
          )}

        </div>

      )}



      {showFileGrid && (
      <>
      <div className="doc-search-bar doc-search-bar-wide">

        <input

          type="search"

          placeholder="Search saved documents by title, number, type, or content…"

          value={query}

          onChange={(e) => setQuery(e.target.value)}

          className="doc-search-input"

        />

        <select value={domain} onChange={(e) => setDomain(e.target.value)} className="doc-filter-select">

          <option value="all">All domains</option>

          {DOCUMENT_DOMAINS.map((d) => (

            <option key={d.id} value={d.id}>{d.label}</option>

          ))}

        </select>

        <select value={category} onChange={(e) => setCategory(e.target.value)} className="doc-filter-select">

          <option value="all">All categories</option>

          {DOCUMENT_CATEGORIES.map((c) => (

            <option key={c.id} value={c.id}>{c.label}</option>

          ))}

        </select>

        <select
          value={status}
          onChange={(e) => {
            const v = e.target.value;
            setStatus(v);
            if (v === "all") setPortalFilter("all");
            else setPortalFilter(v as PortalFilter);
          }}
          className="doc-filter-select"
        >

          <option value="all">All statuses</option>

          <option value="DRAFT">Draft</option>

          <option value="FINAL">Final</option>

          <option value="ARCHIVED">Archived</option>

        </select>

      </div>



      <p className="doc-search-meta" style={{ marginBottom: "1rem" }}>

        Showing {filtered.length} of {documents.length} documents

        {documents.some((d) => d.syncStatus === "LOCAL_ONLY") && " · Pending cloud sync"}

      </p>



      {loading ? (

        <p>Loading...</p>

      ) : documents.length === 0 ? (

        <div className="card" style={{ padding: "3rem", textAlign: "center" }}>

          <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>No documents saved yet.</p>

          <Link href="/documents" className="btn btn-primary">Create your first document</Link>

        </div>

      ) : filtered.length === 0 ? (

        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>

          <p style={{ color: "var(--text-muted)" }}>No documents match your filters.</p>

        </div>

      ) : (

        <div className="portal-files-grid">

          {filtered.map((doc) => {

            const type = getDocumentById(doc.templateId);

            return (

              <article key={doc.localId} className="card portal-file-card">

                <div className="portal-file-card-head">

                  <code className="portal-file-number">{doc.documentNumber ?? "—"}</code>

                  <span className="doc-tag">{doc.status}</span>

                </div>

                <h3 className="portal-file-title">

                  <Link href={`/portal/view/${doc.localId}`}>{doc.title}</Link>

                </h3>

                <p className="portal-file-meta">

                  {type?.name ?? doc.templateId} · {doc.domain ?? type?.domain ?? "—"}

                </p>

                <p className="portal-file-date">{new Date(doc.updatedAt).toLocaleString()}</p>

                <DocumentAuditTrail events={documentAuditEvents(doc)} compact />

                <div className="portal-file-actions">

                  <Link href={`/portal/view/${doc.localId}`} className="btn btn-primary btn-sm">Open</Link>

                  {teamSharing && (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSendTarget({ doc, mode: "share" })}
                      >
                        Send
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSendTarget({ doc, mode: "signature" })}
                      >
                        Sign
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setPacketDoc(doc)}
                  >
                    Packet
                  </button>

                  {doc.status === "FINAL" && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={archivingId === doc.localId}
                      onClick={() => void handleArchiveDocument(doc)}
                    >
                      {archivingId === doc.localId ? "Archiving…" : "Archive"}
                    </button>
                  )}

                  <PortalScanButton doc={doc} pro={pro} onScan={() => setScanDoc(doc)} />

                </div>

              </article>

            );

          })}

        </div>

      )}

      </>
      )}



      {scanDoc && (
        <AISecurityScanModal
          documentTitle={scanDoc.title}
          templateId={scanDoc.templateId}
          values={scanDoc.fieldData as Record<string, string>}
          onClose={() => setScanDoc(null)}
          onRedact={async (redacted) => {
            const updated = await updateSavedDocumentFields(scanDoc.localId, redacted, { actor });
            if (updated) {
              setDocuments((prev) => prev.map((d) => (d.localId === updated.localId ? updated : d)));
            }
            setScanDoc(null);
          }}
        />
      )}

      {returnShare && (
        <ReturnShareModal
          share={returnShare}
          onClose={() => setReturnShare(null)}
          onReturned={refreshShares}
        />
      )}

      {sendTarget && (
        <SendToContactModal
          mode={sendTarget.mode}
          documentTitle={sendTarget.doc.title}
          documentId={sendTarget.doc.localId}
          documentTemplateId={sendTarget.doc.templateId}
          onClose={() => setSendTarget(null)}
        />
      )}

      {packetDoc && (
        <AddToPacketModal
          localId={packetDoc.localId}
          documentTitle={packetDoc.title}
          onClose={() => setPacketDoc(null)}
        />
      )}

    </AppShell>

  );

}

