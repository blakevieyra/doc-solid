import { IndexedDBStorage } from "@doc-solid/storage";
import { appendDocumentAudit } from "./audit";
import type { SendToContactMode } from "@/components/SendToContactModal";

export async function recordDocumentShareAudit(
  documentId: string,
  recipientEmails: string[],
  actorEmail: string,
  actorName: string,
  mode: SendToContactMode
): Promise<void> {
  const storage = new IndexedDBStorage();
  const doc = await storage.getDocument(documentId);
  if (!doc) return;

  const details =
    mode === "signature"
      ? `Signature request sent to ${recipientEmails.join(", ")}`
      : `Shared with ${recipientEmails.join(", ")}`;

  const updated = appendDocumentAudit(doc, "shared", { email: actorEmail, name: actorName }, details);
  await storage.saveDocument(updated);
}
