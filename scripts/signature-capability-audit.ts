#!/usr/bin/env npx tsx
/**
 * Signature capability audit — validates lock, access, and merge logic.
 */
import { DOCUMENT_CATALOG } from "../packages/documents/src/catalog/entries";
import { generateTemplate } from "../packages/documents/src/generator/index";

const SIG_PREFIX = "ds-sig:";

function isSignatureFilled(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  if (value.startsWith(SIG_PREFIX)) {
    try {
      const p = JSON.parse(value.slice(SIG_PREFIX.length)) as { name?: string };
      return Boolean(p.name);
    } catch {
      return true;
    }
  }
  return true;
}

function signatureMetaKey(fieldId: string): string {
  return `_sigMeta.${fieldId}`;
}

function isSignatureLocked(fieldId: string, values: Record<string, string>): boolean {
  return isSignatureFilled(values[fieldId]);
}

function stampSignatureLock(
  fieldId: string,
  values: Record<string, string>,
  signer: { email: string; name: string }
): Record<string, string> {
  return {
    ...values,
    [signatureMetaKey(fieldId)]: JSON.stringify({
      signedAt: new Date().toISOString(),
      signedByEmail: signer.email,
      signedByName: signer.name,
    }),
  };
}

function mergeProtectedSignatures(
  incoming: Record<string, string>,
  existing: Record<string, string> | null | undefined,
  template: ReturnType<typeof generateTemplate>
): Record<string, string> {
  if (!existing) return incoming;
  const next = { ...incoming };
  for (const section of template.sections) {
    for (const field of section.fields) {
      if (field.type !== "signature") continue;
      if (!isSignatureLocked(field.id, existing)) continue;
      next[field.id] = existing[field.id]!;
      const mk = signatureMetaKey(field.id);
      if (existing[mk]) next[mk] = existing[mk]!;
    }
  }
  return next;
}

const OWNER_IDS = new Set(["signature", "landlordSignature", "lenderSignature", "sellerSignature"]);
const COUNTERPARTY_IDS = new Set(["volunteerSignature", "tenantSignature", "borrowerSignature", "clientSignature"]);

function resolveAccess(
  fieldId: string,
  ctx: {
    isDocumentOwner: boolean;
    signingMode: boolean;
    assignedFieldIds: string[];
    values: Record<string, string>;
  }
): string {
  if (isSignatureLocked(fieldId, ctx.values)) return "locked";
  if (OWNER_IDS.has(fieldId)) return ctx.isDocumentOwner ? "owner-sign" : "readonly-pending";
  if (COUNTERPARTY_IDS.has(fieldId)) {
    if (ctx.signingMode && ctx.assignedFieldIds.includes(fieldId)) return "counterparty-sign";
    return "readonly-pending";
  }
  return ctx.isDocumentOwner ? "owner-sign" : "readonly-pending";
}

let passed = 0;
let failed = 0;

function assert(cond: boolean, name: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`);
  }
}

const signedValue = `${SIG_PREFIX}${JSON.stringify({ v: 1, name: "Jane Volunteer", title: "", entity: "", image: null, mode: "typed" })}`;

const volunteerMeta = DOCUMENT_CATALOG.find((d) => d.id === "volunteer-agreement")!;
const volunteerTemplate = generateTemplate(volunteerMeta);

console.log("\n=== SIGNATURE CAPABILITY TESTS ===\n");

assert(isSignatureFilled(signedValue), "Detect filled signature");
assert(!isSignatureFilled(""), "Empty signature not filled");

const lockedValues = stampSignatureLock(
  "volunteerSignature",
  { volunteerSignature: signedValue },
  { email: "volunteer@test.com", name: "Jane Volunteer" }
);
assert(isSignatureLocked("volunteerSignature", lockedValues), "Stamped signature is locked");

const tamperAttempt = mergeProtectedSignatures({ volunteerSignature: "" }, lockedValues, volunteerTemplate);
assert(tamperAttempt.volunteerSignature === signedValue, "Merge protects locked signature from clearing");

assert(
  resolveAccess("signature", { isDocumentOwner: true, signingMode: false, assignedFieldIds: [], values: {} }) ===
    "owner-sign",
  "Document owner can sign owner field"
);

assert(
  resolveAccess("signature", {
    isDocumentOwner: false,
    signingMode: true,
    assignedFieldIds: ["volunteerSignature"],
    values: { signature: signedValue },
  }) === "locked",
  "Recipient sees locked owner signature"
);

assert(
  resolveAccess("volunteerSignature", {
    isDocumentOwner: false,
    signingMode: true,
    assignedFieldIds: ["volunteerSignature"],
    values: { signature: signedValue },
  }) === "counterparty-sign",
  "Volunteer can sign assigned counterparty field"
);

assert(
  resolveAccess("volunteerSignature", {
    isDocumentOwner: false,
    signingMode: false,
    assignedFieldIds: [],
    values: {},
  }) === "readonly-pending",
  "Counterparty field pending without signing mode"
);

let multiSig = 0;
for (const meta of DOCUMENT_CATALOG) {
  const tpl = generateTemplate(meta);
  const n = tpl.sections.flatMap((s) => s.fields.filter((f) => f.type === "signature")).length;
  if (n >= 2) multiSig++;
}
assert(multiSig >= 10, `Multi-signature templates catalogued (${multiSig})`);

console.log(`\n=== SUMMARY ===\nPASS: ${passed}  FAIL: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
