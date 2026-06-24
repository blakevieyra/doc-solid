"use client";

import { useRef, useState } from "react";
import { validateLogoFile, prepareLogoForStorage } from "@/lib/profile/security";

interface LogoUploaderProps {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
}

export function LogoUploader({ value, onChange, label = "Business Logo" }: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    const check = validateLogoFile(file);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    try {
      const dataUrl = await prepareLogoForStorage(file);
      onChange(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process logo");
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="logo-uploader">
      <label className="field-label">{label}</label>
      <div
        className={`logo-dropzone${dragging ? " logo-dropzone-active" : ""}${value ? " logo-dropzone-has-image" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      >
        {value ? (
          <img src={value} alt="Logo preview" className="logo-preview" />
        ) : (
          <div className="logo-placeholder">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span>Drop logo here or click to upload</span>
            <span className="field-help">PNG, JPG, WebP, SVG · Max 2 MB</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {value && (
        <button type="button" className="btn btn-secondary btn-sm logo-remove" onClick={(e) => { e.stopPropagation(); onChange(null); }}>
          Remove logo
        </button>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
