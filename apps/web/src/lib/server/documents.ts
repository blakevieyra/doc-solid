import { prisma } from "@doc-solid/database";
import type { DocumentStatus, SyncStatus } from "@prisma/client";
import type { LocalDocument } from "@doc-solid/storage";
import { getUserPrimaryOrgId } from "./users";

export function toLocalDocument(record: {
  id: string;
  localId: string | null;
  title: string;
  templateId: string;
  status: DocumentStatus;
  fieldData: unknown;
  documentNumber: string | null;
  domain: string | null;
  category: string | null;
  userId: string;
  syncStatus: SyncStatus;
  createdAt: Date;
  updatedAt: Date;
}): LocalDocument {
  return {
    localId: record.localId ?? record.id,
    cloudId: record.id,
    title: record.title,
    templateId: record.templateId,
    fieldData: record.fieldData as Record<string, unknown>,
    status: record.status,
    documentNumber: record.documentNumber ?? undefined,
    domain: record.domain ?? undefined,
    category: record.category ?? undefined,
    userId: record.userId,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    syncStatus: record.syncStatus === "SYNCED" ? "SYNCED" : "LOCAL_ONLY",
  };
}

export async function listUserDocuments(userId: string): Promise<LocalDocument[]> {
  const rows = await prisma.document.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toLocalDocument);
}

export async function upsertUserDocument(
  userId: string,
  doc: LocalDocument
): Promise<LocalDocument> {
  const orgId = await getUserPrimaryOrgId(userId);
  const localId = doc.localId;
  const fieldData = doc.fieldData as object;

  const existing = await prisma.document.findFirst({
    where: { userId, localId },
  });

  if (existing) {
    const updated = await prisma.document.update({
      where: { id: existing.id },
      data: {
        title: doc.title,
        templateId: doc.templateId,
        status: doc.status,
        fieldData,
        documentNumber: doc.documentNumber ?? null,
        domain: doc.domain ?? null,
        category: doc.category ?? null,
        syncStatus: "SYNCED",
        updatedAt: new Date(),
      },
    });
    return toLocalDocument(updated);
  }

  const created = await prisma.document.create({
    data: {
      title: doc.title,
      templateId: doc.templateId,
      status: doc.status,
      fieldData,
      documentNumber: doc.documentNumber ?? null,
      domain: doc.domain ?? null,
      category: doc.category ?? null,
      localId,
      userId,
      organizationId: orgId,
      syncStatus: "SYNCED",
    },
  });
  return toLocalDocument(created);
}

export async function deleteUserDocument(userId: string, localId: string): Promise<boolean> {
  const result = await prisma.document.deleteMany({ where: { userId, localId } });
  return result.count > 0;
}
