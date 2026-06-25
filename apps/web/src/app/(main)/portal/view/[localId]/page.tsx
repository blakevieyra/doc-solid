"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { IndexedDBStorage } from "@doc-solid/storage";
import { generateTemplate, getDocumentById } from "@doc-solid/documents";
import { AppShell } from "@/components/AppShell";
import { DocumentPreview } from "@/components/DocumentPreview";
import { EmailDocumentModal } from "@/components/EmailDocumentModal";
import { RequestSignatureModal } from "@/components/RequestSignatureModal";
import { RequestReviewModal } from "@/components/RequestReviewModal";
import { SecurityScanModal } from "@/components/SecurityScanModal";
import { DocumentComplianceBar } from "@/components/DocumentComplianceBar";
import { ReturnShareModal } from "@/components/ReturnShareModal";
import { useProfile } from "@/components/ProfileProvider";
import { useAuth } from "@/components/AuthProvider";
import { exportDocumentPdf, documentPdfFilename } from "@/lib/pdf/exportDocument";
import { canUseFeature } from "@/lib/subscription/plans";
import { resolveDocumentNumber } from "@/lib/documents/document-number";
import { updateSavedDocumentFields } from "@/lib/documents/persist";
import { loadShares, getShareById } from "@/lib/team/invites";
import {
  getShareSigningHref,
  markShareOpened,
  shareWasReturnedBy,
} from "@/lib/team/share-document";

function SavedDocumentPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const shareId = searchParams?.get("shareId");
  const localId = params?.localId as string | undefined;
  const { profile, documentProfile } = useProfile();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [documentNumber, setDocumentNumber] = useState<string>();
  const [values, setValues] = useState<Record<string, string>>({});
  const [docStatus, setDocStatus] = useState<"DRAFT" | "FINAL" | "ARCHIVED">("DRAFT");
  const [showEmail, setShowEmail] = useState(false);
  const [showRequestSig, setShowRequestSig] = useState(false);
  const [showRequestReview, setShowRequestReview] = useState(false);
  const [showSecurityScan, setShowSecurityScan] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [shareContext, setShareContext] = useState<ReturnType<typeof getShareById>>(null);
  const [showReturnShare, setShowReturnShare] = useState(false);

  const userEmail = session?.email ?? profile.account.email ?? "";
  const userName = session?.name ?? profile.account.displayName ?? profile.personal.fullName ?? "";

  const cleanPdf = canUseFeature(profile.subscription, "pdfClean");

  const meta = useMemo(() => (templateId ? getDocumentById(templateId) : null), [templateId]);
  const template = useMemo(() => (meta ? generateTemplate(meta) : null), [meta]);

  useEffect(() => {
    if (!localId) {
      setLoading(false);
      return;
    }

    const shareFromQuery = shareId ? getShareById(shareId) : null;
    if (shareFromQuery?.fieldDataSnapshot && shareFromQuery.documentTemplateId) {
      setShareContext(shareFromQuery);
      setTitle(shareFromQuery.documentTitle);
      setTemplateId(shareFromQuery.documentTemplateId);
      setValues(shareFromQuery.fieldDataSnapshot);
      setDocStatus(shareFromQuery.completedAt ? "FINAL" : "DRAFT");
      setLoading(false);
      return;
    }

    const storage = new IndexedDBStorage();
    storage.getDocument(localId).then((doc) => {
      if (doc) {
        setTitle(doc.title);
        setTemplateId(doc.templateId);
        setDocumentNumber(resolveDocumentNumber(doc) ?? undefined);
        setValues(doc.fieldData as Record<string, string>);
        setDocStatus(doc.status);
        setLoading(false);
        return;
      }

      const share = loadShares().find((s) => s.documentId === localId);
      if (share?.fieldDataSnapshot && share.documentTemplateId) {
        setShareContext(share);
        setTitle(share.documentTitle);
        setTemplateId(share.documentTemplateId);
        setValues(share.fieldDataSnapshot);
        setDocStatus(share.completedAt ? "FINAL" : "DRAFT");
      }
      setLoading(false);
    });
  }, [localId, shareId]);

  useEffect(() => {
    if (loading || !localId) return;
    const share = shareId
      ? getShareById(shareId)
      : loadShares().find((s) => s.documentId === localId);
    if (!share?.fieldDataSnapshot) return;
    markShareOpened(share.id, { email: userEmail, name: userName });
    setShareContext(getShareById(share.id));
  }, [localId, shareId, loading, userEmail, userName]);

  async function handleRedact(redacted: Record<string, string>) {
    setValues(redacted);
    if (!localId || shareContext?.fieldDataSnapshot) return;
    const updated = await updateSavedDocumentFields(localId, redacted);
    if (updated) setDocStatus(updated.status);
  }

  async function handleMarkFinal() {
    if (!localId) return;
    const updated = await updateSavedDocumentFields(localId, values, { status: "FINAL" });
    if (updated) setDocStatus("FINAL");
  }

  async function handlePdfExport() {
    setExporting(true);
    try {
      await exportDocumentPdf("document-preview", documentPdfFilename(title), { watermark: !cleanPdf });
    } catch {
      alert("PDF export failed. Try print instead.");
    } finally {
      setExporting(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return (
      <AppShell wide>
        <p>Loading document...</p>
      </AppShell>
    );
  }

  if (!localId) {
    return (
      <AppShell wide>
        <p>Invalid document link.</p>
        <Link href="/portal" className="btn btn-secondary">← Back to portal</Link>
      </AppShell>
    );
  }

  if (!meta || !template) {
    return (
      <AppShell wide>
        <p>This shared document is no longer available on this device.</p>
        <Link href="/portal" className="btn btn-secondary">← Back to portal</Link>
      </AppShell>
    );
  }

  const fullTemplate = { ...meta, sections: template.sections };
  const relatedShare = shareContext ?? loadShares().find((s) => s.documentId === localId);
  const isSharedPreview = Boolean(relatedShare?.fieldDataSnapshot);
  const isCompletedShare = Boolean(relatedShare?.completedAt);
  const signHref = relatedShare ? getShareSigningHref(relatedShare) : null;
  const returnedByMe = relatedShare ? shareWasReturnedBy(relatedShare, userEmail) : false;
  const canReturnWithComment = isSharedPreview && !isCompletedShare && !returnedByMe;

  return (
    <AppShell wide>
      <div className="editor-header portal-view-header">
        <Link href="/portal" className="back-link">← Back to portal</Link>
        <div className="editor-header-row">
          <div className="editor-header-text">
            <h1 className="editor-title">{title || meta.name}</h1>
            {isSharedPreview && (
              <p className="editor-desc">
                Document as sent by {relatedShare?.fromName}
                {isCompletedShare ? " — signed and completed" : relatedShare?.shareType === "signature_request" ? " — review and sign" : ""}
              </p>
            )}
            {documentNumber && !isSharedPreview && (
              <p className="editor-desc">{meta.name} · {documentNumber}</p>
            )}
          </div>
          <div className="editor-actions portal-view-actions">
            {signHref && relatedShare?.shareType === "signature_request" && !isCompletedShare && (
              <Link href={signHref} className="btn btn-primary btn-sm">
                Sign document
              </Link>
            )}
            {signHref && relatedShare?.shareType === "review_request" && !isCompletedShare && (
              <Link href={signHref} className="btn btn-primary btn-sm">
                Review & comment
              </Link>
            )}
            {canReturnWithComment && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowReturnShare(true)}
              >
                Return with comment
              </button>
            )}
            {!isSharedPreview && (
              <>
                <Link href={`/documents/${templateId}?localId=${localId}`} className="btn btn-secondary btn-sm">
                  Edit
                </Link>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowRequestReview(true)}>
                  Request Review
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowRequestSig(true)}>
                  Request Signature
                </button>
              </>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEmail(true)}>
              Email
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handlePdfExport} disabled={exporting}>
              {exporting ? "Exporting…" : "Download PDF"}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrint}>
              Print
            </button>
          </div>
        </div>
      </div>

      <DocumentComplianceBar
        meta={fullTemplate}
        values={values}
        status={docStatus}
        onScanRedact={() => setShowSecurityScan(true)}
        onMarkFinal={
          isSharedPreview
            ? undefined
            : async () => {
                if (!localId) return;
                const updated = await updateSavedDocumentFields(localId, values, { status: "FINAL" });
                if (updated) setDocStatus("FINAL");
              }
        }
      />

      <div className="doc-preview-sheet">
        <DocumentPreview
          meta={fullTemplate}
          values={values}
          profile={documentProfile}
          lockBranding={isSharedPreview}
        />
      </div>

      {showRequestReview && localId && (
        <RequestReviewModal
          documentTitle={title}
          documentId={localId}
          onClose={() => setShowRequestReview(false)}
        />
      )}

      {showRequestSig && localId && (
        <RequestSignatureModal
          documentTitle={title}
          documentId={localId}
          documentTemplateId={templateId}
          onClose={() => setShowRequestSig(false)}
        />
      )}

      {showEmail && (
        <EmailDocumentModal
          documentTitle={title}
          documentType={meta.name}
          documentNumber={documentNumber ?? values.documentNumber ?? values.invoiceNumber}
          documentId={localId}
          onClose={() => setShowEmail(false)}
        />
      )}

      {showSecurityScan && (
        <SecurityScanModal
          documentTitle={title}
          templateId={templateId}
          values={values}
          onClose={() => setShowSecurityScan(false)}
          onRedact={(redacted) => void handleRedact(redacted)}
        />
      )}

      {showReturnShare && relatedShare && (
        <ReturnShareModal
          share={relatedShare}
          onClose={() => setShowReturnShare(false)}
          onReturned={() => setShareContext(getShareById(relatedShare.id))}
        />
      )}
    </AppShell>
  );
}

export default function SavedDocumentPage() {
  return (
    <Suspense fallback={
      <AppShell wide>
        <p>Loading document...</p>
      </AppShell>
    }>
      <SavedDocumentPageContent />
    </Suspense>
  );
}
