export async function parseJsonApiResponse<T extends { error?: string }>(
  res: Response,
  fallbacks?: Partial<Record<number, string>>
): Promise<T> {
  const text = await res.text();
  if (!text) {
    const fallback = fallbacks?.[res.status];
    if (fallback) return { error: fallback } as T;
    if (res.status === 413) {
      return { error: "Attachment too large. Try downloading instead or shorten the document." } as T;
    }
    if (res.status === 503) {
      return { error: "Service unavailable. Try again later or contact support." } as T;
    }
    return { error: `Server error (${res.status}). Please try again.` } as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return { error: `Unexpected server response (${res.status}). Please try again.` } as T;
  }
}
