"use client";

import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, Suspense } from "react";
import {
  getDocumentById,
  generateTemplate,
  getNumberFieldId,
  type TemplateField,
  type DocumentTypeDefinition,
} from "@doc-solid/documents";
import { IndexedDBStorage, createLocalId, type LocalDocument } from "@doc-solid/storage";
import { AppShell } from "@/components/AppShell";
import { DocumentPreview } from "@/components/DocumentPreview";
import { LineItemEditor } from "@/components/LineItemEditor";
import { StructuredTableEditor } from "@/components/StructuredTableEditor";
import { TableFieldPreview } from "@/components/TableFieldPreview";
import { useProfile } from "@/components/ProfileProvider";
import { pushCloudDocument } from "@/lib/documents/cloud-sync";
import { useAuth } from "@/components/AuthProvider";
import { getProfileFieldValue } from "@/lib/profile/storage";
import { patchSignatureLibrary } from "@/lib/profile/signature-library";
import { exportDocumentPdf } from "@/lib/pdf/exportDocument";
import { canUseFeature } from "@/lib/subscription/plans";
import { canCreateDocumentThisMonth } from "@/lib/documents/limits";
import { TeamShareModal } from "@/components/TeamShareModal";
import { RequestSignatureModal } from "@/components/RequestSignatureModal";
import { EmailDocumentModal } from "@/components/EmailDocumentModal";
import { SecurityScanModal } from "@/components/SecurityScanModal";
import { DocumentComplianceBar } from "@/components/DocumentComplianceBar";
import { SignatureField } from "@/components/SignatureField";
import { updateSavedDocumentFields, deleteSavedDocument } from "@/lib/documents/persist";
import { isOwnerSignatureField } from "@/lib/profile/signature";
import { canApplyOwnerSignature } from "@/lib/documents/completeness";
import {
  resolveSignatureFieldAccess,
  shouldAutofillOwnerSignatureForEditor,
  emptyCounterpartySignatureFields,
  canCounterpartySign,
  type SignatureAccessContext,
} from "@/lib/documents/signature-access";
import {
  getSignatureLockMeta,
  isSignatureFilled,
  stampSignatureLock,
} from "@/lib/documents/signature-lock";
import { getShareById } from "@/lib/team/invites";
import { completeShareSigning, markShareOpened, returnShareCorrection } from "@/lib/team/share-document";
import { useNotifications } from "@/components/NotificationProvider";
import { peekNextDocumentNumber } from "@/lib/documents/sequencing";
import { ensureDocumentNumber, resolveDocumentNumber } from "@/lib/documents/document-number";
import { snapshotBrandingIntoValues } from "@/lib/profile/document-branding";
import { useMediaQuery } from "@/lib/useMediaQuery";

function DocumentEditorPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const editLocalId = searchParams?.get("localId") ?? null;
  const signingMode = searchParams?.get("sign") === "1";
  const shareId = searchParams?.get("shareId");
  const id = params?.id as string | undefined;
  const meta = id ? getDocumentById(id) : undefined;
  const template = useMemo(() => (meta ? generateTemplate(meta) : null), [meta]);
  const { profile, documentProfile, autofill, updateProfile } = useProfile();
  const { session, authMode } = useAuth();
  const { notify } = useNotifications();
  const [values, setValues] = useState<Record<string, string>>({});
  const [assignedNumber, setAssignedNumber] = useState<string | null>(null);
  const [numberFieldId, setNumberFieldId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [savedLocalId, setSavedLocalId] = useState<string | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showRequestSig, setShowRequestSig] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showSecurityScan, setShowSecurityScan] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [docStatus, setDocStatus] = useState<"DRAFT" | "FINAL" | "ARCHIVED">("DRAFT");
  const [docOwnerId, setDocOwnerId] = useState<string | null>(null);
  const [assignedFieldIds, setAssignedFieldIds] = useState<string[]>([]);
  const [correctionComment, setCorrectionComment] = useState("");
  const [correctionSent, setCorrectionSent] = useState(false);
  const isMobileEditor = useMediaQuery("(max-width: 768px)");
  const [mobilePane, setMobilePane] = useState<"form" | "preview">("form");

  useEffect(() => {
    if (signingMode) setMobilePane("preview");
  }, [signingMode]);

  const cleanPdf = canUseFeature(profile.subscription, "pdfClean");

  useEffect(() => {
    if (!shareId) return;
    const share = getShareById(shareId);
    if (!share?.documentTemplateId || share.documentTemplateId === id) return;
    const nextParams = new URLSearchParams(searchParams?.toString() ?? "");
    router.replace(`/documents/${share.documentTemplateId}?${nextParams.toString()}`);
  }, [shareId, id, router, searchParams]);

  useEffect(() => {
    if (!shareId || !signingMode) return;
    markShareOpened(shareId, {
      email: session?.email ?? profile.account.email ?? "",
      name: session?.name ?? profile.account.displayName ?? profile.personal.fullName ?? "",
    });
  }, [shareId, signingMode, session?.email, session?.name, profile.account.email, profile.account.displayName, profile.personal.fullName]);

  useEffect(() => {
    if (!shareId) return;
    const share = getShareById(shareId);
    if (share?.signatureFieldIds?.length) {
      setAssignedFieldIds(share.signatureFieldIds);
    }
  }, [shareId]);

  useEffect(() => {
    if (!signingMode || !template || !meta || assignedFieldIds.length > 0) return;
    const full = { ...meta, sections: template.sections };
    const empty = emptyCounterpartySignatureFields(full, values);
    if (empty.length > 0) {
      setAssignedFieldIds(empty.map((f) => f.id));
    }
  }, [signingMode, template, meta, values, assignedFieldIds.length]);

  useEffect(() => {
    if (!template || initialized) return;

    async function initEditor() {
      const share = shareId ? getShareById(shareId) : null;
      const snapshot = share?.fieldDataSnapshot as Record<string, string> | undefined;

      if (signingMode && shareId && share?.documentTemplateId === id && snapshot) {
        const allFieldIds = template!.sections.flatMap((s) => s.fields.map((f) => f.id));
        setNumberFieldId(getNumberFieldId(allFieldIds));
        setValues(snapshot);
        if (share?.signatureFieldIds?.length) {
          setAssignedFieldIds(share.signatureFieldIds);
        }
        setInitialized(true);
        return;
      }

      if (editLocalId && id) {
        const storage = new IndexedDBStorage();
        const doc = await storage.getDocument(editLocalId);
        const templateMatches = Boolean(doc && doc.templateId === id);

        if (doc && (templateMatches || (shareId && snapshot))) {
          const allFieldIds = template!.sections.flatMap((s) => s.fields.map((f) => f.id));
          setNumberFieldId(getNumberFieldId(allFieldIds));
          setValues(templateMatches ? (doc.fieldData as Record<string, string>) : { ...snapshot, ...doc.fieldData as Record<string, string> });
          setSavedLocalId(doc.localId);
          setDocOwnerId(doc.userId ?? null);
          setSaved(true);
          setDocStatus(doc.status);
          setAssignedNumber(resolveDocumentNumber(doc) ?? null);
          setInitialized(true);
          return;
        }

        if (shareId && snapshot && share?.documentTemplateId === id) {
          const allFieldIds = template!.sections.flatMap((s) => s.fields.map((f) => f.id));
          setNumberFieldId(getNumberFieldId(allFieldIds));
          setValues(snapshot);
          setSavedLocalId(editLocalId);
          setInitialized(true);
          return;
        }
      }

      if (shareId && snapshot && share?.documentTemplateId === id) {
        const allFieldIds = template!.sections.flatMap((s) => s.fields.map((f) => f.id));
        setNumberFieldId(getNumberFieldId(allFieldIds));
        setValues(snapshot);
        setInitialized(true);
        return;
      }

      const allFieldIds = template!.sections.flatMap((s) => s.fields.map((f) => f.id));
      const numField = getNumberFieldId(allFieldIds);
      setNumberFieldId(numField);

      const accountCode = profile.account.accountId?.slice(0, 8) || undefined;
      const userId = session?.userId ?? null;
      const nextNumber =
        numField && meta
          ? peekNextDocumentNumber(userId, meta.id, accountCode)
          : null;

      const initial: Record<string, string> = {};
      for (const section of template!.sections) {
        for (const field of section.fields) {
          const fromAutofill = autofill[field.id];
          const fromProfile = field.defaultFromProfile
            ? getProfileFieldValue(profile, field.defaultFromProfile)
            : "";
          let val = fromAutofill || fromProfile;
          if (
            !val &&
            field.type === "signature" &&
            shouldAutofillOwnerSignatureForEditor(field, {
              isDocumentOwner: !editLocalId || !docOwnerId || docOwnerId === userId,
              signingMode,
              docCategory: meta?.category,
            })
          ) {
            val = getProfileFieldValue(profile, "signature.owner");
          }
          if (numField && field.id === numField && nextNumber) {
            val = nextNumber;
          }
          if (val) initial[field.id] = val;
        }
      }

      const fullForGate: DocumentTypeDefinition = { ...meta!, sections: template!.sections };
      for (const section of template!.sections) {
        for (const field of section.fields) {
          if (field.type !== "signature") continue;
          if (!initial[field.id]) continue;
          if (!shouldAutofillOwnerSignatureForEditor(field, {
            isDocumentOwner: !editLocalId || !docOwnerId || docOwnerId === userId,
            signingMode,
            docCategory: meta?.category,
          })) continue;
          const gate = canApplyOwnerSignature(fullForGate, initial);
          if (!gate.ok) {
            delete initial[field.id];
          }
        }
      }

      setValues((prev) => ({ ...initial, ...prev }));
      if (nextNumber) setAssignedNumber(nextNumber);
      setInitialized(true);
    }

    void initEditor();
  }, [template, autofill, profile, initialized, meta, session?.userId, editLocalId, id, shareId, signingMode]);

  if (!id || !meta || !template) {
    return (
      <AppShell>
        <p>Document type not found.</p>
        <Link href="/documents">← Back to library</Link>
      </AppShell>
    );
  }

  const fullTemplate: DocumentTypeDefinition = { ...meta, sections: template.sections };
  const docMeta = meta;
  const signingGate = canApplyOwnerSignature(fullTemplate, values);
  const counterpartyGate = canCounterpartySign(assignedFieldIds, values);
  const userId = session?.userId ?? null;
  const userEmail = session?.email ?? profile.account.email ?? "";
  const userName = session?.name ?? profile.account.displayName ?? profile.personal.fullName ?? "";
  const activeShare = shareId ? getShareById(shareId) : null;
  const isRecipientSigning = Boolean(
    signingMode &&
    shareId &&
    activeShare &&
    activeShare.toEmail.toLowerCase() === userEmail.toLowerCase()
  );
  const isDocumentOwner = isRecipientSigning
    ? false
    : !savedLocalId || !docOwnerId || docOwnerId === userId;

  const signatureAccessCtx = {
    isDocumentOwner,
    signingMode,
    assignedFieldIds,
    values,
    docCategory: meta.category,
  };

  function setField(fieldId: string, value: string) {
    const field = fullTemplate.sections.flatMap((s) => s.fields).find((f) => f.id === fieldId);

    setValues((prev) => {
      let next = { ...prev, [fieldId]: value };
      if (field?.type === "signature" && isSignatureFilled(value)) {
        const isOwnerSig = isOwnerSignatureField(field, meta!.category);
        if (isOwnerSig && !signingMode) {
          const gate = canApplyOwnerSignature(fullTemplate, next);
          if (!gate.ok) {
            window.alert(
              `Complete required fields before signing: ${gate.missing.map((m) => m.label).join(", ")}`
            );
            return prev;
          }
        }
        if (value !== prev[fieldId]) {
          next = stampSignatureLock(fieldId, next, { email: userEmail, name: userName });
        }
      }
      return next;
    });
    setSaved(false);
  }

  function setTotals(totals: { subtotal: string; taxAmount: string; total: string }) {
    setValues((prev) => ({ ...prev, ...totals }));
    setSaved(false);
  }

  async function finishShareSigning(fieldData: Record<string, string>) {
    if (!shareId) return;
    const share = getShareById(shareId);
    await completeShareSigning(shareId, fieldData, { email: userEmail, name: userName });
    notify({
      type: "share",
      title: "Document returned",
      message: `"${share?.documentTitle ?? "Document"}" was signed and returned to ${share?.fromName ?? "the sender"}.`,
    });
    router.push("/portal");
  }

  async function handleSave() {
    if (!meta) return;
    const storage = new IndexedDBStorage();
    const userId = session?.userId ?? null;
    const accountCode = profile.account.accountId?.slice(0, 8) || undefined;

    const { documentNumber, fieldData: numberedValues } = ensureDocumentNumber({
      userId,
      templateId: meta.id,
      accountCode,
      fieldData: values,
      numberFieldId,
      existingDocumentNumber: assignedNumber,
    });

    if (numberFieldId && numberedValues[numberFieldId] !== values[numberFieldId]) {
      setValues((prev) => ({ ...prev, [numberFieldId]: numberedValues[numberFieldId] }));
    }
    if (documentNumber !== assignedNumber) {
      setAssignedNumber(documentNumber);
    }

    const fieldData = snapshotBrandingIntoValues(documentProfile, numberedValues);
    const title = `${meta.name} #${documentNumber}`;

    if (savedLocalId) {
      const updated = await updateSavedDocumentFields(savedLocalId, fieldData, {
        actor: { email: userEmail, name: userName },
        documentNumber,
        title,
      });
      if (!updated) {
        alert("Could not update this document. It may have been removed from your portal.");
        return;
      }
      setSaved(true);
      setDocStatus(updated.status);

      if (signingMode && shareId) {
        await finishShareSigning(fieldData);
      }
      return;
    }

    if (signingMode && shareId && editLocalId) {
      const now = new Date().toISOString();
      const doc: LocalDocument = {
        localId: editLocalId,
        title,
        templateId: meta.id,
        fieldData,
        documentNumber,
        domain: meta.domain,
        category: meta.category,
        userId: userId ?? undefined,
        status: counterpartyGate.ok ? "FINAL" : "DRAFT",
        createdAt: now,
        updatedAt: now,
        syncStatus: "LOCAL_ONLY",
      };
      await storage.saveDocument(doc);
      setSavedLocalId(doc.localId);
      setSaved(true);
      setDocStatus(doc.status);
      await finishShareSigning(fieldData);
      return;
    }

    const unlimited = canUseFeature(profile.subscription, "unlimitedDocs");
    const existing = await storage.getDocumentsForUser(userId);
    const { allowed, used, limit } = canCreateDocumentThisMonth(existing, unlimited);
    if (!allowed) {
      alert(`Free plan limit reached (${used}/${limit} documents this month). Upgrade to Pro for unlimited documents.`);
      return;
    }

    const now = new Date().toISOString();
    const doc: LocalDocument = {
      localId: createLocalId(),
      title,
      templateId: meta.id,
      fieldData,
      documentNumber,
      domain: meta.domain,
      category: meta.category,
      userId: userId ?? undefined,
      status: "DRAFT",
      createdAt: now,
      updatedAt: now,
      syncStatus: "LOCAL_ONLY",
    };
    await storage.saveDocument(doc);
    await storage.enqueueSync({ localId: doc.localId, action: "CREATE", payload: doc, timestamp: doc.updatedAt });

    if (authMode === "server") {
      const synced = await pushCloudDocument(doc);
      if (synced) {
        await storage.saveDocument({ ...doc, ...synced, syncStatus: "SYNCED" });
      }
    }

    setSavedLocalId(doc.localId);
    setSaved(true);
    setDocStatus("DRAFT");
  }

  function handlePrint() {
    window.print();
  }

  async function handleDelete() {
    if (!meta || !savedLocalId || signingMode) return;
    const title = values.documentNumber
      ? `${meta.name} #${values.documentNumber}`
      : meta.name;
    if (!window.confirm(`Delete "${title}" from your portal? This cannot be undone.`)) return;
    const ok = await deleteSavedDocument(savedLocalId);
    if (!ok) {
      window.alert("Could not delete this document.");
      return;
    }
    router.push("/portal");
  }

  async function handlePdfExport() {
    setExporting(true);
    try {
      const filename = `${docMeta.name.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.pdf`;
      await exportDocumentPdf("document-preview", filename, { watermark: !cleanPdf });
    } catch {
      alert("PDF export failed. Try print instead.");
    } finally {
      setExporting(false);
    }
  }

  async function handleReturnCorrection() {
    if (!shareId || !correctionComment.trim()) {
      window.alert("Describe what needs to be corrected before returning to the sender.");
      return;
    }
    const share = getShareById(shareId);
    await returnShareCorrection(shareId, correctionComment, { email: userEmail, name: userName });
    notify({
      type: "share",
      title: "Returned to sender",
      message: `"${share?.documentTitle ?? "Document"}" was returned to ${share?.fromName ?? "the sender"}.`,
    });
    setCorrectionSent(true);
    setTimeout(() => router.push("/portal"), 1200);
  }

  const signingSignatureFields = signingMode
    ? fullTemplate.sections.flatMap((section) =>
        section.fields
          .filter((field) => {
            if (field.type !== "signature") return false;
            return resolveSignatureFieldAccess(field, signatureAccessCtx) === "counterparty-sign";
          })
          .map((field) => ({ section, field }))
      )
    : [];

  return (
    <AppShell wide>
      <div className="editor-header">
        <Link
          href={signingMode ? "/portal" : editLocalId ? `/portal/view/${editLocalId}` : "/documents"}
          className="back-link"
        >
          {signingMode ? "← Back to My Files" : editLocalId ? "← Back to saved document" : "← Back to library"}
        </Link>
        <h1 className="editor-title">{signingMode ? (activeShare?.documentTitle ?? meta.name) : meta.name}</h1>
        <p className="editor-desc">
          {signingMode
            ? "Review the complete document below. Only your assigned signature field(s) can be edited."
            : meta.description}
        </p>
        {!signingMode && (
        <div className="editor-badges">
          <span className={`badge badge-${meta.priority}`}>{meta.priority}</span>
          {assignedNumber && (
            <span className="badge badge-common">Next #: {assignedNumber}</span>
          )}
          {!cleanPdf && <span className="badge badge-common">Free — watermarked PDF</span>}
        </div>
        )}
      </div>

      {!signingMode && (
      <DocumentComplianceBar
        meta={fullTemplate}
        values={values}
        status={savedLocalId ? docStatus : "DRAFT"}
        onScanRedact={() => setShowSecurityScan(true)}
        onMarkFinal={
          savedLocalId
            ? async () => {
                const updated = await updateSavedDocumentFields(savedLocalId, values, { status: "FINAL" });
                if (updated) setDocStatus("FINAL");
              }
            : undefined
        }
      />
      )}

      {signingMode && (
        <>
          {!activeShare?.fieldDataSnapshot && (
            <div className="card signature-signing-banner">
              <strong>Document snapshot missing</strong>
              <p className="field-help">
                Ask the sender to re-send this document so you can view the filled version and sign.
              </p>
            </div>
          )}

          <div className="signing-layout">
            <div className={`signing-document card${isMobileEditor && mobilePane !== "preview" ? " editor-pane-hidden" : ""}`}>
              <div className="preview-toolbar no-print">
                <span>Document sent to you</span>
              </div>
              <div className="doc-preview-sheet">
                <DocumentPreview meta={fullTemplate} values={values} profile={documentProfile} />
              </div>
            </div>

            <aside className={`signing-panel card${isMobileEditor && mobilePane !== "form" ? " editor-pane-hidden" : ""}`}>
              <h2 className="section-title" style={{ marginTop: 0 }}>Your signature</h2>
              <p className="field-help">
                Complete the field(s) below, or return a correction note to the sender.
              </p>

              {signingSignatureFields.length === 0 ? (
                <p className="field-help">No signature fields were assigned on this request.</p>
              ) : (
                signingSignatureFields.map(({ field }) => (
                  <FieldInput
                    key={field.id}
                    field={field}
                    value={values[field.id] ?? ""}
                    onChange={(v) => setField(field.id, v)}
                    profile={profile}
                    docCategory={meta.category}
                    onSaveSignature={(sig, context) =>
                      updateProfile(patchSignatureLibrary(profile, context, sig))
                    }
                    signatureAccessCtx={signatureAccessCtx}
                  />
                ))
              )}

              <div className="field-group" style={{ marginTop: "1rem" }}>
                <label htmlFor="correction-comment">Return with correction (optional)</label>
                <textarea
                  id="correction-comment"
                  rows={4}
                  value={correctionComment}
                  onChange={(e) => setCorrectionComment(e.target.value)}
                  placeholder="Explain what needs to be changed before you can sign…"
                />
              </div>

              {correctionSent && (
                <p className="field-success">Correction sent to {activeShare?.fromName}. Returning to My Files…</p>
              )}

              <div className="signing-panel-actions">
                <button type="button" className="btn btn-primary btn-block" onClick={() => void handleSave()}>
                  {counterpartyGate.ok ? "Complete & return signed document" : "Save signature progress"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  onClick={() => void handleReturnCorrection()}
                  disabled={!correctionComment.trim() || correctionSent}
                >
                  Return for correction
                </button>
              </div>
            </aside>
          </div>

          {isMobileEditor && (
            <div className="editor-mobile-tabs no-print" role="tablist" aria-label="Signing view">
              <button
                type="button"
                role="tab"
                aria-selected={mobilePane === "preview"}
                className={`editor-mobile-tab${mobilePane === "preview" ? " active" : ""}`}
                onClick={() => setMobilePane("preview")}
              >
                Document
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobilePane === "form"}
                className={`editor-mobile-tab${mobilePane === "form" ? " active" : ""}`}
                onClick={() => setMobilePane("form")}
              >
                Sign
              </button>
            </div>
          )}
        </>
      )}

      {!signingMode && (
      <>
      {isMobileEditor && (
        <div className="editor-mobile-tabs no-print" role="tablist" aria-label="Document editor">
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === "form"}
            className={`editor-mobile-tab${mobilePane === "form" ? " active" : ""}`}
            onClick={() => setMobilePane("form")}
          >
            Fill form
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mobilePane === "preview"}
            className={`editor-mobile-tab${mobilePane === "preview" ? " active" : ""}`}
            onClick={() => setMobilePane("preview")}
          >
            Preview
          </button>
        </div>
      )}

      <div className="editor-layout">
        <div className={`editor-form card${isMobileEditor && mobilePane !== "form" ? " editor-pane-hidden" : ""}`}>
          <div className="editor-form-header">
            <h2>Fill Document</h2>
            <span className="autofill-badge">Auto-filled from profile</span>
          </div>
          {template.sections.map((section) => {
            if (section.fields.length === 0) return null;

            return (
            <div key={section.id} className="editor-section">
              <h3 className="section-title">{section.title}</h3>
              {section.fields.map((field) => {
                const sigAccess =
                  field.type === "signature"
                    ? resolveSignatureFieldAccess(field, signatureAccessCtx)
                    : null;

                return (
                <FieldInput
                  key={field.id}
                  field={field}
                  value={values[field.id] ?? ""}
                  onChange={(v) => setField(field.id, v)}
                  autofillValue={autofill[field.id]}
                  taxRate={values.taxRate}
                  onTotalsChange={setTotals}
                  profile={profile}
                  docCategory={meta.category}
                  onSaveSignature={(sig, context) =>
                    updateProfile(patchSignatureLibrary(profile, context, sig))
                  }
                  signingBlocked={
                    sigAccess === "owner-sign"
                      ? !signingGate.ok
                      : undefined
                  }
                  missingPrerequisites={sigAccess === "owner-sign" ? signingGate.missing : undefined}
                  signatureAccessCtx={signatureAccessCtx}
                />
                );
              })}
            </div>
            );
          })}
          <div className="editor-actions">
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              {saved
                ? editLocalId
                  ? "Updated ✓"
                  : "Saved ✓"
                : editLocalId
                  ? "Save changes"
                  : "Save to Portal"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handlePdfExport} disabled={exporting}>
              {exporting ? "Exporting..." : cleanPdf ? "Download PDF" : "Download PDF (watermarked)"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handlePrint}>Print</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowEmail(true)}>
              Email
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (!savedLocalId) {
                  alert("Save to portal first, then request a signature from your team.");
                  return;
                }
                setShowRequestSig(true);
              }}
            >
              Request Signature
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (!savedLocalId) {
                  alert("Save to portal first, then share with your team inbox.");
                  return;
                }
                setShowShare(true);
              }}
            >
              Team Inbox
            </button>
            {savedLocalId && (
              <button type="button" className="btn btn-danger" onClick={() => void handleDelete()}>
                Delete
              </button>
            )}
          </div>
        </div>

        {showShare && savedLocalId && (
          <TeamShareModal
            documentTitle={values.documentNumber ? `${meta.name} #${values.documentNumber}` : `${meta.name} — ${new Date().toLocaleDateString()}`}
            documentId={savedLocalId}
            onClose={() => setShowShare(false)}
          />
        )}

        {showRequestSig && savedLocalId && (
          <RequestSignatureModal
            documentTitle={values.documentNumber ? `${meta.name} #${values.documentNumber}` : `${meta.name} — ${new Date().toLocaleDateString()}`}
            documentId={savedLocalId}
            documentTemplateId={meta.id}
            onClose={() => setShowRequestSig(false)}
          />
        )}

        {showEmail && (
          <EmailDocumentModal
            documentTitle={assignedNumber ? `${meta.name} #${assignedNumber}` : meta.name}
            documentType={meta.name}
            documentNumber={assignedNumber ?? values.documentNumber ?? values.invoiceNumber}
            documentId={savedLocalId ?? undefined}
            onClose={() => setShowEmail(false)}
          />
        )}

        {showSecurityScan && (
          <SecurityScanModal
            documentTitle={assignedNumber ? `${meta.name} #${assignedNumber}` : meta.name}
            templateId={meta.id}
            values={values}
            onClose={() => setShowSecurityScan(false)}
            onRedact={async (redacted) => {
              setValues(redacted);
              if (savedLocalId) {
                const updated = await updateSavedDocumentFields(savedLocalId, redacted);
                if (updated) setDocStatus(updated.status);
              }
            }}
          />
        )}

        <div className={`editor-preview-wrap${isMobileEditor && mobilePane !== "preview" ? " editor-pane-hidden" : ""}`}>
          <div className="preview-toolbar no-print">
            <span>Live Preview</span>
          </div>
          <div className="doc-preview-sheet">
            <DocumentPreview meta={fullTemplate} values={values} profile={documentProfile} />
          </div>
        </div>
      </div>
      </>
      )}
    </AppShell>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  autofillValue,
  taxRate,
  onTotalsChange,
  profile,
  docCategory,
  onSaveSignature,
  signingBlocked,
  missingPrerequisites,
  signatureAccessCtx,
  readOnly = false,
}: {
  field: TemplateField;
  value: string;
  onChange: (v: string) => void;
  autofillValue?: string;
  taxRate?: string;
  onTotalsChange?: (totals: { subtotal: string; taxAmount: string; total: string }) => void;
  profile: ReturnType<typeof useProfile>["profile"];
  docCategory?: string;
  onSaveSignature?: (
    sig: import("@/lib/profile/types").SignatureSettings,
    context: import("@/lib/profile/types").SignatureContext,
  ) => void;
  signingBlocked?: boolean;
  missingPrerequisites?: import("@/lib/documents/completeness").MissingField[];
  signatureAccessCtx: SignatureAccessContext;
  readOnly?: boolean;
}) {
  const isAutofilled = autofillValue && value === autofillValue;
  const isOwnerSig = isOwnerSignatureField(field, docCategory);
  const accessMode =
    field.type === "signature"
      ? resolveSignatureFieldAccess(field, signatureAccessCtx)
      : "readonly-pending";
  const lockMeta =
    field.type === "signature" ? getSignatureLockMeta(field.id, signatureAccessCtx.values) : null;

  if (field.type === "image") {
    return (
      <div className="field-group">
        <label>{field.label}</label>
        {value ? (
          <img src={value} alt="" className="field-image-preview" />
        ) : (
          <p className="field-help">Upload a logo in Profile settings</p>
        )}
      </div>
    );
  }

  if (field.type === "table") {
    if (readOnly) {
      return (
        <div className="field-group field-readonly">
          <label>{field.label}</label>
          <TableFieldPreview fieldId={field.id} label={field.label} value={value} />
        </div>
      );
    }
    if (field.id === "lineItems") {
      return (
        <div className="field-group">
          <label>{field.label}{field.required && <span className="required">*</span>}</label>
          <LineItemEditor
            value={value}
            onChange={onChange}
            taxRate={taxRate}
            onTotalsChange={onTotalsChange}
          />
        </div>
      );
    }

    if (field.tableColumns?.length) {
      return (
        <div className="field-group">
          <label>{field.label}{field.required && <span className="required">*</span>}</label>
          <StructuredTableEditor
            value={value}
            onChange={onChange}
            columns={field.tableColumns}
            addRowLabel={`+ Add ${field.label.replace(/ Entries?$/, "")}`}
          />
        </div>
      );
    }

    return (
      <div className="field-group">
        <label>{field.label}{field.required && <span className="required">*</span>}</label>
        <p className="field-help">This table field is missing a column schema. Contact support or choose a different template.</p>
      </div>
    );
  }

  return (
    <div className={`field-group${isAutofilled ? " field-autofilled" : ""}`}>
      <label htmlFor={field.id}>
        {field.label}
        {field.required && <span className="required">*</span>}
        {isAutofilled && <span className="autofill-tag">auto</span>}
      </label>
      {field.type === "textarea" ? (
        <textarea id={field.id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} />
      ) : field.type === "select" ? (
        <select id={field.id} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select...</option>
          {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      ) : field.type === "signature" ? (
        <SignatureField
          fieldId={field.id}
          label={field.label}
          value={value}
          onChange={onChange}
          profile={profile}
          accessMode={accessMode}
          lockMeta={lockMeta}
          isOwnerField={isOwnerSig}
          onSaveToProfile={accessMode === "owner-sign" ? onSaveSignature : undefined}
          signingBlocked={
            accessMode === "owner-sign"
              ? signingBlocked
              : undefined
          }
          missingPrerequisites={accessMode === "owner-sign" ? missingPrerequisites : undefined}
        />
      ) : readOnly ? (
        <div className="field-readonly-value">{value?.trim() ? value : "—"}</div>
      ) : (
        <input
          id={field.id}
          type={
            field.type === "date" ? "date"
            : field.type === "email" ? "email"
            : field.type === "phone" ? "tel"
            : field.type === "number" || field.type === "currency" ? "number"
            : "text"
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          step={field.type === "currency" ? "0.01" : undefined}
        />
      )}
    </div>
  );
}

export default function DocumentEditorPage() {
  return (
    <Suspense fallback={
      <AppShell wide>
        <p>Loading document...</p>
      </AppShell>
    }>
      <DocumentEditorPageContent />
    </Suspense>
  );
}
