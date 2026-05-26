'use client';

import { useState, useTransition } from 'react';
import { createAffiliateLinkAction } from '@/lib/affiliates/actions';

export function AffiliateLinkButton({
  courseId,
  tenantSlug,
  initialCode,
  initialUrl,
  primary
}: {
  courseId: string;
  tenantSlug: string;
  initialCode?: string | null;
  initialUrl?: string | null;
  primary: string;
}) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set('course_id', courseId);
      fd.set('tenant_slug', tenantSlug);
      const res = await createAffiliateLinkAction(fd);
      if (res.ok) setUrl(res.url);
      else setError(res.error);
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {/* ignore */}
  }

  if (url) {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <input
            readOnly
            value={url}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="flex-1 rounded border border-black/10 px-3 py-2 text-sm font-mono bg-black/[0.02]"
          />
          <button
            onClick={copy}
            className="rounded px-3 py-2 text-sm font-medium text-white"
            style={{ background: primary }}
          >
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
        {initialCode && (
          <p className="text-xs text-black/40">Código: {initialCode}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={generate}
        disabled={pending}
        className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        style={{ background: primary }}
      >
        {pending ? 'Generando…' : 'Generar mi link'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
