import {
  generateTemplate,
  getDocumentById,
  getNumberFieldId,
} from "@doc-solid/documents";
import { IndexedDBStorage, createLocalId, type LocalDocument } from "@doc-solid/storage";
import type { UserProfile } from "@/lib/profile/types";
import { getProfileFieldValue } from "@/lib/profile/storage";
import { canUseFeature } from "@/lib/subscription/plans";
import { canCreateDocumentThisMonth } from "@/lib/documents/limits";
import { canApplyOwnerSignature } from "@/lib/documents/completeness";
import { pushCloudDocument } from "@/lib/documents/cloud-sync";
import { commitDocumentNumber, peekNextDocumentNumber } from "@/lib/documents/sequencing";
import { shouldAutofillOwnerSignature } from "@/lib/profile/signature";
import { snapshotBrandingIntoValues } from "@/lib/profile/document-branding";

export async function quickSaveTemplate(params: {
  templateId: string;
  profile: UserProfile;
  autofill: Record<string, string>;
  userId: string | null;
  authMode: "local" | "server";
}): Promise<{ localId: string; title: string } | { error: string }> {
  const meta = getDocumentById(params.templateId);
  if (!meta) return { error: "Template not found" };

  const template = generateTemplate(meta);
  const storage = new IndexedDBStorage();
  const unlimited = canUseFeature(params.profile.subscription, "unlimitedDocs");
  const existing = await storage.getDocumentsForUser(params.userId);
  const { allowed, used, limit } = canCreateDocumentThisMonth(existing, unlimited);
  if (!allowed) {
    return {
      error: `Free plan limit reached (${used}/${limit} documents this month). Upgrade to Pro for unlimited.`,
    };
  }

  const accountCode = params.profile.account.accountId?.slice(0, 8) || undefined;
  const allFieldIds = template.sections.flatMap((s) => s.fields.map((f) => f.id));
  const numField = getNumberFieldId(allFieldIds);
  const values: Record<string, string> = { ...params.autofill };

  for (const section of template.sections) {
    for (const field of section.fields) {
      if (values[field.id]) continue;
      const fromProfile = field.defaultFromProfile
        ? getProfileFieldValue(params.profile, field.defaultFromProfile)
        : "";
      let val = fromProfile;
      if (
        !val &&
        field.type === "signature" &&
        shouldAutofillOwnerSignature(field, meta.category)
      ) {
        val = getProfileFieldValue(params.profile, "signature.owner");
      }
      if (val) values[field.id] = val;
    }
  }

  const fullMeta = { ...meta, sections: template.sections };
  for (const section of template.sections) {
    for (const field of section.fields) {
      if (field.type !== "signature" || !values[field.id]) continue;
      if (!canApplyOwnerSignature(fullMeta, values).ok) {
        delete values[field.id];
      }
    }
  }

  let documentNumber: string | undefined;
  if (numField) {
    const next = peekNextDocumentNumber(params.userId, meta.id, accountCode);
    if (next) {
      documentNumber = commitDocumentNumber(params.userId, meta.id, accountCode);
      values[numField] = documentNumber;
    }
  }

  const now = new Date().toISOString();
  const titleSuffix = documentNumber
    ? ` #${documentNumber}`
    : ` — ${new Date().toLocaleDateString()}`;
  const title = `${meta.name}${titleSuffix}`;

  const doc: LocalDocument = {
    localId: createLocalId(),
    title,
    templateId: meta.id,
    fieldData: snapshotBrandingIntoValues(params.profile, values),
    documentNumber,
    domain: meta.domain,
    category: meta.category,
    userId: params.userId ?? undefined,
    status: "DRAFT",
    createdAt: now,
    updatedAt: now,
    syncStatus: "LOCAL_ONLY",
  };

  await storage.saveDocument(doc);
  await storage.enqueueSync({
    localId: doc.localId,
    action: "CREATE",
    payload: doc,
    timestamp: now,
  });

  if (params.authMode === "server") {
    const synced = await pushCloudDocument(doc);
    if (synced) {
      await storage.saveDocument({ ...doc, ...synced, syncStatus: "SYNCED" });
    }
  }

  return { localId: doc.localId, title };
}
