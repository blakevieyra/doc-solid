"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CATALOG_STATS,
  DOCUMENT_CATEGORIES,
  DOCUMENT_DOMAINS,
  filterCatalog,
  type DocumentCatalogEntry,
} from "@doc-solid/documents";
import { AppShell } from "@/components/AppShell";
import { RecommendedDocuments } from "@/components/RecommendedDocuments";
import { FavoriteButton } from "@/components/FavoriteButton";
import { GuestSignupBanner } from "@/components/GuestSignupBanner";
import { useProfile } from "@/components/ProfileProvider";
import { useAuth } from "@/components/AuthProvider";
import { getFavoriteTemplateIds, isFavorite, toggleFavorite } from "@/lib/documents/favorites";
import {
  getRecommendedDocuments,
  getRecommendationHeading,
  resolveRecommendationIndustry,
} from "@/lib/documents/recommendations";
import { profileSettingsHint } from "@/lib/profile/profile-identity";

type LibraryView = "all" | "favorites";

export default function DocumentsPage() {
  const { profile, updateProfile } = useProfile();
  const { session } = useAuth();
  const isGuest = !session;
  const [domain, setDomain] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<LibraryView>("all");
  const [favMsg, setFavMsg] = useState("");

  const favorites = getFavoriteTemplateIds(profile);

  const recommended = useMemo(
    () =>
      getRecommendedDocuments(
        profile.profileType,
        resolveRecommendationIndustry(profile),
      ),
    [profile],
  );
  const recHeading = useMemo(
    () =>
      getRecommendationHeading(
        profile.profileType,
        resolveRecommendationIndustry(profile),
      ),
    [profile],
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
    if (isGuest) return;
    setFavMsg("");
    await updateProfile((current) => {
      const result = toggleFavorite(current, templateId);
      if (result.error) {
        setFavMsg(result.error);
        return current;
      }
      return {
        ...current,
        library: { ...current.library, favoriteTemplateIds: result.favorites },
      };
    });
  }

  return (
    <AppShell title="Document Library">
      <GuestSignupBanner />

      <div className="doc-search-bar doc-search-bar-wide doc-library-search-top">
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

      {recommended.length > 0 && !query && domain === "all" && category === "all" && view === "all" && (
        <RecommendedDocuments
          documents={recommended}
          heading={recHeading}
          subtitle={profileSettingsHint(profile.profileType)}
          enableActions={!isGuest}
        />
      )}

      <div className="library-view-tabs no-print">
        <button type="button" className={`library-view-tab${view === "all" ? " active" : ""}`} onClick={() => setView("all")}>
          All documents
        </button>
        <button
          type="button"
          className={`library-view-tab${view === "favorites" ? " active" : ""}`}
          onClick={() => {
            if (isGuest) {
              setFavMsg("Sign up free to save favorite templates.");
              return;
            }
            setView("favorites");
          }}
        >
          Favorites ({isGuest ? 0 : favorites.length})
        </button>
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
        <div className="recommended-docs-grid doc-catalog-grid">
          {filtered.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              favorited={!isGuest && isFavorite(profile, doc.id)}
              showFavorite={!isGuest}
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
  showFavorite = true,
  onToggleFavorite,
}: {
  doc: DocumentCatalogEntry;
  favorited: boolean;
  showFavorite?: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="card recommended-doc-card recommended-doc-card-with-actions">
      {showFavorite && (
      <FavoriteButton
        active={favorited}
        size="sm"
        onToggle={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleFavorite();
        }}
      />
      )}
      <Link href={`/documents/${doc.id}`} className="recommended-doc-link">
        <strong>{doc.name}</strong>
        <span className="recommended-doc-desc">{doc.description}</span>
        <div className="recommended-doc-tags">
          <span className="doc-tag">{doc.domain}</span>
          <span className="doc-tag">{doc.category}</span>
        </div>
      </Link>
    </div>
  );
}
