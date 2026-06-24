import type { DocumentTypeDefinition } from "@doc-solid/documents";
import { parseSignatureValue } from "@/lib/profile/signature";

export interface SignatureLockMeta {
  signedAt: string;
  signedByEmail: string;
  signedByName: string;
}

const META_PREFIX = "_sigMeta.";

export function signatureMetaKey(fieldId: string): string {
  return `${META_PREFIX}${fieldId}`;
}

export function isSignatureFilled(value: string | undefined): boolean {
  return Boolean(parseSignatureValue(value)?.name);
}

export function getSignatureLockMeta(
  fieldId: string,
  values: Record<string, string>
): SignatureLockMeta | null {
  const raw = values[signatureMetaKey(fieldId)];
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as SignatureLockMeta;
    if (parsed.signedAt && parsed.signedByEmail) return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

/** A signature is locked once the owner/recipient formally signed (metadata stamped). */
export function isSignatureLocked(fieldId: string, values: Record<string, string>): boolean {
  return getSignatureLockMeta(fieldId, values) !== null;
}

export function stampSignatureLock(
  fieldId: string,
  values: Record<string, string>,
  signer: { email: string; name: string }
): Record<string, string> {
  const meta: SignatureLockMeta = {
    signedAt: new Date().toISOString(),
    signedByEmail: signer.email.trim().toLowerCase(),
    signedByName: signer.name.trim(),
  };
  return {
    ...values,
    [signatureMetaKey(fieldId)]: JSON.stringify(meta),
  };
}

/** Prevent clearing or replacing locked signatures when saving. */
export function mergeProtectedSignatures(
  incoming: Record<string, string>,
  existing: Record<string, string> | null | undefined,
  template: DocumentTypeDefinition
): Record<string, string> {
  if (!existing) return incoming;
  const next = { ...incoming };

  for (const section of template.sections) {
    for (const field of section.fields) {
      if (field.type !== "signature") continue;
      const id = field.id;
      if (!isSignatureLocked(id, existing)) continue;
      const incomingVal = incoming[id];
      const existingVal = existing[id];
      if (incomingVal !== existingVal && isSignatureFilled(incomingVal)) {
        continue;
      }
      next[id] = existing[id]!;
      const metaKey = signatureMetaKey(id);
      if (existing[metaKey]) next[metaKey] = existing[metaKey]!;
    }
  }

  return next;
}

export function listSignatureFieldIds(template: DocumentTypeDefinition): string[] {
  return template.sections.flatMap((s) =>
    s.fields.filter((f) => f.type === "signature").map((f) => f.id)
  );
}
