'use client';

/**
 * Botones de acción del ticket público — Imprimir (=guardar PDF) + Compartir.
 *
 * - Imprimir abre el diálogo nativo del browser. En desktop = "Guardar
 *   como PDF". En mobile (iOS Safari, Chrome Android) también permite
 *   guardar como PDF o mandar al print.
 * - Compartir usa Web Share API si está disponible, sino cae a copiar
 *   la URL al clipboard.
 *
 * Se ocultan en print via .no-print (definido inline en el page).
 */

import { useState } from 'react';

export function TicketActions({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  function onPrint() {
    window.print();
  }

  async function onShare() {
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Mi ticket', url });
        return;
      }
    } catch { /* user canceled */ }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* no clipboard access */ }
  }

  return (
    <div className="flex gap-2 mt-4 no-print">
      <button
        type="button"
        onClick={onPrint}
        className="flex-1 rounded-lg bg-white text-black px-4 py-2.5 text-sm font-semibold hover:bg-white/90 shadow-lg flex items-center justify-center gap-2"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        Imprimir / Guardar PDF
      </button>
      <button
        type="button"
        onClick={onShare}
        className="rounded-lg border border-white/30 px-4 py-2.5 text-sm font-medium hover:bg-white/10 text-white flex items-center gap-2"
      >
        {copied ? (
          <>✓ Copiado</>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Compartir
          </>
        )}
      </button>
    </div>
  );
}
