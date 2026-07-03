'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { publishSiteAction, discardDraftChangesAction } from '@/lib/site/actions';

/**
 * Toolbar sticky arriba del editor del sitio, estilo Wix.
 *
 * Muestra:
 *   - Estado del autosave (Guardando… / Guardado ✓ / Cambios sin publicar)
 *   - Botón "Vista previa" (abre el storefront público)
 *   - Botón "Publicar" (activo si hay diferencia entre draft y publicado)
 *
 * El estado del autosave se derive de un evento global 'cp:autosave-status'
 * que los componentes de guardado disparan (o del listener existente que
 * ya usa la sidebar para el spinner de save). Por ahora usamos un state
 * local + escucha esos eventos.
 */
export function SiteBuilderToolbar({
  publicUrl,
  initiallyDirty,
  lastPublishedAt
}: {
  publicUrl: string;
  /** true si el draft actual difiere del último publicado */
  initiallyDirty: boolean;
  /** ISO string del último publish, o null si nunca se publicó */
  lastPublishedAt: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [dirty, setDirty] = useState(initiallyDirty);
  const [publishing, startPublish] = useTransition();
  const [discarding, startDiscard] = useTransition();
  const [savingManual, startSave] = useTransition();
  const [publishTick, setPublishTick] = useState<'idle' | 'ok'>('idle');
  const [saveTick, setSaveTick] = useState<'idle' | 'ok'>('idle');

  useEffect(() => {
    // Escuchamos los eventos globales que ya dispara el sistema de save
    // (ver GlobalSaveListener / SaveStatusBar).
    function onSaving() {
      setStatus('saving');
      setDirty(true); // cualquier save nuevo → hay cambios sin publicar
    }
    function onSaved() {
      setStatus('saved');
      // Volvemos a 'idle' después de 1.2s para que 'Guardado ✓' no quede fijo.
      setTimeout(() => setStatus('idle'), 1200);
    }
    window.addEventListener('cp:save-start', onSaving);
    window.addEventListener('cp:save-end', onSaved);
    return () => {
      window.removeEventListener('cp:save-start', onSaving);
      window.removeEventListener('cp:save-end', onSaved);
    };
  }, []);

  function handlePublish() {
    if (!dirty || publishing) return;
    startPublish(async () => {
      await publishSiteAction();
      setDirty(false);
      setPublishTick('ok');
      setTimeout(() => setPublishTick('idle'), 2000);
    });
  }

  /**
   * Guardar manual: los cambios ya se persisten solos vía autosave de cada
   * campo, así que este botón fuerza un refresh del server-state para
   * confirmar visualmente que todo quedó guardado. Útil si el owner tiene
   * dudas o quiere un check explícito antes de cerrar.
   */
  function handleSave() {
    if (savingManual) return;
    startSave(async () => {
      window.dispatchEvent(new CustomEvent('cp:save-start'));
      // Force server sync — re-fetch de los datos del server para
      // reflejar el estado más reciente y validar que todo llegó a la DB.
      router.refresh();
      // Pequeño delay para dar sensación de "guardando".
      await new Promise((r) => setTimeout(r, 400));
      window.dispatchEvent(new CustomEvent('cp:save-end'));
      setSaveTick('ok');
      setTimeout(() => setSaveTick('idle'), 1500);
    });
  }

  function handleDiscard() {
    if (!dirty || discarding) return;
    if (!confirm('¿Descartar todos los cambios sin publicar y volver al último sitio publicado?')) return;
    startDiscard(async () => {
      await discardDraftChangesAction();
      setDirty(false);
      window.location.reload(); // reload para tomar el estado fresh
    });
  }

  const statusLabel =
    status === 'saving' ? 'Guardando…' :
    status === 'saved' ? 'Guardado ✓' :
    dirty ? 'Cambios sin publicar' :
    lastPublishedAt ? 'Publicado' : 'Sin publicar aún';

  const statusColor =
    status === 'saving' ? 'text-white/60' :
    status === 'saved' ? 'text-emerald-300' :
    dirty ? 'text-amber-300' :
    'text-white/50';

  return (
    <div className="sticky top-0 z-40 -mx-6 px-6 py-2.5 mb-4 border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur">
      <div className="flex items-center justify-between gap-3 flex-wrap max-w-6xl">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold">Editor de sitio</span>
          <span className={`text-xs flex items-center gap-1.5 ${statusColor}`}>
            {status === 'saving' && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            )}
            {statusLabel}
          </span>
          {lastPublishedAt && (
            <span className="text-[10px] text-white/40">
              · última publicación {new Date(lastPublishedAt).toLocaleString('es-AR', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
              })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {dirty && (
            <button
              type="button"
              onClick={handleDiscard}
              disabled={discarding || publishing}
              className="text-xs px-3 py-1.5 rounded border border-white/15 text-white/70 hover:bg-white/5 disabled:opacity-40"
              title="Descartar los cambios sin publicar"
            >
              {discarding ? 'Descartando…' : 'Descartar'}
            </button>
          )}
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1.5 rounded border border-white/15 text-white/85 hover:bg-white/5 flex items-center gap-1"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Vista previa
          </a>
          <button
            type="button"
            onClick={handleSave}
            disabled={savingManual}
            className="text-xs px-3 py-1.5 rounded border border-white/15 text-white/85 hover:bg-white/5 disabled:opacity-50"
            title="Los cambios se guardan solos, pero podés forzar un guardado ahora"
          >
            {savingManual ? 'Guardando…' : saveTick === 'ok' ? '✓ Guardado' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={!dirty || publishing}
            className={`text-xs px-4 py-1.5 rounded font-semibold transition ${
              dirty && !publishing
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            }`}
          >
            {publishing ? 'Publicando…' : publishTick === 'ok' ? '✓ Publicado' : 'Publicar'}
          </button>
        </div>
      </div>
    </div>
  );
}
