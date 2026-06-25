"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UserProfile, SignatureSettings, SignatureContext } from "@/lib/profile/types";
import type { MissingField } from "@/lib/documents/completeness";
import type { SignatureFieldAccess } from "@/lib/documents/signature-access";
import type { SignatureLockMeta } from "@/lib/documents/signature-lock";
import {
  buildOwnerSignatureValue,
  parseSignatureValue,
  resolveOwnerIdentity,
  serializeSignaturePayload,
  signatureMatchesOwnerIdentity,
  type SignaturePayload,
} from "@/lib/profile/signature";
import {
  getActiveSignatureContext,
  getSignatureSettings,
  patchSignatureLibrary,
  SIGNATURE_CONTEXT_LABELS,
} from "@/lib/profile/signature-library";

type SignatureMode = "saved" | "draw";

function LockedSignatureDisplay({
  label,
  value,
  lockMeta,
}: {
  label: string;
  value: string;
  lockMeta?: SignatureLockMeta | null;
}) {
  return (
    <div className="signature-field signature-field-locked">
      <SignaturePreview value={value} label={label} compact />
      <p className="field-help signature-locked-notice" role="status">
        Signed
        {lockMeta?.signedByName ? ` by ${lockMeta.signedByName}` : ""}
        {lockMeta?.signedAt ? ` on ${new Date(lockMeta.signedAt).toLocaleDateString()}` : ""}.
      </p>
    </div>
  );
}

function PendingSignatureDisplay({ label, isOwnerField }: { label: string; isOwnerField: boolean }) {
  return (
    <div className="signature-field signature-field-counterparty">
      <p className="field-help">
        {isOwnerField ? (
          <>
            <strong>{label}</strong> is for the document owner or authorized organization signer.
            Awaiting their signature.
          </>
        ) : (
          <>
            <strong>{label}</strong> is for the other party. Use <strong>Request Signature</strong> to
            send this document for their signature, or open the signing link they received.
          </>
        )}
      </p>
      <p className="field-help signature-pending">Awaiting signature.</p>
    </div>
  );
}

function CounterpartySigningField({
  fieldId,
  label,
  value,
  onChange,
  profile,
  signingBlocked,
}: {
  fieldId: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  profile: UserProfile;
  signingBlocked?: boolean;
}) {
  const signerName = (profile.personal.fullName || profile.account.displayName || "").trim();
  const [mode, setMode] = useState<SignatureMode>("draw");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  function applyPayload(payload: SignaturePayload) {
    if (!signerName) {
      window.alert("Add your name in Profile → Personal before signing.");
      return;
    }
    onChange(serializeSignaturePayload(payload));
  }

  function saveDrawnSignature() {
    if (signingBlocked || !signerName) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    applyPayload({
      v: 1,
      name: signerName,
      title: profile.personal.title || "",
      entity: "",
      image: canvas.toDataURL("image/png"),
      mode: "drawn",
    });
  }

  function applyTypedSignature() {
    if (signingBlocked || !signerName) return;
    applyPayload({
      v: 1,
      name: signerName,
      title: profile.personal.title || "",
      entity: "",
      image: null,
      mode: "typed",
    });
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (signingBlocked) return;
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvasRef.current?.setPointerCapture(e.pointerId);
  }

  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || signingBlocked) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function endDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = false;
    canvasRef.current?.releasePointerCapture(e.pointerId);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== "draw") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1a2744";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [mode]);

  return (
    <div className={`signature-field${signingBlocked ? " signature-field-blocked" : ""}`}>
      <p className="field-help">
        Sign as <strong>{signerName || "your profile name"}</strong> for <strong>{label}</strong>.
      </p>
      <div className="signature-mode-tabs">
        <button
          type="button"
          className={`signature-tab${mode === "draw" ? " active" : ""}`}
          onClick={() => setMode("draw")}
        >
          Draw
        </button>
        <button
          type="button"
          className={`signature-tab${mode === "saved" ? " active" : ""}`}
          onClick={() => setMode("saved")}
        >
          Use my name
        </button>
      </div>
      {mode === "saved" ? (
        <div className="signature-saved-panel">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={applyTypedSignature}
            disabled={signingBlocked || !signerName}
          >
            Apply Signature
          </button>
        </div>
      ) : (
        <div className="signature-draw-panel">
          <canvas
            ref={canvasRef}
            className={`signature-canvas${signingBlocked ? " signature-canvas-disabled" : ""}`}
            width={560}
            height={160}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            aria-label={`Draw ${label}`}
          />
          <div className="signature-draw-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={saveDrawnSignature}
              disabled={signingBlocked || !signerName}
            >
              Apply Signature
            </button>
          </div>
        </div>
      )}
      <input type="hidden" id={fieldId} value={value} readOnly />
    </div>
  );
}

function OwnerSignatureField({
  fieldId,
  label,
  value,
  onChange,
  profile,
  onSaveToProfile,
  signingBlocked,
  missingPrerequisites,
}: {
  fieldId: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  profile: UserProfile;
  onSaveToProfile?: (sig: SignatureSettings, context: SignatureContext) => void;
  signingBlocked?: boolean;
  missingPrerequisites?: MissingField[];
}) {
  const selectedContext = getActiveSignatureContext(profile);
  const saved = getSignatureSettings(profile, selectedContext);
  const identity = resolveOwnerIdentity(profile, selectedContext);
  const ownerName = (saved.signerName || identity.signerName).trim();
  const parsed = parseSignatureValue(value);
  const canUseSaved = Boolean(
    (saved.signerName || identity.signerName).trim() || saved.drawnSignature,
  );
  const [mode, setMode] = useState<SignatureMode>(() => {
    if (parsed?.mode === "drawn") return "draw";
    if (value && parsed) return "saved";
    if (canUseSaved) return "saved";
    return "draw";
  });
  const typedTitle = saved.signerTitle || identity.signerTitle;
  const typedEntity = saved.entityName || identity.entityName;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const applyPayload = useCallback(
    (payload: SignaturePayload) => {
      if (!signatureMatchesOwnerIdentity(payload, profile, selectedContext)) {
        window.alert("You can only sign with your own name from your profile.");
        return;
      }
      onChange(serializeSignaturePayload(payload));
    },
    [onChange, profile, selectedContext]
  );

  const blockedMessage =
    signingBlocked && missingPrerequisites && missingPrerequisites.length > 0
      ? `Complete required fields before signing: ${missingPrerequisites
          .slice(0, 4)
          .map((f) => f.label)
          .join(", ")}${missingPrerequisites.length > 4 ? ` (+${missingPrerequisites.length - 4} more)` : ""}.`
      : signingBlocked
        ? "Complete all required fields before signing."
        : null;

  function applySavedSignature() {
    if (signingBlocked) return;
    if (!ownerName) {
      window.alert("Add your name in Profile → Personal (or Business) before applying your signature.");
      return;
    }
    let val = buildOwnerSignatureValue(profile, selectedContext);
    if (!val) {
      val = serializeSignaturePayload({
        v: 1,
        name: ownerName,
        title: typedTitle.trim(),
        entity: typedEntity.trim(),
        image: saved.useDrawnSignature ? saved.drawnSignature : null,
        mode: saved.useDrawnSignature && saved.drawnSignature ? "drawn" : "typed",
      });
    }
    onChange(val);
    setMode("saved");
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function saveDrawnSignature() {
    if (signingBlocked) return;
    if (!ownerName) {
      window.alert("Add your name in Profile → Personal before signing.");
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = canvas.toDataURL("image/png");
    applyPayload({
      v: 1,
      name: ownerName,
      title: typedTitle.trim(),
      entity: typedEntity.trim(),
      image,
      mode: "drawn",
    });
    if (onSaveToProfile) {
      onSaveToProfile(
        {
          ...saved,
          signerName: ownerName,
          signerTitle: typedTitle.trim() || saved.signerTitle,
          entityName: typedEntity.trim() || saved.entityName,
          drawnSignature: image,
          useDrawnSignature: true,
        },
        selectedContext,
      );
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== "draw") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1a2744";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (parsed?.image && parsed.mode === "drawn") {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = parsed.image;
    }
  }, [mode, parsed?.image, parsed?.mode]);

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (signingBlocked) return;
    drawing.current = true;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvas?.setPointerCapture(e.pointerId);
  }

  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || signingBlocked) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function endDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = false;
    canvasRef.current?.releasePointerCapture(e.pointerId);
  }

  return (
    <div className={`signature-field${signingBlocked ? " signature-field-blocked" : ""}`}>
      {blockedMessage && (
        <p className="field-help signature-blocked-notice" role="status">
          {blockedMessage}
        </p>
      )}

      <div className="signature-mode-tabs">
        {canUseSaved && (
          <button
            type="button"
            className={`signature-tab${mode === "saved" ? " active" : ""}`}
            onClick={() => setMode("saved")}
          >
            My Signature
          </button>
        )}
        <button
          type="button"
          className={`signature-tab${mode === "draw" ? " active" : ""}`}
          onClick={() => setMode("draw")}
        >
          Draw
        </button>
      </div>

      {mode === "saved" && (
        <div className="signature-saved-panel">
          <SignaturePreview
            value={buildOwnerSignatureValue(profile, selectedContext)}
            label={label}
            compact
          />
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={applySavedSignature}
            disabled={signingBlocked || !ownerName}
          >
            Apply My Signature
          </button>
          <p className="field-help">
            Signs as <strong>{ownerName || "your profile name"}</strong>
            {saved.entityName ? ` on behalf of ${saved.entityName}` : ""}. Update in Profile →{" "}
            {SIGNATURE_CONTEXT_LABELS[selectedContext]}.
          </p>
        </div>
      )}

      {mode === "draw" && (
        <div className="signature-draw-panel">
          <div className="signature-identity-row">
            <input
              type="text"
              value={ownerName}
              readOnly
              placeholder="Printed name (from profile)"
              aria-label="Printed name"
              className="signature-identity-readonly"
            />
            <input
              type="text"
              value={typedTitle}
              readOnly
              placeholder="Title"
              aria-label="Title"
              className="signature-identity-readonly"
            />
            {typedEntity && (
              <input
                type="text"
                value={typedEntity}
                readOnly
                placeholder="On behalf of"
                aria-label="Entity name"
                className="signature-identity-readonly"
              />
            )}
          </div>
          <canvas
            ref={canvasRef}
            className={`signature-canvas${signingBlocked ? " signature-canvas-disabled" : ""}`}
            width={560}
            height={160}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            aria-label={`Draw ${label}`}
            aria-disabled={signingBlocked}
          />
          <div className="signature-draw-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={clearCanvas} disabled={signingBlocked}>
              Clear canvas
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={saveDrawnSignature}
              disabled={signingBlocked || !ownerName}
            >
              Apply Signature
            </button>
          </div>
        </div>
      )}

      <input type="hidden" id={fieldId} value={value} readOnly />
    </div>
  );
}

export function SignatureField({
  fieldId,
  label,
  value,
  onChange,
  profile,
  onSaveToProfile,
  accessMode,
  lockMeta,
  isOwnerField,
  signingBlocked,
  missingPrerequisites,
}: {
  fieldId: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  profile: UserProfile;
  onSaveToProfile?: (sig: SignatureSettings, context: SignatureContext) => void;
  accessMode: SignatureFieldAccess;
  lockMeta?: SignatureLockMeta | null;
  isOwnerField?: boolean;
  signingBlocked?: boolean;
  missingPrerequisites?: MissingField[];
}) {
  if (accessMode === "locked") {
    return <LockedSignatureDisplay label={label} value={value} lockMeta={lockMeta} />;
  }

  if (accessMode === "readonly-pending") {
    return <PendingSignatureDisplay label={label} isOwnerField={Boolean(isOwnerField)} />;
  }

  if (accessMode === "counterparty-sign") {
    return (
      <CounterpartySigningField
        fieldId={fieldId}
        label={label}
        value={value}
        onChange={onChange}
        profile={profile}
        signingBlocked={signingBlocked}
      />
    );
  }

  return (
    <OwnerSignatureField
      fieldId={fieldId}
      label={label}
      value={value}
      onChange={onChange}
      profile={profile}
      onSaveToProfile={onSaveToProfile}
      signingBlocked={signingBlocked}
      missingPrerequisites={missingPrerequisites}
    />
  );
}

export function SignaturePreview({
  value,
  label,
  compact,
}: {
  value: string;
  label?: string;
  compact?: boolean;
}) {
  const payload = parseSignatureValue(value);
  if (!payload) return null;

  return (
    <div className={`signature-preview-block${compact ? " signature-preview-compact" : ""}`}>
      {payload.image && payload.mode === "drawn" ? (
        <img src={payload.image} alt={label ?? "Signature"} className="signature-preview-image" />
      ) : (
        <span className="signature-preview-cursive">{payload.name}</span>
      )}
      <div className="signature-preview-meta">
        {payload.title && <span>{payload.title}</span>}
        {payload.entity && <span>{payload.entity}</span>}
      </div>
    </div>
  );
}

export function OwnerSignatureSettings({
  profile,
  context,
  onChange,
}: {
  profile: UserProfile;
  context: SignatureContext;
  onChange: (patch: Pick<UserProfile, "signatures" | "signature">) => void;
}) {
  const saved = getSignatureSettings(profile, context);
  const [draft, setDraft] = useState(saved);
  const draftRef = useRef(saved);
  draftRef.current = draft;

  useEffect(() => {
    const next = getSignatureSettings(profile, context);
    setDraft(next);
    draftRef.current = next;
  }, [
    context,
    profile.signatures,
    saved.signerName,
    saved.signerTitle,
    saved.entityName,
    saved.useDrawnSignature,
    saved.drawnSignature,
  ]);

  const previewPatch = patchSignatureLibrary(profile, context, draft);
  const previewValue = buildOwnerSignatureValue({ ...profile, ...previewPatch }, context);

  function commitDraft(next: SignatureSettings) {
    const current = getSignatureSettings(profile, context);
    if (
      next.signerName === current.signerName &&
      next.signerTitle === current.signerTitle &&
      next.entityName === current.entityName &&
      next.useDrawnSignature === current.useDrawnSignature &&
      next.drawnSignature === current.drawnSignature
    ) {
      return;
    }
    onChange(patchSignatureLibrary(profile, context, next));
  }

  function updateDraftField<K extends keyof SignatureSettings>(key: K, value: SignatureSettings[K]) {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      draftRef.current = next;
      return next;
    });
  }

  function handleFieldBlur() {
    commitDraft(draftRef.current);
  }

  return (
    <section className="owner-signature-settings">
      <h3 className="section-title">Saved Signature</h3>
      <p className="field-help">
        Used on contracts and other binding forms when your preferred profile is{" "}
        {SIGNATURE_CONTEXT_LABELS[context].toLowerCase()}.
      </p>
      <div className="field-group">
        <label>Signer Name</label>
        <input
          type="text"
          value={draft.signerName}
          onChange={(e) => updateDraftField("signerName", e.target.value)}
          onBlur={handleFieldBlur}
          placeholder="Legal name as it appears on documents"
        />
      </div>
      <div className="field-group">
        <label>Title / Role</label>
        <input
          type="text"
          value={draft.signerTitle}
          onChange={(e) => updateDraftField("signerTitle", e.target.value)}
          onBlur={handleFieldBlur}
          placeholder={
            context === "individual"
              ? "Individual, Owner, etc."
              : context === "organization"
                ? "Executive Director, Board Member, etc."
                : "CEO, Authorized Signer, etc."
          }
        />
      </div>
      {context !== "individual" && (
        <div className="field-group">
          <label>Signing On Behalf Of</label>
          <input
            type="text"
            value={draft.entityName}
            onChange={(e) => updateDraftField("entityName", e.target.value)}
            onBlur={handleFieldBlur}
            placeholder={
              context === "organization"
                ? profile.organization.name || "Organization name"
                : profile.business.name || "Business name"
            }
          />
        </div>
      )}
      <label className="security-toggle">
        <input
          type="checkbox"
          checked={draft.useDrawnSignature}
          onChange={(e) => {
            const next = { ...draft, useDrawnSignature: e.target.checked };
            setDraft(next);
            commitDraft(next);
          }}
        />
        <div>
          <strong>Use drawn signature when available</strong>
          <span>Otherwise shows your name in cursive on documents</span>
        </div>
      </label>
      {previewValue && (
        <div className="signature-profile-preview card-inner">
          <span className="field-help">Preview on documents</span>
          <SignaturePreview value={previewValue} label="Authorized Signature" />
        </div>
      )}
      <p className="field-help">
        Draw your signature on any document using the Draw tab under a signature field.
      </p>
    </section>
  );
}
