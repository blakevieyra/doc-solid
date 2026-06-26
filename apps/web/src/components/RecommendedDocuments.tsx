"use client";

import Link from "next/link";
import { useState } from "react";
import type { RecommendedDocument } from "@/lib/documents/recommendations";
import { INDUSTRY_OPTIONS } from "@/lib/documents/recommendations";
import { useAuth } from "@/components/AuthProvider";
import { FavoriteButton } from "@/components/FavoriteButton";
import { useProfile } from "@/components/ProfileProvider";
import { getFavoriteTemplateIds, isFavorite, toggleFavorite } from "@/lib/documents/favorites";

export function RecommendedDocuments({
  documents,
  heading,
  subtitle,
  compact,
  enableActions = true,
}: {
  documents: RecommendedDocument[];
  heading: string;
  subtitle?: string;
  compact?: boolean;
  /** Show favorite star on each card */
  enableActions?: boolean;
}) {
  const { session } = useAuth();
  const { profile, updateProfile } = useProfile();
  const canFavorite = enableActions && Boolean(session);
  const [favMsg, setFavMsg] = useState("");

  if (documents.length === 0) return null;

  async function handleToggleFavorite(templateId: string) {
    if (!canFavorite) return;
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

  const favorites = getFavoriteTemplateIds(profile);

  return (
    <section className={`recommended-docs${compact ? " recommended-docs-compact" : ""}`}>
      <div className="recommended-docs-header">
        <div>
          <h2 className="recommended-docs-title">{heading}</h2>
          {subtitle && <p className="recommended-docs-subtitle">{subtitle}</p>}
        </div>
        <Link href="/documents" className="btn btn-secondary btn-sm">Browse all</Link>
      </div>

      {favMsg && <p className="field-error" style={{ marginBottom: "0.75rem" }}>{favMsg}</p>}

      <div className="recommended-docs-grid">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className={`card recommended-doc-card${canFavorite ? " recommended-doc-card-with-actions" : ""}`}
          >
            {canFavorite && (
              <FavoriteButton
                active={isFavorite(profile, doc.id)}
                size="sm"
                onToggle={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleToggleFavorite(doc.id);
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
        ))}
      </div>

      {canFavorite && favorites.length > 0 && (
        <p className="field-help" style={{ marginTop: "0.75rem" }}>
          {favorites.length} favorite{favorites.length !== 1 ? "s" : ""} — find them under the{" "}
          <Link href="/documents">Favorites tab</Link> on Documents or add to{" "}
          <Link href="/packets">packets</Link>
        </p>
      )}
    </section>
  );
}

export function IndustrySelect({
  value,
  onChange,
  label = "Industry",
  required,
}: {
  value: string;
  onChange: (industryId: string) => void;
  label?: string;
  required?: boolean;
}) {
  return (
    <div className="field-group">
      <label>{label}{required && " *"}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="industry-select"
      >
        <option value="">Select your industry…</option>
        {INDUSTRY_OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id}>{opt.label}</option>
        ))}
      </select>
      {value && (
        <span className="field-help">
          {INDUSTRY_OPTIONS.find((o) => o.id === value)?.description}
        </span>
      )}
    </div>
  );
}
