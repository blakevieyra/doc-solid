"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CATALOG_STATS,
  DOCUMENT_CATEGORIES,
  DOCUMENT_DOMAINS,
  filterCatalog,
  getDocumentById,
  type DocumentCatalogEntry,
} from "@doc-solid/documents";
import { AppShell } from "@/components/AppShell";
import { RecommendedDocuments } from "@/components/RecommendedDocuments";
import { FavoriteButton } from "@/components/FavoriteButton";
import { useProfile } from "@/components/ProfileProvider";
import { getFavoriteTemplateIds, isFavorite, toggleFavorite } from "@/lib/documents/favorites";
import {
  getRecommendedDocuments,
  getRecommendationHeading,
} from "@/lib/documents/recommendations";

type LibraryView = "all" | "favorites";

export default function DocumentsPage() {
  const { profile, updateProfile } = useProfile();
  const [domain, setDomain] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<LibraryView>("all");
  const [favMsg, setFavMsg] = useState("");

  const favorites = getFavoriteTemplateIds(profile);

  const recommended = useMemo(
    () => getRecommendedDocuments(profile.profileType, profile.business.industry || undefined),
    [profile.profileType, profile.business.industry]
  );
  const recHeading = useMemo(
    () => getRecommendationHeading(profile.profileType, profile.business.industry || undefined),
    [profile.profileType, profile.business.industry]
  );

  const filtered = useMemo(() => {
    let results = filterCatalog({
      query: query || undefined,
      domain: domain as "all" | "business" | "individual" | "organization",
      category: category as "all" | DocumentCatalogEntry["category"],
    });
    if (view === "favorites") {
      results = results.filter((d) => favorites.includes(d.id));
    }
    return results;
  }, [domain, category, query, view, favorites]);

  async function handleToggleFavorite(templateId: string) {
    setFavMsg("");
    const result = toggleFavorite(profile, templateId);
    if (result.error) {
      setFavMsg(result.error);
      return;
    }
    await updateProfile({
      library: { ...profile.library, favoriteTemplateIds: result.favorites },
    });
  }

  return (
    <AppShell title="Document Library">
      {recommended.length > 0 && !query && domain === "all" && category === "all" && view === "all" && (
        <RecommendedDocuments
          documents={recommended}
          heading={recHeading}
          subtitle="Tailored to your profile and industry. Update industry in Profile → Business."
        />
      )}

      <div className="library-view-tabs no-print">
        <button type="button" className={`library-view-tab${view === "all" ? " active" : ""}`} onClick={() => setView("all")}>
          All documents
        </button>
        <button type="button" className={`library-view-tab${view === "favorites" ? " active" : ""}`} onClick={() => setView("favorites")}>
          Favorites ({favorites.length})
        </button>
      </div>

      <div className="doc-search-bar doc-search-bar-wide">
        <input
          type="search"
          placeholder={`Search ${CATALOG_STATS.total}+ document types by name, tag, domain, or category…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="doc-search-input"
        />
        <select value={domain} onChange={(e) => setDomain(e.target.value)} className="doc-filter-select">
          <option value="all">All domains ({CATALOG_STATS.total})</option>
          {DOCUMENT_DOMAINS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label} ({CATALOG_STATS[d.id]})
            </option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="doc-filter-select">
          <option value="all">All categories</option>
          {DOCUMENT_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      {favMsg && <p className="field-error">{favMsg}</p>}

      <p className="doc-search-meta">
        Showing {filtered.length} of {view === "favorites" ? favorites.length : CATALOG_STATS.total} types · {CATALOG_STATS.withTemplates} with full templates
      </p>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)" }}>
            {view === "favorites" ? "No favorites yet — star documents to save them here." : "No document types match your search."}
          </p>
        </div>
      ) : (
        <div className="grid-3">
          {filtered.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              favorited={isFavorite(profile, doc.id)}
              onToggleFavorite={() => void handleToggleFavorite(doc.id)}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function DocumentCard({
  doc,
  favorited,
  onToggleFavorite,
}: {
  doc: DocumentCatalogEntry;
  favorited: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="card doc-card doc-card-with-fav">
      <FavoriteButton
        active={favorited}
        onToggle={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorite();
        }}
      />
      <Link href={`/documents/${doc.id}`} className="doc-card-link">
        <div className="doc-card-header">
          <h3>{doc.name}</h3>
          <span className={`badge badge-${doc.priority}`}>{doc.priority}</span>
        </div>
        <p className="doc-card-desc">{doc.description}</p>
        <div className="doc-card-tags">
          <span className="doc-tag">{doc.domain}</span>
          <span className="doc-tag">{doc.category}</span>
          {doc.hasFullTemplate && <span className="doc-tag doc-tag-ready">Ready</span>}
        </div>
      </Link>
    </div>
  );
}
