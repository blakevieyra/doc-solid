"use client";

import { useState } from "react";
import type { DocumentAuditEvent } from "@doc-solid/storage";
import { getDocumentAuditLabel } from "@/lib/documents/audit";

interface DocumentAuditTrailProps {
  events: DocumentAuditEvent[];
  compact?: boolean;
}

export function DocumentAuditTrail({ events, compact = false }: DocumentAuditTrailProps) {
  const [open, setOpen] = useState(false);
  if (!events.length) return null;

  const latest = events[events.length - 1];

  if (compact) {
    return (
      <div className="doc-audit-trail doc-audit-trail-compact">
        <p className="doc-audit-latest">
          <strong>{getDocumentAuditLabel(latest)}</strong>
          {" · "}
          {new Date(latest.timestamp).toLocaleString()}
          {latest.actorName ? ` · ${latest.actorName}` : ""}
        </p>
        {events.length > 1 && (
          <>
            <button
              type="button"
              className="share-activity-toggle"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
            >
              Audit trail ({events.length}) {open ? "▾" : "▸"}
            </button>
            {open && (
              <ul className="share-audit-log">
                {[...events].reverse().map((event, i) => (
                  <li key={`${event.type}-${event.timestamp}-${i}`}>
                    <strong>{getDocumentAuditLabel(event)}</strong>
                    {" · "}
                    {new Date(event.timestamp).toLocaleString()}
                    {event.actorName ? ` · ${event.actorName}` : ""}
                    {event.details ? ` — ${event.details}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <ul className="share-audit-log">
      {[...events].reverse().map((event, i) => (
        <li key={`${event.type}-${event.timestamp}-${i}`}>
          <strong>{getDocumentAuditLabel(event)}</strong>
          {" · "}
          {new Date(event.timestamp).toLocaleString()}
          {event.actorName ? ` · ${event.actorName}` : ""}
          {event.details ? ` — ${event.details}` : ""}
        </li>
      ))}
    </ul>
  );
}
