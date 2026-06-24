import {
  extractDocumentNumberFromValues,
  generateTemplate,
  getDocumentById,
  getNumberFieldId,
} from "@doc-solid/documents";
import { IndexedDBStorage, type LocalDocument } from "@doc-solid/storage";
import { commitDocumentNumber } from "./sequencing";

export function resolveDocumentNumber(doc: LocalDocument): string | null {
  if (doc.documentNumber?.trim()) return doc.documentNumber.trim();
  return extractDocumentNumberFromValues(doc.fieldData as Record<string, unknown>);
}

export function ensureDocumentNumber(params: {
  userId: string | null;
  templateId: string;
  accountCode?: string;
  fieldData: Record<string, string>;
  numberFieldId?: string | null;
  existingDocumentNumber?: string | null;
}): { documentNumber: string; fieldData: Record<string, string> } {
  const { userId, templateId, accountCode, numberFieldId } = params;
  let fieldData = { ...params.fieldData };

  let documentNumber =
    params.existingDocumentNumber?.trim() ||
    (numberFieldId ? fieldData[numberFieldId]?.trim() : "") ||
    extractDocumentNumberFromValues(fieldData) ||
    "";

  if (!documentNumber) {
    documentNumber = commitDocumentNumber(userId, templateId, accountCode);
  }

  if (numberFieldId && !fieldData[numberFieldId]?.trim()) {
    fieldData = { ...fieldData, [numberFieldId]: documentNumber };
  }

  return { documentNumber, fieldData };
}

function documentTitleWithNumber(metaName: string, documentNumber: string, currentTitle: string): string {
  if (currentTitle.includes(documentNumber)) return currentTitle;
  return `${metaName} #${documentNumber}`;
}

/** Assign missing tracking numbers to saved documents (portal backfill). */
export async function backfillDocumentNumbers(
  docs: LocalDocument[],
  userId: string | null,
  accountCode?: string
): Promise<LocalDocument[]> {
  const storage = new IndexedDBStorage();
  let changed = false;
  const byId = new Map<string, LocalDocument>();

  for (const doc of docs) {
    const existing = resolveDocumentNumber(doc);

    if (existing) {
      const fieldData = doc.fieldData as Record<string, string>;
      const meta = getDocumentById(doc.templateId);
      const template = meta ? generateTemplate(meta) : null;
      const numberFieldId = template
        ? getNumberFieldId(template.sections.flatMap((s) => s.fields.map((f) => f.id)))
        : null;
      const nextFieldData =
        numberFieldId && !fieldData[numberFieldId]?.trim()
          ? { ...fieldData, [numberFieldId]: existing }
          : fieldData;

      if (
        doc.documentNumber?.trim() === existing &&
        JSON.stringify(doc.fieldData) === JSON.stringify(nextFieldData)
      ) {
        byId.set(doc.localId, doc);
        continue;
      }

      const patched: LocalDocument = {
        ...doc,
        documentNumber: existing,
        fieldData: nextFieldData,
        title: meta ? documentTitleWithNumber(meta.name, existing, doc.title) : doc.title,
        updatedAt: new Date().toISOString(),
      };
      await storage.saveDocument(patched);
      byId.set(doc.localId, patched);
      changed = true;
      continue;
    }

    const meta = getDocumentById(doc.templateId);
    if (!meta) {
      byId.set(doc.localId, doc);
      continue;
    }

    const template = generateTemplate(meta);
    const numberFieldId = getNumberFieldId(
      template.sections.flatMap((s) => s.fields.map((f) => f.id))
    );
    const fieldData = doc.fieldData as Record<string, string>;

    const { documentNumber, fieldData: nextFieldData } = ensureDocumentNumber({
      userId,
      templateId: doc.templateId,
      accountCode,
      fieldData,
      numberFieldId,
      existingDocumentNumber: existing ?? doc.documentNumber,
    });

    if (
      doc.documentNumber === documentNumber &&
      JSON.stringify(doc.fieldData) === JSON.stringify(nextFieldData)
    ) {
      byId.set(doc.localId, doc);
      continue;
    }

    const patched: LocalDocument = {
      ...doc,
      documentNumber,
      fieldData: nextFieldData,
      title: documentTitleWithNumber(meta.name, documentNumber, doc.title),
      updatedAt: new Date().toISOString(),
    };
    await storage.saveDocument(patched);
    byId.set(doc.localId, patched);
    changed = true;
  }

  if (!changed) return docs;
  return docs.map((d) => byId.get(d.localId) ?? d);
}
