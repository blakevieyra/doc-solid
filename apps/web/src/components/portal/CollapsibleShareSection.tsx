"use client";

import { useState, type ReactNode } from "react";

export function CollapsibleShareSection({
  title,
  count,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  hint?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="share-section-collapse">
      <button
        type="button"
        className="share-section-collapse-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="share-section-collapse-title">
          {title}
          <span className="share-section-collapse-count">({count})</span>
        </span>
        <span className="share-section-collapse-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {hint && <p className="field-help share-section-collapse-hint">{hint}</p>}
      {open && <div className="share-section-collapse-body">{children}</div>}
    </div>
  );
}
