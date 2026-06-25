"use client";

import { REDACTED_PLACEHOLDER, isRedactedValue } from "@/lib/security/document-scan";

export { isRedactedValue, REDACTED_PLACEHOLDER };

export function RedactedValue({ label = "Redacted" }: { label?: string }) {
  return (
    <span className="doc-redacted-value" aria-label={label} title={label}>
      REDACTED
    </span>
  );
}
