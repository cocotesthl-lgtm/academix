import { requireSuperAdmin } from "@/lib/auth/guards";
import { getAllPlans } from "@/lib/plans/queries";
import { updatePlanAction, reorderPlanAction } from "@/lib/plans/actions";
import type { Plan } from "@/lib/plans/types";

export const dynamic = "force-dynamic";

/**
 * Editor del founder para los planes que vende a los owners.
 * Inspirado en el patron del site builder — un form por plan, edit
 * inline, save dispara update + revalidate.
 */
export default async function FounderPlansPage() {
  await requireSuperAdmin();
  const plans = await getAllPlans();

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Planes de suscripción</h1>
        <p className="text-white/55 text-sm mt-1">
          Configurá precios, features y orden de los planes que ofrecés a los sitios.
          Cualquier cambio aplica al instante en la página <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">/mi-plan</code> del owner.
        </p>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-200">
          <p className="font-semibold mb-2">⚠️ Migración 0023 pendiente</p>
          <p className="text-sm">
            Corré <code className="bg-black/30 px-1 rounded">RUN_THIS_NOW.sql</code> en Supabase
            para crear la tabla <code className="bg-black/30 px-1 rounded">plans</code> con los 3 planes default.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((p, idx) => (
            <PlanEditor key={p.id} plan={p} canMoveUp={idx > 0} canMoveDown={idx < plans.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlanEditor({ plan, canMoveUp, canMoveDown }: { plan: Plan; canMoveUp: boolean; canMoveDown: boolean }) {
  return (
    <details className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden" open={plan.is_featured}>
      <summary className="px-5 py-4 cursor-pointer flex items-center gap-3 hover:bg-white/[0.02]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <strong className="text-base">{plan.name}</strong>
            {plan.is_featured && (
              <span className="text-[10px] uppercase tracking-wider rounded border border-orange-500/40 bg-orange-500/10 text-amber-300 px-2 py-0.5">
                ★ Destacado
              </span>
            )}
            {!plan.is_active && (
              <span className="text-[10px] uppercase tracking-wider rounded border border-white/15 text-white/45 px-2 py-0.5">
                Inactivo
              </span>
            )}
          </div>
          <div className="text-xs text-white/55 mt-0.5">{plan.tagline}</div>
        </div>
        <div className="font-mono text-sm">
          <div>{plan.currency} {(plan.price_cents_monthly / 100).toLocaleString('es-AR')} <span className="text-white/40 text-xs">/mes</span></div>
          <div className="text-xs text-white/55">{plan.currency} {(plan.price_cents_annual / 100).toLocaleString('es-AR')} <span className="text-white/40">/año</span></div>
        </div>
        <div className="flex items-center gap-1">
          {canMoveUp && (
            <form action={reorderPlanAction} className="inline">
              <input type="hidden" name="id" value={plan.id} />
              <input type="hidden" name="direction" value="up" />
              <button title="Mover arriba" className="w-7 h-7 grid place-items-center rounded hover:bg-white/5 text-white/55">↑</button>
            </form>
          )}
          {canMoveDown && (
            <form action={reorderPlanAction} className="inline">
              <input type="hidden" name="id" value={plan.id} />
              <input type="hidden" name="direction" value="down" />
              <button title="Mover abajo" className="w-7 h-7 grid place-items-center rounded hover:bg-white/5 text-white/55">↓</button>
            </form>
          )}
        </div>
      </summary>

      <form action={updatePlanAction} className="p-5 border-t border-white/10 space-y-5 bg-black/20">
        <input type="hidden" name="id" value={plan.id} />

        {/* Identidad */}
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nombre del plan">
            <input name="name" defaultValue={plan.name} maxLength={60} required
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </Field>
          <Field label="Tagline (1 línea corta)">
            <input name="tagline" defaultValue={plan.tagline ?? ''} maxLength={120}
              placeholder="Para sitios en crecimiento"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </Field>
        </div>
        <Field label="Descripción larga">
          <textarea name="description" defaultValue={plan.description ?? ''} maxLength={500} rows={2}
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm resize-none" />
        </Field>

        {/* Pricing */}
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label={`Precio mensual (${plan.currency})`}>
            <input name="price_monthly" defaultValue={(plan.price_cents_monthly / 100).toString()}
              inputMode="numeric"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono" />
          </Field>
          <Field label={`Precio anual (${plan.currency}) — total`}>
            <input name="price_annual" defaultValue={(plan.price_cents_annual / 100).toString()}
              inputMode="numeric"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono" />
          </Field>
          <Field label="Moneda">
            <input name="currency" defaultValue={plan.currency} maxLength={3}
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono uppercase" />
          </Field>
        </div>

        {/* Trial */}
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
          <Field label="Días de trial gratis (0 = sin trial · captura tarjeta y auto-cobra al final)">
            <input name="trial_days" type="number" min={0} max={90}
              defaultValue={plan.trial_days ?? 0}
              className="w-full sm:w-32 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </Field>
          <p className="text-[10px] text-white/45 mt-1.5">
            Con trial: el owner mete tarjeta en MP al activar, no se cobra durante X días, MP auto-cobra el día X+1.
            Si pone 0, el botón "Trial" desaparece y solo queda "Suscribirse ya".
          </p>
        </div>

        {/* Toggles */}
        <div className="flex gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" name="is_active" defaultChecked={plan.is_active} />
            Activo (visible para owners)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" name="is_featured" defaultChecked={plan.is_featured} />
            ★ Destacado (resaltado visual)
          </label>
        </div>

        {/* Features */}
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-3">
          <h3 className="text-xs uppercase tracking-wider text-white/55 font-semibold">Features / cuotas</h3>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Dominios custom max">
              <input name="f_domains" type="number" min={0} max={99} defaultValue={plan.features.domains_max}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </Field>
            <Field label="Emails marketing /mes">
              <input name="f_email_marketing" type="number" min={0} max={1000000} defaultValue={plan.features.email_marketing_monthly}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </Field>
            <Field label="Storage (GB)">
              <input name="f_storage_gb" type="number" min={0} max={9999} defaultValue={plan.features.storage_gb}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </Field>
            <Field label="Publicaciones destacados">
              <input name="f_featured" type="number" min={0} max={999} defaultValue={plan.features.featured_listings}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
              <p className="text-[10px] text-white/40 mt-1">999 = ilimitado</p>
            </Field>
            <Field label="SLA soporte (horas)">
              <input name="f_sla_hours" type="number" min={1} max={168} defaultValue={plan.features.support_sla_hours}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </Field>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" name="f_uploads" defaultChecked={plan.features.uploads_enabled} />
                Permite subir archivos
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" name="f_priority" defaultChecked={plan.features.support_priority} />
                Soporte prioritario
              </label>
            </div>
          </div>
          <Field label="Features adicionales (una por línea)">
            <textarea name="f_extras" defaultValue={plan.features.extras.join('\n')}
              rows={3} placeholder={'Insignia premium\nAPI access\nManager dedicado'}
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm resize-none" />
          </Field>
        </div>

        <div className="flex justify-end">
          <button className="rounded-md bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-white/90">
            Guardar cambios
          </button>
        </div>
      </form>
    </details>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-white/45 mb-1">{label}</span>
      {children}
    </label>
  );
}
