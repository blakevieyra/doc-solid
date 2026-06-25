export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface SecurityFinding {
  id: string;
  type: string;
  label: string;
  fieldId?: string;
  value: string;
  masked: string;
  risk: RiskLevel;
  recommendation: string;
}

export interface SecurityScanResult {
  id: string;
  documentTitle: string;
  templateId?: string;
  scannedAt: string;
  findings: SecurityFinding[];
  riskScore: number;
  summary: string;
  safeToRedact: boolean;
}

const PATTERNS: { type: string; label: string; regex: RegExp; risk: RiskLevel; recommendation: string }[] = [
  {
    type: "ssn",
    label: "Social Security Number",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    risk: "critical",
    recommendation: "Remove or redact before sharing externally.",
  },
  {
    type: "ssn_raw",
    label: "Social Security Number (unformatted)",
    regex: /\b(?<!\d)\d{3}\s?\d{2}\s?\d{4}(?!\d)\b/g,
    risk: "critical",
    recommendation: "Remove or redact before sharing externally.",
  },
  {
    type: "ein",
    label: "Tax ID / EIN",
    regex: /\b\d{2}-\d{7}\b/g,
    risk: "high",
    recommendation: "Keep encrypted; redact on copies sent to third parties.",
  },
  {
    type: "credit_card",
    label: "Credit Card Number",
    regex: /\b(?:\d[ -]*?){13,16}\b/g,
    risk: "critical",
    recommendation: "Never include full card numbers in documents.",
  },
  {
    type: "bank_account",
    label: "Bank Account Number",
    regex: /\b(?:account|acct|routing)[#:\s]*\d{6,17}\b/gi,
    risk: "high",
    recommendation: "Redact account numbers on shared copies.",
  },
  {
    type: "email",
    label: "Email Address",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    risk: "medium",
    recommendation: "Confirm recipient need before sharing widely.",
  },
  {
    type: "phone",
    label: "Phone Number",
    regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    risk: "medium",
    recommendation: "Consider redacting personal phone numbers on public docs.",
  },
  {
    type: "dob",
    label: "Date of Birth",
    regex: /\b(?:dob|date of birth|born)[:\s]*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi,
    risk: "high",
    recommendation: "Date of birth is sensitive PII — redact when possible.",
  },
  {
    type: "vin",
    label: "Vehicle VIN",
    regex: /\b[A-HJ-NPR-Z0-9]{17}\b/g,
    risk: "medium",
    recommendation: "Confirm VIN is required before sharing this document.",
  },
  {
    type: "routing",
    label: "Bank Routing Number",
    regex: /\b(?:routing|aba)[#:\s]*\d{9}\b/gi,
    risk: "high",
    recommendation: "Redact routing numbers on copies sent externally.",
  },
];

const SENSITIVE_FIELD_IDS: Record<string, { label: string; risk: RiskLevel; recommendation: string }> = {
  taxId: { label: "Tax ID / EIN field", risk: "high", recommendation: "Redact tax IDs on shared copies." },
  ssn: { label: "SSN field", risk: "critical", recommendation: "Never share full SSN externally." },
  socialSecurityNumber: { label: "SSN field", risk: "critical", recommendation: "Never share full SSN externally." },
  monthlyIncome: { label: "Income information", risk: "medium", recommendation: "Redact income on non-essential copies." },
  bankAccount: { label: "Bank account field", risk: "high", recommendation: "Redact account numbers before sharing." },
  vin: { label: "VIN field", risk: "medium", recommendation: "Confirm VIN disclosure is necessary." },
};

function maskValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "••••";
  return trimmed.slice(0, 2) + "•••" + trimmed.slice(-2);
}

function riskWeight(risk: RiskLevel): number {
  if (risk === "critical") return 40;
  if (risk === "high") return 25;
  if (risk === "medium") return 10;
  return 3;
}

export function scanDocumentFields(
  documentTitle: string,
  values: Record<string, string>,
  templateId?: string
): SecurityScanResult {
  const findings: SecurityFinding[] = [];
  const seen = new Set<string>();

  for (const [fieldId, raw] of Object.entries(values)) {
    if (!raw?.trim()) continue;
    const text = raw.trim();

    const sensitiveMeta = SENSITIVE_FIELD_IDS[fieldId];
    if (sensitiveMeta) {
      const key = `field:${fieldId}:${text.slice(0, 8)}`;
      if (!seen.has(key)) {
        seen.add(key);
        findings.push({
          id: `find_${findings.length}`,
          type: "sensitive_field",
          label: sensitiveMeta.label,
          fieldId,
          value: text,
          masked: maskValue(text),
          risk: sensitiveMeta.risk,
          recommendation: sensitiveMeta.recommendation,
        });
      }
    }

    for (const pattern of PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(text)) !== null) {
        const value = match[0];
        const key = `${pattern.type}:${value}:${fieldId}`;
        if (seen.has(key)) continue;
        seen.add(key);

        if (pattern.type === "credit_card" && !luhnCheck(value.replace(/\D/g, ""))) continue;

        findings.push({
          id: `find_${findings.length}`,
          type: pattern.type,
          label: pattern.label,
          fieldId,
          value,
          masked: maskValue(value),
          risk: pattern.risk,
          recommendation: pattern.recommendation,
        });
      }
    }
  }

  const riskScore = Math.min(100, findings.reduce((sum, f) => sum + riskWeight(f.risk), 0));
  const hasCritical = findings.some((f) => f.risk === "critical" || f.risk === "high");

  let summary = "No sensitive data patterns detected.";
  if (findings.length === 1) summary = `1 item flagged — review before sharing.`;
  if (findings.length > 1) summary = `${findings.length} sensitive items flagged — review before sharing.`;
  if (hasCritical) summary = `High-risk data detected (${findings.length} items). Redaction recommended.`;

  return {
    id: `scan_${Date.now()}`,
    documentTitle,
    templateId,
    scannedAt: new Date().toISOString(),
    findings,
    riskScore,
    summary,
    safeToRedact: findings.length > 0,
  };
}

function luhnCheck(num: string): boolean {
  if (num.length < 13) return false;
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i]!, 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function redactDocumentFields(
  values: Record<string, string>,
  findings: SecurityFinding[],
  options?: { redactEntireField?: boolean }
): Record<string, string> {
  const next = { ...values };
  for (const f of findings) {
    if (!f.fieldId || !next[f.fieldId]) continue;
    if (options?.redactEntireField || f.type === "sensitive_field") {
      next[f.fieldId] = "[REDACTED]";
    } else if (next[f.fieldId].includes(f.value)) {
      next[f.fieldId] = next[f.fieldId].replace(f.value, "[REDACTED]");
    } else {
      next[f.fieldId] = "[REDACTED]";
    }
  }
  return next;
}
