"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { canUseFeature } from "@/lib/subscription/plans";
import { useProfile } from "./ProfileProvider";
import {
  scanDocumentFields,
  redactDocumentFields,
  type SecurityFinding,
  type SecurityScanResult,
} from "@/lib/security/document-scan";
import { saveScanResult } from "@/lib/security/scan-store";

export function SecurityScanModal({
  documentTitle,
  templateId,
  values,
  documentStatus,
  onClose,
  onRedact,
}: {
  documentTitle: string;
  templateId?: string;
  values: Record<string, string>;
  documentStatus?: "DRAFT" | "FINAL" | "ARCHIVED";
  onClose: () => void;
  onRedact?: (
    redacted: Record<string, string>,
    scan: SecurityScanResult,
    applied: SecurityFinding[],
  ) => boolean | Promise<boolean>;
}) {
  const { profile } = useProfile();
  const isPro = canUseFeature(profile.subscription, "securityScan");
  const userId = profile.account.accountId || null;

  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<SecurityScanResult | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyError, setApplyError] = useState("");

  useEffect(() => {
    if (!result) return;
    setSelectedIds(new Set(result.findings.map((f) => f.id)));
  }, [result]);

  if (!isPro) {
    return (
      <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
        <div className="modal-card sec-scan-modal" onClick={(e) => e.stopPropagation()}>
          <div className="sec-scan-pro-badge">Pro Feature</div>
          <h2>Security Scan & Redaction</h2>
          <p className="field-help">
            Scan documents for sensitive data (SSN, tax IDs, payment info) and redact before sharing.
          </p>
          <Link href="/profile?tab=billing" className="btn btn-primary btn-block">Upgrade to Pro — $19.99/mo</Link>
          <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  async function runScan() {
    if (!acceptedPrivacy) return;
    setScanning(true);
    setApplied(false);
    await new Promise((r) => setTimeout(r, 400));
    const scan = scanDocumentFields(documentTitle, values, templateId);
    setResult(scan);
    saveScanResult(userId, scan);
    setSaved(true);
    setScanning(false);
  }

  function toggleFinding(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyRedaction() {
    if (!result || !onRedact) return;
    const toApply = result.findings.filter((f) => selectedIds.has(f.id));
    if (toApply.length === 0) return;
    setApplyError("");
    setApplying(true);
    try {
      const redacted = redactDocumentFields(values, toApply, { redactEntireField: true });
      const ok = await onRedact(redacted, result, toApply);
      if (!ok) {
        setApplyError("Could not save the redacted copy. Save your document first, then try again.");
        return;
      }
      setApplied(true);
      setTimeout(onClose, 900);
    } catch {
      setApplyError("Could not save the redacted copy. Please try again.");
    } finally {
      setApplying(false);
    }
  }

  const selectedCount = result ? result.findings.filter((f) => selectedIds.has(f.id)).length : 0;
  const isFinalDocument = documentStatus === "FINAL" || documentStatus === "ARCHIVED";

  const riskClass =
    !result ? ""
    : result.riskScore >= 60 ? "sec-risk-high"
    : result.riskScore >= 25 ? "sec-risk-medium"
    : "sec-risk-low";

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-card sec-scan-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Security Scan & Redaction</h2>
        <p className="field-help">Review sensitive data in &quot;{documentTitle}&quot; and choose what to redact.</p>
        <p className="field-help sec-redact-final-note">
          Redaction saves a <strong>new copy</strong> titled &quot;(Redacted)&quot; in My Files. Your original document is not changed.
          {isFinalDocument
            ? " Signed signature fields stay intact on the copy to preserve the executed record."
            : " Flagged fields are replaced with a blacked-out REDACTED label."}
        </p>

        <div className="sec-privacy-notice">
          <strong>Privacy notice</strong>
          <p>
            Scanning runs locally in your browser using pattern matching. Results save to Profile → Security.
            Document content is not sent to external services.
          </p>
          <label className="security-toggle">
            <input
              type="checkbox"
              checked={acceptedPrivacy}
              onChange={(e) => setAcceptedPrivacy(e.target.checked)}
            />
            <div>
              <strong>I consent to local security analysis</strong>
              <span>Required before scanning</span>
            </div>
          </label>
        </div>

        {!result && (
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={!acceptedPrivacy || scanning}
            onClick={runScan}
          >
            {scanning ? "Scanning…" : "Run Security Scan"}
          </button>
        )}

        {result && (
          <div className={`sec-scan-result ${riskClass}`}>
            <div className="sec-scan-score-row">
              <span className="sec-scan-score">{result.riskScore}</span>
              <div>
                <strong>Risk score</strong>
                <p>{result.summary}</p>
              </div>
            </div>
            {result.findings.length === 0 ? (
              <p className="field-help">No sensitive patterns found. Document looks safe to share.</p>
            ) : (
              <>
                <p className="field-help sec-redact-hint">
                  Select items to redact, then apply. A new copy is created with blacked-out REDACTED labels — your original stays unchanged.
                </p>
                <ul className="sec-findings-list">
                  {result.findings.map((f) => (
                    <li key={f.id} className={`sec-finding sec-finding-${f.risk}`}>
                      <label className="sec-finding-select">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(f.id)}
                          onChange={() => toggleFinding(f.id)}
                        />
                        <div>
                          <strong>{f.label}</strong>
                          <span className="sec-finding-field">{f.fieldId ?? "document"} · {f.masked}</span>
                          <span className="field-help">{f.recommendation}</span>
                        </div>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {saved && !applied && !applyError && (
              <p className="field-success">Scan saved to Profile → Security → Scan History</p>
            )}
            {applyError && <p className="field-error">{applyError}</p>}
            {applied && (
              <p className="field-success">Redacted copy saved to My Files. Your original is unchanged.</p>
            )}
            {result.findings.length > 0 && onRedact && !applied && (
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={selectedCount === 0 || applying}
                onClick={() => void applyRedaction()}
              >
                {applying
                  ? "Saving redacted copy…"
                  : `Apply Redaction — save copy (${selectedCount} item${selectedCount !== 1 ? "s" : ""})`}
              </button>
            )}
          </div>
        )}

        <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
