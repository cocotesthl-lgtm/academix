'use client';

import { useEffect } from 'react';

/**
 * Error boundary de /owner/mis-publicaciones. Cuando la page tira un
 * throw en el server, esto se renderiza en vez del "This page couldn't
 * load" nativo del browser (que aparece porque Next 16 devuelve el error
 * dentro del RSC stream con status 200).
 *
 * Muestra el mensaje real del error para que sepamos qué fallo, y un botón
 * para reintentar. También lo logea a la consola del browser + Vercel.
 */
export default function MisPublicacionesError({
  error, reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[mis-publicaciones] error boundary caught:', error);
  }, [error]);

  return (
    <div className="max-w-2xl p-8">
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 space-y-4">
        <div className="flex items-center gap-2 text-rose-300">
          <span className="text-2xl">⚠️</span>
          <h1 className="text-lg font-semibold">No pudimos cargar tus publicaciones</h1>
        </div>
        <div className="space-y-2 text-sm text-white/70">
          <p><strong>Mensaje:</strong> {error.message || '(sin mensaje)'}</p>
          {error.digest && (
            <p className="text-xs text-white/50 font-mono">
              Digest: {error.digest} · Buscalo en los logs de Vercel para ver el stack completo.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={reset}
            className="text-sm px-4 py-2 rounded bg-white text-black font-semibold hover:bg-white/90">
            🔄 Reintentar
          </button>
          <a href="/dashboard" className="text-sm px-4 py-2 rounded border border-white/15 hover:bg-white/5">
            ← Volver al dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
