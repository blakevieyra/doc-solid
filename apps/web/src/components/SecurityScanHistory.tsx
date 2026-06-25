"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useProfile } from "./ProfileProvider";
import { canUseFeature } from "@/lib/subscription/plans";
import { loadScanHistory, clearScanHistory } from "@/lib/security/scan-store";
import type { SecurityScanResult } from "@/lib/security/document-scan";

export function SecurityScanHistory() {
  const { profile } = useProfile();
  const isPro = canUseFeature(profile.subscription, "securityScan");
  const userId = profile.account.accountId || null;
  const [history, setHistory] = useState<SecurityScanResult[]>([]);

  useEffect(() => {
    setHistory(loadScanHistory(userId));
  }, [userId]);

  if (!isPro) {
    return (
      <div className="security-section card-inner sec-scan-history">
        <h3 className="section-title">Security Scan History</h3>
        <p className="field-help">
          Pro subscribers can scan documents for sensitive data, save results to their profile, and apply optional redaction.
        </p>
        <Link href="/profile?tab=billing" className="btn btn-primary btn-sm">Upgrade to Pro — $19.99/mo</Link>
      </div>
    );
  }

  return (
    <div className="security-section card-inner sec-scan-history">
      <div className="sec-scan-history-header">
        <h3 className="section-title">Security Scan History</h3>
        {history.length > 0 && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              clearScanHistory(userId);
              setHistory([]);
            }}
          >
            Clear history
          </button>
        )}
      </div>
      <p className="field-help">
        Scans run locally in your browser. Results are stored on this device only — not sent to external services.
      </p>
      {history.length === 0 ? (
        <p className="field-help">No scans yet. Use &quot;Scan & Redact&quot; in the editor or &quot;Scan&quot; on My Files.</p>
      ) : (
        <ul className="sec-scan-history-list">
          {history.map((scan) => (
            <li key={scan.id} className="sec-scan-history-item">
              <div>
                <strong>{scan.documentTitle}</strong>
                <span className="sec-scan-history-meta">
                  {new Date(scan.scannedAt).toLocaleString()} · Score {scan.riskScore} · {scan.findings.length} finding(s)
                </span>
              </div>
              <span className={`sec-risk-pill sec-risk-${scan.riskScore >= 60 ? "high" : scan.riskScore >= 25 ? "medium" : "low"}`}>
                {scan.riskScore >= 60 ? "High" : scan.riskScore >= 25 ? "Medium" : "Low"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
