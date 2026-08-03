'use client';

import { useState, useTransition } from 'react';
import { updatePaywallAction } from '@/lib/site/actions';
import type { SiteConfig } from '@/lib/site/types';

/**
 * Editor del paywall del blog (client component).
 *
 * Cambio principal vs versión anterior (server): las 3 cards de modo
 * (off / soft / hard) ahora AUTO-SUBMITEAN al clickearse. El botón
 * "Guardar" del final sigue existiendo para los campos de texto/CTA
 * pero el toggle del modo es instantáneo — matching UX estándar.
 */
export function PaywallEditor({ cfg }: { cfg: SiteConfig['paywall'] }) {
  const [mode, setMode] = useState<'off' | 'soft' | 'hard'>(cfg?.mode || 'off');
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function submitCurrent(newMode?: 'off' | 'soft' | 'hard') {
    // Snapshot de todos los campos del form (los toma DOM directo).
    const form = document.getElementById('paywall-form') as HTMLFormElement | null;
    if (!form) return;
    const fd = new FormData(form);
    if (newMode) fd.set('mode', newMode);
    start(async () => {
      await updatePaywallAction(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    });
  }

  function pickMode(v: 'off' | 'soft' | 'hard') {
    setMode(v);
    submitCurrent(v);
  }

  return (
    <form
      id="paywall-form"
      className="space-y-4"
      onSubmit={(e) => { e.preventDefault(); submitCurrent(); }}
    >
      <div className="grid md:grid-cols-3 gap-3">
        {([
          { v: 'off', icon: '🔓', label: 'Sin paywall', desc: 'Todas las notas se leen completas. Comportamiento tradicional.' },
          { v: 'soft', icon: '💡', label: 'Opcional', desc: 'Muestra los primeros párrafos + banner recomendando suscribirse, pero el visitante puede cerrar y leer igual.' },
          { v: 'hard', icon: '🔒', label: 'Obligatorio', desc: 'Los primeros párrafos gratis + gate bloqueante. Sin suscripción no se puede leer el resto.' }
        ] as const).map((opt) => (
          <button
            key={opt.v}
            type="button"
            onClick={() => pickMode(opt.v)}
            disabled={pending}
            className={`text-left cursor-pointer border-2 rounded-lg p-4 transition disabled:opacity-70 ${
              mode === opt.v
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-white/15 bg-white/[0.03] hover:border-white/30'
            }`}
          >
            {/* Radio hidden solo para que se serialice al FormData del submit */}
            <input type="radio" name="mode" value={opt.v} checked={mode === opt.v} onChange={() => {}} className="sr-only" />
            <div className="text-3xl mb-2">{opt.icon}</div>
            <div className="font-bold mb-1">{opt.label}</div>
            <div className="text-xs text-white/70">{opt.desc}</div>
          </button>
        ))}
      </div>

      {mode !== 'off' && (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-xs font-semibold text-white/70">Párrafos gratis antes del paywall</span>
              <input name="free_paragraphs" type="number" min={1} max={10}
                defaultValue={cfg?.free_paragraphs ?? 3}
                className="mt-1 w-full border border-white/15 bg-white/[0.02] rounded px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-semibold text-white/70">Link del CTA (ancla o URL)</span>
              <input name="cta_href" defaultValue={cfg?.cta_href ?? '#pricing'}
                className="mt-1 w-full border border-white/15 bg-white/[0.02] rounded px-3 py-2 text-sm font-mono"
                placeholder="#pricing" />
            </label>
          </div>

          <label className="block text-sm">
            <span className="text-xs font-semibold text-white/70">Título del paywall</span>
            <input name="title" defaultValue={cfg?.title ?? ''} maxLength={120}
              className="mt-1 w-full border border-white/15 bg-white/[0.02] rounded px-3 py-2 text-sm"
              placeholder="Seguí leyendo esta nota" />
          </label>

          <label className="block text-sm">
            <span className="text-xs font-semibold text-white/70">Mensaje</span>
            <textarea name="message" defaultValue={cfg?.message ?? ''} rows={2} maxLength={400}
              className="mt-1 w-full border border-white/15 bg-white/[0.02] rounded px-3 py-2 text-sm"
              placeholder="Suscribite y accedé sin límites a todas nuestras notas..." />
          </label>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-xs font-semibold text-white/70">Texto del botón CTA</span>
              <input name="cta_label" defaultValue={cfg?.cta_label ?? 'Suscribirme ahora'} maxLength={60}
                className="mt-1 w-full border border-white/15 bg-white/[0.02] rounded px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm">
              <span className="text-xs font-semibold text-white/70">
                Texto &ldquo;seguir leyendo igual&rdquo; (solo modo Opcional)
              </span>
              <input name="dismiss_label" defaultValue={cfg?.dismiss_label ?? 'Seguir leyendo igual'} maxLength={60}
                className="mt-1 w-full border border-white/15 bg-white/[0.02] rounded px-3 py-2 text-sm" />
            </label>
          </div>

          <button type="submit" disabled={pending}
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50">
            {pending ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar textos del paywall'}
          </button>
        </>
      )}

      {mode === 'off' && (pending || saved) && (
        <div className="text-xs text-emerald-300">
          {pending ? 'Guardando…' : '✓ Paywall desactivado — todas las notas se leen completas.'}
        </div>
      )}
    </form>
  );
}
