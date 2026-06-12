import Link from 'next/link';

/**
 * Checklist de onboarding visible en el dashboard hasta que se completan
 * los 4 pasos críticos para tener una academia funcional:
 *  1. Personalizar marca (logo o color)
 *  2. Conectar MercadoPago
 *  3. Crear primer curso
 *  4. Publicarlo
 *
 * Se oculta automáticamente cuando los 4 están done (porque ya no aporta).
 *
 * Inspirado en checklists de Stripe/Linear/Vercel — la sensación de
 * "1/4 completados → 4/4 completados" es uno de los mejores motores
 * de engagement en SaaS según research de Userlist y Appcues.
 */

export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  href: string;
  done: boolean;
};

export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / steps.length) * 100);
  if (done === steps.length) return null;

  return (
    <div className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/[0.08] to-purple-500/[0.04] p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="font-bold text-lg text-fuchsia-100">Configurá tu academia</h3>
          <p className="text-xs text-white/60 mt-0.5">
            {done} de {steps.length} pasos completados · te toma 5 minutos
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-fuchsia-200">{pct}%</div>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-5">
        <div
          className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Lista de pasos */}
      <ul className="space-y-2">
        {steps.map((s) => (
          <li key={s.id}>
            <Link
              href={s.href}
              className={`flex items-start gap-3 rounded-lg px-3 py-2.5 transition ${
                s.done
                  ? 'opacity-50'
                  : 'hover:bg-white/5 cursor-pointer'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 grid place-items-center ${
                s.done
                  ? 'border-fuchsia-400 bg-fuchsia-400'
                  : 'border-white/30 bg-transparent'
              }`}>
                {s.done && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-medium text-sm ${s.done ? 'line-through' : ''}`}>{s.title}</div>
                <div className="text-xs text-white/55 mt-0.5">{s.description}</div>
              </div>
              {!s.done && (
                <span className="text-fuchsia-300 text-sm whitespace-nowrap">→</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
