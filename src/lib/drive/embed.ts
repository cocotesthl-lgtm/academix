/**
 * Parse a Google Drive share URL or raw ID into a canonical file ID.
 *
 * Accepts:
 *  - https://drive.google.com/file/d/<ID>/view
 *  - https://drive.google.com/file/d/<ID>/view?usp=sharing
 *  - https://drive.google.com/open?id=<ID>
 *  - https://drive.google.com/uc?id=<ID>&export=download
 *  - bare ID like "1A2b3C4d..."
 */
export function extractDriveFileId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Bare ID heuristic: Drive IDs are 25-44 chars of [a-zA-Z0-9_-]
  if (/^[a-zA-Z0-9_-]{20,60}$/.test(trimmed)) return trimmed;

  // Try URL parsing
  try {
    const url = new URL(trimmed);
    if (!url.hostname.endsWith('drive.google.com') && !url.hostname.endsWith('docs.google.com')) {
      return null;
    }

    // /file/d/<ID>/...
    const m = url.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return m[1];

    // /document/d/<ID>/...
    const m2 = url.pathname.match(/\/(?:document|spreadsheets|presentation)\/d\/([a-zA-Z0-9_-]+)/);
    if (m2) return m2[1];

    // ?id=<ID>
    const idParam = url.searchParams.get('id');
    if (idParam) return idParam;

    return null;
  } catch {
    return null;
  }
}

/**
 * Build the embeddable preview URL for a Drive file ID.
 * Works for video, PDF, images and most file types.
 */
export function buildEmbedUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function buildShareUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}
