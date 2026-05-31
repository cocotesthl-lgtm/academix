'use client';

import { useState } from 'react';

export function CopyButton({ value, label = 'Copiar' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard puede no estar disponible en algunos contextos */
        }
      }}
      className="text-xs rounded border border-white/20 bg-white/5 hover:bg-white/10 px-2 py-1 text-white/80"
    >
      {copied ? '✓ Copiado' : label}
    </button>
  );
}
