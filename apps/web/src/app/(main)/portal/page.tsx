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

import { getSharesForEmail } from "@/lib/team/invites";
import type { DocumentShare } from "@/lib/team/invites";
import { getShareAuditLabel } from "@/lib/team/share-document";

import { syncDocumentsFromCloud } from "@/lib/documents/cloud-sync";

import { getSequenceStats } from "@/lib/documents/sequencing";

import { PortalCompliancePanel, PortalScanButton } from "@/components/PortalCompliancePanel";

import { AISecurityScanModal } from "@/components/AISecurityScanModal";
import { canUseFeature, maxFavorites } from "@/lib/subscription/plans";
import { updateSavedDocumentFields } from "@/lib/documents/persist";
import { getFavoriteTemplateIds } from "@/lib/documents/favorites";



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

  const [scanDoc, setScanDoc] = useState<LocalDocument | null>(null);
  const [expandedShares, setExpandedShares] = useState<Record<string, boolean>>({});



  const pro = canUseFeature(profile.subscription, "aiSecurityScan");
  const favoriteTemplateIds = getFavoriteTemplateIds(profile);
  const favoriteLimit = maxFavorites(profile.subscription);

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

    if (email) setShares(getSharesForEmail(email));

  }, [session?.email, session?.userId, authMode]);



  const typeCounts = useMemo(() => documentTypeCounts(documents), [documents]);

  const sequenceStats = useMemo(

    () => getSequenceStats(session?.userId ?? null),

    [session?.userId, documents]

  );



  const filtered = useMemo(

    () =>

      searchDocuments(documents, {

        query: query || undefined,

        domain: domain === "all" ? undefined : domain,

        category: category === "all" ? undefined : category,

        templateId: templateId === "all" ? undefined : templateId,

        status: status === "all" ? undefined : (status as LocalDocument["status"]),

        sortBy: "updatedAt",

        sortDir: "desc",

      }),

    [documents, query, domain, category, templateId, status]

  );



  const usedTemplateIds = useMemo(

    () => Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a]),

    [typeCounts]

  );



  return (

    <AppShell title="My File Portal" wide>

      {shares.length > 0 && (

        <section className="portal-shares card" style={{ marginBottom: "1.5rem", padding: "1.25rem" }}>

          <h2 className="section-title" style={{ marginTop: 0 }}>Shared with you</h2>

          <ul className="share-inbox-list">

            {shares.map((s) => {
              const activityOpen = expandedShares[s.id] ?? false;
              const activityCount = s.auditLog?.length ?? 0;
              const canPreview = Boolean(s.documentTemplateId && s.fieldDataSnapshot);
              const previewHref = `/portal/view/${s.documentId}?shareId=${s.id}`;
              const signHref = s.documentTemplateId
                ? `/documents/${s.documentTemplateId}?localId=${s.documentId}&sign=1&shareId=${s.id}`
                : null;

              return (
              <li key={s.id} className="share-inbox-item">
                <div className="share-inbox-main">
                  <strong>{s.documentTitle}</strong>
                  {s.shareType === "signature_request" && (
                    <span className="share-inbox-badge">Signature requested</span>
                  )}
                  {s.shareType === "review_request" && (
                    <span className="share-inbox-badge">Review requested</span>
                  )}
                  <span>From {s.fromName} · {new Date(s.createdAt).toLocaleDateString()}</span>
                  {s.message && <p className="field-help">{s.message}</p>}
                  {activityCount > 0 && (
                    <button
                      type="button"
                      className="share-activity-toggle"
                      onClick={() => setExpandedShares((prev) => ({ ...prev, [s.id]: !activityOpen }))}
                      aria-expanded={activityOpen}
                    >
                      Activity ({activityCount}) {activityOpen ? "▾" : "▸"}
                    </button>
                  )}
                  {activityOpen && s.auditLog && s.auditLog.length > 0 && (
                    <ul className="share-audit-log">
                      {s.auditLog.map((event, i) => (
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
                  {!canPreview && (
                    <p className="field-help share-resend-hint">
                      This share has no saved document snapshot. Ask {s.fromName} to re-send it.
                    </p>
                  )}
                </div>
                {signHref ? (
                  <Link href={signHref} className="btn btn-primary btn-sm">
                    {s.shareType === "signature_request"
                      ? "Sign document"
                      : s.shareType === "review_request"
                        ? "Review document"
                        : "Open"}
                  </Link>
                ) : (
                  <span className="btn btn-primary btn-sm" style={{ opacity: 0.45, pointerEvents: "none" }}>
                    Unavailable
                  </span>
                )}
                {canPreview ? (
                  <Link href={previewHref} className="btn btn-secondary btn-sm">
                    Preview
                  </Link>
                ) : (
                  <span className="btn btn-secondary btn-sm" style={{ opacity: 0.45, pointerEvents: "none" }}>
                    Preview
                  </span>
                )}
              </li>
              );
            })}

          </ul>

        </section>

      )}



      <div className="portal-stats-row">

        <div className="portal-stat card">

          <span className="portal-stat-value">{documents.length}</span>

          <span className="portal-stat-label">Saved documents</span>

        </div>

        <div className="portal-stat card">

          <span className="portal-stat-value">{usedTemplateIds.length}</span>

          <span className="portal-stat-label">Document types used</span>

        </div>

        <div className="portal-stat card">

          <span className="portal-stat-value">{sequenceStats.totalIssued}</span>

          <span className="portal-stat-label">Numbers issued</span>

        </div>

        <Link href="/documents" className="btn btn-primary portal-new-btn">+ New Document</Link>

      </div>



      {favoriteTemplateIds.length > 0 && !query && templateId === "all" && status === "all" && (
        <section className="card favorites-strip portal-favorites-section" style={{ marginBottom: "1.5rem", padding: "1.25rem" }}>
          <div className="favorites-strip-header">
            <h2 className="section-title" style={{ marginTop: 0 }}>Favorite documents</h2>
            <Link href="/documents" className="btn btn-secondary btn-sm">Manage favorites</Link>
          </div>

          {favoriteSavedDocs.length > 0 ? (
            <div className="portal-files-grid portal-favorites-grid">
              {favoriteSavedDocs.map((doc) => {
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
                    <div className="portal-file-actions">
                      <Link href={`/portal/view/${doc.localId}`} className="btn btn-primary btn-sm">Open</Link>
                      <Link href={`/documents/${doc.templateId}?localId=${doc.localId}`} className="btn btn-secondary btn-sm">Edit</Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <>
              <p className="field-help" style={{ marginBottom: "0.75rem" }}>
                No saved files yet for your favorite types. Create one below or open a template from the library.
              </p>
              <div className="portal-type-chips">
                {favoriteTemplateIds.map((id) => {
                  const meta = getDocumentById(id);
                  return (
                    <Link key={id} href={`/documents/${id}`} className="portal-type-chip">
                      {meta?.name ?? id}
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          <p className="field-help">
            {favoriteTemplateIds.length}
            {favoriteLimit === Infinity ? "" : ` / ${favoriteLimit}`} favorited types
            {favoriteSavedDocs.length > 0 ? ` · ${favoriteSavedDocs.length} saved file${favoriteSavedDocs.length === 1 ? "" : "s"}` : ""}
          </p>
        </section>
      )}



      <PortalCompliancePanel documents={documents} />



      {usedTemplateIds.length > 0 && (

        <div className="portal-type-index card" style={{ marginBottom: "1rem", padding: "1rem" }}>

          <h3 className="section-title" style={{ marginTop: 0, fontSize: "0.95rem" }}>By type</h3>

          <div className="portal-type-chips">

            {usedTemplateIds.map((id) => {

              const meta = getDocumentById(id);

              return (

                <button

                  key={id}

                  type="button"

                  className={`portal-type-chip${templateId === id ? " active" : ""}`}

                  onClick={() => setTemplateId(templateId === id ? "all" : id)}

                >

                  {meta?.name ?? id} ({typeCounts[id]})

                </button>

              );

            })}

          </div>

        </div>

      )}



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

        <select value={status} onChange={(e) => setStatus(e.target.value)} className="doc-filter-select">

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

                <div className="portal-file-actions">

                  <Link href={`/portal/view/${doc.localId}`} className="btn btn-primary btn-sm">Open</Link>

                  <PortalScanButton doc={doc} pro={pro} onScan={() => setScanDoc(doc)} />

                </div>

              </article>

            );

          })}

        </div>

      )}



      {scanDoc && (
        <AISecurityScanModal
          documentTitle={scanDoc.title}
          templateId={scanDoc.templateId}
          values={scanDoc.fieldData as Record<string, string>}
          onClose={() => setScanDoc(null)}
          onRedact={async (redacted) => {
            const updated = await updateSavedDocumentFields(scanDoc.localId, redacted);
            if (updated) {
              setDocuments((prev) => prev.map((d) => (d.localId === updated.localId ? updated : d)));
            }
            setScanDoc(null);
          }}
        />
      )}

    </AppShell>

  );

}

