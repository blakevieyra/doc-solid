"use client";

import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
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
import { createRedactedDocumentCopy, updateSavedDocumentFields } from "@/lib/documents/persist";
import type { SecurityFinding } from "@/lib/security/document-scan";
import { useNotifications } from "@/components/NotificationProvider";
import { isShareSender, loadShares, getShareById } from "@/lib/team/invites";
import {
  getShareSigningHref,
  markShareComplete,
  markShareOpened,
  shareHasReturnComments,
  shareWasReturnedBy,
} from "@/lib/team/share-document";
import { ShareReturnCommentsPanel } from "@/components/ShareReturnCommentsPanel";

function SavedDocumentPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const shareId = searchParams?.get("shareId");
  const localId = params?.localId as string | undefined;
  const { profile, documentProfile } = useProfile();
  const { session, authMode } = useAuth();
  const { notify } = useNotifications();
  const router = useRouter();
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
  const [completingShare, setCompletingShare] = useState(false);

  const userEmail = session?.email ?? profile.account.email ?? "";
  const userName = session?.name ?? profile.account.displayName ?? profile.personal.fullName ?? "";

  const cleanPdf = canUseFeature(profile.subscription, "pdfClean");
  const canScanRedact = canUseFeature(profile.subscription, "securityScan");
  const cloudSyncAllowed = canUseFeature(profile.subscription, "cloudSync");

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

  async function handleRedact(
    _redacted: Record<string, string>,
    _scan: unknown,
    applied: SecurityFinding[],
  ): Promise<boolean> {
    if (!localId || shareContext?.fieldDataSnapshot) {
      notify({
        type: "system",
        title: "Save a copy first",
        message: "Redaction creates a new copy in My Files. Shared previews cannot be redacted in place.",
      });
      return false;
    }
    if (!canScanRedact) {
      notify({
        type: "system",
        title: "Pro feature",
        message: "Security scan and redaction require a Pro plan.",
        link: "/profile?tab=billing",
      });
      return false;
    }
    const unlimitedDocs = canUseFeature(profile.subscription, "unlimitedDocs");
    const { redactedDoc, error } = await createRedactedDocumentCopy(localId, applied, {
      actor: { email: userEmail, name: userName },
      userId: session?.userId ?? null,
      unlimitedDocs,
      authMode: authMode ?? undefined,
      securityScanAllowed: canScanRedact,
      cloudSyncAllowed,
    });
    if (error) {
      notify({ type: "system", title: "Could not create redacted copy", message: error });
      return false;
    }
    if (!redactedDoc) {
      notify({
        type: "system",
        title: "Redacted copy not saved",
        message: "Nothing was redacted. Select at least one item and try again.",
      });
      return false;
    }
    notify({
      type: "system",
      title: "Redacted copy saved",
      message: `"${redactedDoc.title}" is ready in My Files. Your original is unchanged.`,
      link: `/portal/view/${redactedDoc.localId}`,
    });
    router.push(`/portal/view/${redactedDoc.localId}`);
    return true;
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
  const isSenderViewing = relatedShare ? isShareSender(relatedShare, userEmail) : false;
  const showReturnComments =
    relatedShare && isSenderViewing && shareHasReturnComments(relatedShare);
  const canReturnWithComment = isSharedPreview && !isCompletedShare && !returnedByMe;
  const canCompleteShare =
    isSharedPreview && !isCompletedShare && relatedShare?.shareType !== "signature_request";

  async function handleCompleteShare() {
    if (!relatedShare || completingShare) return;
    setCompletingShare(true);
    try {
      const updated = await markShareComplete(relatedShare.id, { email: userEmail, name: userName });
      if (updated) setShareContext(updated);
    } finally {
      setCompletingShare(false);
    }
  }

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
            {canCompleteShare && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={completingShare}
                onClick={() => void handleCompleteShare()}
              >
                {completingShare ? "Completing…" : "Complete"}
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
              {exporting ? "Exporting…" : cleanPdf ? "Download PDF" : "Download PDF (watermarked)"}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrint}>
              {cleanPdf ? "Print" : "Print (watermarked)"}
            </button>
          </div>
        </div>
      </div>

      <DocumentComplianceBar
        meta={fullTemplate}
        values={values}
        status={docStatus}
        onScanRedact={() => {
          if (canScanRedact) setShowSecurityScan(true);
        }}
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

      {showReturnComments && relatedShare && (
        <ShareReturnCommentsPanel share={relatedShare} />
      )}

      <div className="doc-preview-sheet">
        <DocumentPreview
          meta={fullTemplate}
          values={values}
          profile={documentProfile}
          lockBranding={isSharedPreview}
          watermark={!cleanPdf}
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
          documentStatus={docStatus}
          onClose={() => setShowSecurityScan(false)}
          onRedact={(redacted, _scan, applied) => handleRedact(redacted, _scan, applied)}
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
