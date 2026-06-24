"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useProfile } from "./ProfileProvider";
import { canUseFeature } from "@/lib/subscription/plans";
import { loadScanHistory, clearScanHistory } from "@/lib/ai/scanStore";
import type { SecurityScanResult } from "@/lib/ai/securityScan";

export function AIScanHistory() {
  const { profile } = useProfile();
  const isPro = canUseFeature(profile.subscription, "aiSecurityScan");
  const userId = profile.account.accountId || null;
  const [history, setHistory] = useState<SecurityScanResult[]>([]);

  useEffect(() => {
    setHistory(loadScanHistory(userId));
  }, [userId]);

  if (!isPro) {
    return (
      <div className="security-section card-inner ai-scan-history">
        <h3 className="section-title">AI Scan History</h3>
        <p className="field-help">
          Pro subscribers can scan documents for sensitive data, save results to their profile, and apply optional redaction.
        </p>
        <Link href="/profile?tab=billing" className="btn btn-primary btn-sm">Upgrade to Pro — $19.99/mo</Link>
      </div>
    );
  }

  return (
    <div className="security-section card-inner ai-scan-history">
      <div className="ai-scan-history-header">
        <h3 className="section-title">AI Scan History</h3>
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
        Scans run locally in your browser. Results are stored on this device only — not sent to third-party AI services.
      </p>
      {history.length === 0 ? (
        <p className="field-help">No scans yet. Use &quot;AI Security Scan&quot; in the editor or &quot;Scan&quot; on My Files.</p>
      ) : (
        <ul className="ai-scan-history-list">
          {history.map((scan) => (
            <li key={scan.id} className="ai-scan-history-item">
              <div>
                <strong>{scan.documentTitle}</strong>
                <span className="ai-scan-history-meta">
                  {new Date(scan.scannedAt).toLocaleString()} · Score {scan.riskScore} · {scan.findings.length} finding(s)
                </span>
              </div>
              <span className={`ai-risk-pill ai-risk-${scan.riskScore >= 60 ? "high" : scan.riskScore >= 25 ? "medium" : "low"}`}>
                {scan.riskScore >= 60 ? "High" : scan.riskScore >= 25 ? "Medium" : "Low"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
