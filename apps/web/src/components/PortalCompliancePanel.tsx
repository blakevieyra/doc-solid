"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { LocalDocument } from "@doc-solid/storage";
import { scanDocumentFields, type SecurityScanResult } from "@/lib/ai/securityScan";
import { saveScanResult } from "@/lib/ai/scanStore";
import { useProfile } from "@/components/ProfileProvider";
import { canUseFeature } from "@/lib/subscription/plans";

const COMPLIANCE_TIPS = [
  "Scan documents before emailing or sharing externally.",
  "Redact SSN, tax IDs, and bank details on copies sent to third parties.",
  "Enable profile encryption in Security Center for sensitive fields.",
  "Use FINAL status only after reviewing scan results.",
  "Keep vehicle title and bill-of-sale records for DMV compliance.",
];

export function PortalCompliancePanel({
  documents,
}: {
  documents: LocalDocument[];
}) {
  const { profile } = useProfile();
  const [scanning, setScanning] = useState(false);
  const [batchResults, setBatchResults] = useState<SecurityScanResult[]>([]);

  const pro = canUseFeature(profile.subscription, "aiSecurityScan");
  const accountId = profile.account.accountId;

  const highRiskCount = useMemo(
    () => batchResults.filter((r) => r.findings.some((f) => f.risk === "critical" || f.risk === "high")).length,
    [batchResults]
  );

  async function scanAll() {
    if (!pro || documents.length === 0) return;
    setScanning(true);
    const results: SecurityScanResult[] = [];
    for (const doc of documents.slice(0, 20)) {
      const result = scanDocumentFields(doc.title, doc.fieldData as Record<string, string>, doc.templateId);
      if (accountId) saveScanResult(accountId, result);
      results.push(result);
    }
    setBatchResults(results);
    setScanning(false);
  }

  return (
    <section className="portal-compliance card">
      <div className="portal-compliance-header">
        <div>
          <h2 className="section-title" style={{ marginTop: 0 }}>Security & Compliance</h2>
          <p className="field-help">AI scan checks saved files for sensitive data before you share them.</p>
        </div>
        {pro ? (
          <button type="button" className="btn btn-accent" onClick={() => void scanAll()} disabled={scanning || documents.length === 0}>
            {scanning ? "Scanning…" : `Scan all files (${Math.min(documents.length, 20)})`}
          </button>
        ) : (
          <Link href="/profile?tab=billing" className="btn btn-secondary">Upgrade for AI Scan</Link>
        )}
      </div>

      <ul className="compliance-tips">
        {COMPLIANCE_TIPS.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>

      {batchResults.length > 0 && (
        <div className="portal-scan-summary">
          <strong>Last batch scan:</strong> {batchResults.length} file(s)
          {highRiskCount > 0 && (
            <span className="portal-scan-warning"> · {highRiskCount} with high/critical findings</span>
          )}
          <ul className="portal-scan-list">
            {batchResults.map((r) => (
              <li key={r.id}>
                <span>{r.documentTitle}</span>
                <span className={`ai-risk-${r.findings.length ? (r.riskScore >= 70 ? "high" : "medium") : "low"}`}>
                  {r.findings.length === 0 ? "Clean" : `${r.findings.length} finding(s)`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!pro && (
        <p className="field-help" style={{ marginTop: "0.75rem" }}>
          Pro includes AI security scan with redaction. <Link href="/profile?tab=security">View Security Center</Link>
        </p>
      )}
    </section>
  );
}

export function PortalScanButton({
  doc,
  pro,
  onScan,
}: {
  doc: LocalDocument;
  pro: boolean;
  onScan: () => void;
}) {
  if (!pro) {
    return (
      <Link href="/profile?tab=billing" className="btn btn-secondary btn-sm" title="Pro feature">
        Scan
      </Link>
    );
  }
  return (
    <button type="button" className="btn btn-secondary btn-sm" onClick={onScan}>
      Scan
    </button>
  );
}
