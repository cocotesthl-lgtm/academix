'use client';

import { useState, useTransition } from 'react';
import { setCoursePricingModeAction } from '@/lib/courses/subscriptions';

/**
 * Editor del modelo de pricing del curso: pago único vs suscripción
 * recurrente vía MP Preapproval.
 *
 * Si elige subscription, decide frequency (monthly|yearly) + trial_days
 * opcional. El precio del curso (price_cents) se interpreta como el monto
 * que se cobra cada ciclo.
 */
export function CourseSubscriptionConfig({
  courseId,
  initialMode,
  initialFrequency,
  initialTrialDays,
  priceCents,
  currency
}: {
  courseId: string;
  initialMode: 'one_time' | 'subscription';
  initialFrequency: 'monthly' | 'yearly' | null;
  initialTrialDays: number;
  priceCents: number;
  currency: string;
}) {
  const [mode, setMode] = useState(initialMode);
  const [freq, setFreq] = useState<'monthly' | 'yearly'>(initialFrequency ?? 'monthly');
  const [trial, setTrial] = useState(initialTrialDays);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function save(next?: Partial<{ mode: 'one_time' | 'subscription'; frequency: 'monthly' | 'yearly'; trial: number }>) {
    const fd = new FormData();
    fd.set('course_id', courseId);
    fd.set('pricing_mode', next?.mode ?? mode);
    fd.set('subscription_frequency', next?.frequency ?? freq);
    fd.set('subscription_trial_days', String(next?.trial ?? trial));
    start(async () => {
      await setCoursePricingModeAction(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  const priceFmt = `$${(priceCents / 100).toLocaleString('es-AR')} ${currency}`;
  const freqLabel = freq === 'monthly' ? 'por mes' : 'por año';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => { setMode('one_time'); save({ mode: 'one_time' }); }}
          disabled={pending}
          className={`text-left rounded-lg border p-4 transition ${
            mode === 'one_time'
              ? 'border-emerald-500/50 bg-emerald-500/10'
              : 'border-white/15 hover:bg-white/[0.03]'
          }`}
        >
          <div className="text-2xl mb-1">💵</div>
          <div className="font-semibold text-sm">Pago único</div>
          <div className="text-[11px] text-white/50 mt-1">
            El comprador paga una vez y queda inscripto de por vida.
          </div>
        </button>
        <button
          type="button"
          onClick={() => { setMode('subscription'); save({ mode: 'subscription' }); }}
          disabled={pending}
          className={`text-left rounded-lg border p-4 transition ${
            mode === 'subscription'
              ? 'border-fuchsia-500/50 bg-fuchsia-500/10'
              : 'border-white/15 hover:bg-white/[0.03]'
          }`}
        >
          <div className="text-2xl mb-1">🔁</div>
          <div className="font-semibold text-sm">Suscripción recurrente</div>
          <div className="text-[11px] text-white/50 mt-1">
            MP cobra automáticamente cada mes/año. Cancela en cualquier momento.
          </div>
        </button>
      </div>

      {mode === 'subscription' && (
        <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">
              Frecuencia de cobro
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setFreq('monthly'); save({ frequency: 'monthly' }); }}
                disabled={pending}
                className={`text-sm px-3 py-2 rounded border ${
                  freq === 'monthly'
                    ? 'border-white bg-white/10'
                    : 'border-white/15 hover:bg-white/5'
                }`}
              >
                Mensual ({priceFmt}/mes)
              </button>
              <button
                type="button"
                onClick={() => { setFreq('yearly'); save({ frequency: 'yearly' }); }}
                disabled={pending}
                className={`text-sm px-3 py-2 rounded border ${
                  freq === 'yearly'
                    ? 'border-white bg-white/10'
                    : 'border-white/15 hover:bg-white/5'
                }`}
              >
                Anual ({priceFmt}/año)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/40 mb-1">
              Período de prueba (gratis) — opcional
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0} max={365}
                value={trial}
                onChange={(e) => setTrial(parseInt(e.target.value || '0', 10))}
                onBlur={() => save()}
                className="w-32 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
              />
              <span className="text-white/45 text-sm">días antes del primer cobro</span>
            </div>
            <p className="text-[11px] text-white/45 mt-1">
              0 = sin trial · MP cobra apenas el comprador autoriza.
            </p>
          </div>

          <div className="rounded p-3 bg-fuchsia-500/5 border border-fuchsia-500/20 text-xs text-fuchsia-200 space-y-1">
            <div>💡 Resumen: <strong>{priceFmt} {freqLabel}</strong>{trial > 0 ? `, primeros ${trial} días gratis` : ''}.</div>
            <div className="text-fuchsia-200/70">
              El comprador autoriza una vez en MP y se cobra recurrente. El access al curso
              se da al primer cobro confirmado. Si MP no cobra (tarjeta expirada, etc),
              suspendés desde el panel.
            </div>
          </div>

          {saved && <p className="text-xs text-emerald-300">✓ Guardado</p>}
        </div>
      )}
    </div>
  );
}
