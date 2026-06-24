import type { DocumentAuditEvent, DocumentAuditEventType, LocalDocument } from "@doc-solid/storage";

export type DocumentActor = { email: string; name: string };

export function createDocumentAuditEvent(
  type: DocumentAuditEventType,
  actor?: DocumentActor,
  details?: string
): DocumentAuditEvent {
  return {
    type,
    timestamp: new Date().toISOString(),
    ...(actor?.email ? { actorEmail: actor.email } : {}),
    ...(actor?.name ? { actorName: actor.name } : {}),
    ...(details ? { details } : {}),
  };
}

export function appendDocumentAudit(
  doc: LocalDocument,
  type: DocumentAuditEventType,
  actor?: DocumentActor,
  details?: string
): LocalDocument {
  return {
    ...doc,
    auditLog: [...(doc.auditLog ?? []), createDocumentAuditEvent(type, actor, details)],
  };
}

export function getDocumentAuditLabel(event: DocumentAuditEvent): string {
  switch (event.type) {
    case "created":
      return "Created";
    case "saved":
      return "Saved";
    case "status_changed":
      return "Status changed";
    case "shared":
      return "Shared";
    case "signed":
      return "Signed";
    case "opened":
      return "Opened";
    case "archived":
      return "Archived";
    case "returned":
      return "Returned for correction";
    case "emailed":
      return "Emailed";
    default:
      return event.type;
  }
}

export function latestDocumentAudit(doc: LocalDocument): DocumentAuditEvent | null {
  const log = doc.auditLog;
  if (!log?.length) return null;
  return log[log.length - 1];
}
