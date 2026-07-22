'use client';

import { useState } from 'react';

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard bloqueado */ }
  }

  const waHref = `https://wa.me/?text=${encodeURIComponent(url)}`;

  return (
    <div className="flex gap-2">
      <button type="button" onClick={copy}
        className="text-sm px-3 py-1.5 rounded bg-emerald-500 text-black font-semibold hover:bg-emerald-400 whitespace-nowrap">
        {copied ? '✓ Copiado' : '📋 Copiar link'}
      </button>
      <a href={waHref} target="_blank" rel="noopener"
        className="text-sm px-3 py-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 whitespace-nowrap">
        WhatsApp →
      </a>
    </div>
  );
}
