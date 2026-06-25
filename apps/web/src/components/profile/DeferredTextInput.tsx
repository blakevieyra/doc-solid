"use client";

import { useEffect, useRef, useState } from "react";

/** Text input that keeps a local draft while typing and commits on blur. */
export function DeferredTextInput({
  value,
  onCommit,
  type = "text",
  placeholder,
  readOnly,
  className,
  id,
  autoComplete,
  transform,
}: {
  value: string;
  onCommit: (v: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  id?: string;
  autoComplete?: string;
  /** Applied when committing (e.g. strip leading @ from usernames). */
  transform?: (v: string) => string;
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  function commit() {
    focused.current = false;
    const next = transform ? transform(draft) : draft;
    if (next !== value) onCommit(next);
    else if (transform && next !== draft) setDraft(next);
  }

  return (
    <input
      id={id}
      type={type}
      value={draft}
      readOnly={readOnly}
      placeholder={placeholder}
      className={className}
      autoComplete={autoComplete}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

/** Textarea that keeps a local draft while typing and commits on blur. */
export function DeferredTextArea({
  value,
  onCommit,
  rows = 4,
  placeholder,
  className,
  id,
}: {
  value: string;
  onCommit: (v: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
  id?: string;
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  function commit() {
    focused.current = false;
    if (draft !== value) onCommit(draft);
  }

  return (
    <textarea
      id={id}
      rows={rows}
      value={draft}
      placeholder={placeholder}
      className={className}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
    />
  );
}

export function ProfileField({
  label,
  value,
  onChange,
  type = "text",
  sensitive,
  help,
  readOnly,
  transform,
  as,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  sensitive?: boolean;
  help?: string;
  readOnly?: boolean;
  transform?: (v: string) => string;
  as?: "select";
  options?: string[];
}) {
  return (
    <div className="field-group">
      <label className="field-label">
        {label}
        {sensitive && " 🔒"}
      </label>
      {as === "select" ? (
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options?.map((o) => (
            <option key={o} value={o}>
              {o.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      ) : (
        <DeferredTextInput
          type={type}
          value={value}
          onCommit={onChange}
          readOnly={readOnly}
          transform={transform}
        />
      )}
      {help && <span className="field-help">{help}</span>}
    </div>
  );
}

export function ProfileTextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="field-group">
      <label className="field-label">{label}</label>
      <DeferredTextArea value={value} onCommit={onChange} />
    </div>
  );
}
