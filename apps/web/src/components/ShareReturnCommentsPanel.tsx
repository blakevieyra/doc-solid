"use client";

import type { DocumentShare } from "@/lib/team/invites";
import { getShareReturnComments } from "@/lib/team/share-document";

export function ShareReturnCommentsPanel({
  share,
  compact,
}: {
  share: DocumentShare;
  compact?: boolean;
}) {
  const comments = getShareReturnComments(share);
  if (comments.length === 0) return null;

  return (
    <div
      className={`share-return-comments${compact ? " share-return-comments-compact" : ""}`}
      role="region"
      aria-label="Returned comments"
    >
      <strong>
        {comments.length === 1
          ? `Comment from ${share.toName}`
          : `Comments from ${share.toName}`}
      </strong>
      <ul className="share-return-comments-list">
        {comments.map((event, index) => (
          <li key={`${event.timestamp}-${index}`}>
            <p className="share-return-comments-body">{event.details}</p>
            <span className="share-return-comments-meta">
              {new Date(event.timestamp).toLocaleString()}
              {event.actorName ? ` · ${event.actorName}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
