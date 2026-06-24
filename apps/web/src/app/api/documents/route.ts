import { NextRequest, NextResponse } from "next/server";
import type { LocalDocument } from "@doc-solid/storage";
import { requireAuth } from "@/lib/server/session";
import {
  listUserDocuments,
  upsertUserDocument,
  deleteUserDocument,
} from "@/lib/server/documents";
import { enforceRateLimit, rejectIfBodyTooLarge } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const documents = await listUserDocuments(auth.user.id);
  return NextResponse.json({ documents });
}

export async function POST(req: NextRequest) {
  const rl = await enforceRateLimit(req, "documents-sync", 120, 3600);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many sync requests" }, { status: 429 });
  }

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  if (rejectIfBodyTooLarge(req, 2_000_000)) {
    return NextResponse.json({ error: "Document payload too large" }, { status: 413 });
  }

  const body = await req.json() as { document?: LocalDocument };
  if (!body.document?.localId || !body.document.title || !body.document.templateId) {
    return NextResponse.json({ error: "Valid document is required" }, { status: 400 });
  }

  const doc: LocalDocument = {
    ...body.document,
    userId: auth.user.id,
    updatedAt: body.document.updatedAt ?? new Date().toISOString(),
    createdAt: body.document.createdAt ?? new Date().toISOString(),
  };

  const saved = await upsertUserDocument(auth.user.id, doc);
  return NextResponse.json({ document: saved });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;

  const localId = req.nextUrl.searchParams.get("localId");
  if (!localId) {
    return NextResponse.json({ error: "localId is required" }, { status: 400 });
  }

  const deleted = await deleteUserDocument(auth.user.id, localId);
  if (!deleted) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
