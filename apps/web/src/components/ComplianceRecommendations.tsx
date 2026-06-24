"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useProfile } from "./ProfileProvider";
import { loadScanHistory } from "@/lib/ai/scanStore";

const BASE_COMPLIANCE_TIPS = [
  "Scan documents before emailing or sharing externally.",
  "Redact SSN, tax IDs, and bank details on copies sent to third parties.",
  "Enable profile encryption in Security Center for sensitive fields.",
  "Use FINAL status only after reviewing scan results.",
  "Keep vehicle title and bill-of-sale records for DMV compliance.",
  "Store W-9 and tax documents with restricted access.",
  "Review HIPAA BAA and privacy policy templates annually.",
];

export function ComplianceRecommendations() {
  const { profile } = useProfile();
  const userId = profile.account.accountId || null;

  const { tips, findingRecs } = useMemo(() => {
    const history = loadScanHistory(userId);
    const recSet = new Set<string>();
    for (const scan of history) {
      for (const f of scan.findings) {
        if (f.recommendation) recSet.add(f.recommendation);
      }
    }
    return {
      tips: BASE_COMPLIANCE_TIPS,
      findingRecs: Array.from(recSet).slice(0, 8),
    };
  }, [userId]);

  return (
    <div className="security-section card-inner compliance-panel">
      <h3 className="section-title">Compliance Recommendations</h3>
      <p className="field-help">
        Best practices for document security and regulatory compliance. Scan results from My Files and the editor feed personalized recommendations below.
      </p>
      <ul className="compliance-tips">
        {tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>
      {findingRecs.length > 0 && (
        <>
          <h4 className="compliance-subtitle">From your recent scans</h4>
          <ul className="compliance-tips compliance-tips-action">
            {findingRecs.map((rec) => (
              <li key={rec}>{rec}</li>
            ))}
          </ul>
        </>
      )}
      <p className="field-help" style={{ marginTop: "0.75rem" }}>
        Run scans from <Link href="/portal">My Files</Link> or any document editor.
      </p>
    </div>
  );
}
