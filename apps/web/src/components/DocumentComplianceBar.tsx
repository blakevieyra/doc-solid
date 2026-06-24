"use client";

import { useMemo } from "react";
import type { DocumentTypeDefinition } from "@doc-solid/documents";
import { auditDocumentCompleteness } from "@/lib/documents/completeness";
import { canUseFeature } from "@/lib/subscription/plans";
import { useProfile } from "./ProfileProvider";

interface DocumentComplianceBarProps {
  meta: DocumentTypeDefinition;
  values: Record<string, string>;
  onScanRedact: () => void;
  onMarkFinal?: () => void;
  status?: "DRAFT" | "FINAL" | "ARCHIVED";
  compact?: boolean;
}

export function DocumentComplianceBar({
  meta,
  values,
  onScanRedact,
  onMarkFinal,
  status = "DRAFT",
  compact = false,
}: DocumentComplianceBarProps) {
  const { profile } = useProfile();
  const canScan = canUseFeature(profile.subscription, "aiSecurityScan");
  const audit = useMemo(() => auditDocumentCompleteness(meta, values), [meta, values]);

  const progressPct = audit.totalRequired
    ? Math.round((audit.filledRequired / audit.totalRequired) * 100)
    : 100;

  return (
    <div className={`doc-compliance-bar card no-print${compact ? " doc-compliance-bar-compact" : ""}`}>
      <div className="doc-compliance-main">
        <div className="doc-compliance-progress-wrap">
          <div className="doc-compliance-progress-head">
            <strong>
              {audit.isComplete ? "Required fields complete" : "Required fields missing"}
            </strong>
            <span className="doc-compliance-count">
              {audit.filledRequired}/{audit.totalRequired}
            </span>
          </div>
          <div className="doc-compliance-progress-track" aria-hidden>
            <div
              className={`doc-compliance-progress-fill${audit.isComplete ? " complete" : ""}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {!compact && audit.missingFields.length > 0 && (
          <ul className="doc-compliance-missing">
            {audit.missingFields.slice(0, 5).map((f) => (
              <li key={f.id}>
                <span>{f.section}</span> — {f.label}
              </li>
            ))}
            {audit.missingFields.length > 5 && (
              <li className="field-help">+{audit.missingFields.length - 5} more</li>
            )}
          </ul>
        )}
      </div>

      <div className="doc-compliance-actions">
        {status === "DRAFT" && onMarkFinal && audit.isComplete && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onMarkFinal}>
            Mark Final
          </button>
        )}
        {status === "FINAL" && <span className="doc-status-badge final">Final</span>}
        <button
          type="button"
          className="btn btn-accent btn-sm"
          onClick={onScanRedact}
          title={canScan ? "Scan for sensitive data and apply redaction" : "Pro feature"}
        >
          {canScan ? "Scan & Redact" : "Scan & Redact (Pro)"}
        </button>
      </div>
    </div>
  );
}
