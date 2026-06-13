import { requireSuperAdmin } from "@/lib/auth/guards";
import { getAllPlans, getActivePromoCodes } from "@/lib/plans/queries";
import { createPromoCodeAction, togglePromoCodeAction, deletePromoCodeAction } from "@/lib/plans/promo-actions";

export const dynamic = "force-dynamic";

/**
 * Founder: códigos promocionales sobre planes.
 * Se aplican al cambiar plan en /mi-plan del owner.
 */
export default async function FounderPromoCodesPage() {
  await requireSuperAdmin();
  const [plans, codes] = await Promise.all([getAllPlans(), getActivePromoCodes()]);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Códigos promocionales</h1>
          <p className="text-white/55 text-sm mt-1">
            Descuentos % o fijos aplicables a planes seleccionados, con límite de usos y fecha de expiración.
          </p>
        </div>
        <a href="/plans" className="text-xs text-white/55 hover:text-white underline">← Planes</a>
      </div>

      {/* Crear nuevo */}
      <form action={createPromoCodeAction} className="rounded-xl border border-white/15 bg-white/[0.02] p-5 space-y-4">
        <h2 className="font-semibold text-sm">+ Crear nuevo código</h2>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Código (ej. LANZAMIENTO50)">
            <input name="code" required maxLength={30}
              placeholder="LANZAMIENTO50"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono uppercase" />
          </Field>
          <Field label="Descripción (interna)">
            <input name="description" maxLength={200}
              placeholder="Promo black friday"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </Field>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Tipo">
            <select name="discount_type" defaultValue="percent"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
              <option value="percent">% Porcentaje</option>
              <option value="fixed">$ Monto fijo (cents)</option>
            </select>
          </Field>
          <Field label="Valor descuento">
            <input name="discount_value" type="number" min={0} required defaultValue={50}
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </Field>
          <Field label="Aplica a">
            <select name="applies_to" defaultValue="both"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
              <option value="both">Ambos (mensual + anual)</option>
              <option value="monthly">Solo mensual</option>
              <option value="annual">Solo anual</option>
            </select>
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Usos máximos (vacío = ilimitado)">
            <input name="max_uses" type="number" min={1}
              placeholder="Ej. 100"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </Field>
          <Field label="Vence el (vacío = sin vencimiento)">
            <input name="expires_at" type="datetime-local"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </Field>
        </div>

        <Field label="Planes a los que aplica (vacío = todos)">
          <div className="flex flex-wrap gap-3 mt-1">
            {plans.length === 0 ? (
              <p className="text-xs text-white/40">No hay planes creados todavía.</p>
            ) : plans.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer rounded border border-white/10 bg-white/[0.02] px-3 py-1.5">
                <input type="checkbox" name="plan_ids" value={p.id} />
                {p.name}
              </label>
            ))}
          </div>
        </Field>

        <div className="flex justify-end">
          <button className="rounded-md bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-white/90">
            + Crear código
          </button>
        </div>
      </form>

      {/* Lista de códigos */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-3">
          Códigos existentes ({codes.length})
        </h2>
        {codes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-white/45">
            Todavía no creaste códigos.
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#0f0f0f] text-white/55 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5">Código</th>
                  <th className="text-left px-4 py-2.5">Descuento</th>
                  <th className="text-left px-4 py-2.5">Aplica</th>
                  <th className="text-right px-4 py-2.5">Usos</th>
                  <th className="text-left px-4 py-2.5">Vence</th>
                  <th className="text-right px-4 py-2.5">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id} className={`border-t border-white/5 ${!c.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2.5 font-mono font-semibold">{c.code}
                      {c.description && <div className="text-[10px] text-white/45 font-sans font-normal">{c.description}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      {c.discount_type === 'percent' ? `${c.discount_value}%` : `$ ${(c.discount_value / 100).toLocaleString('es-AR')}`}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-white/55">
                      {c.applies_to === 'both' ? 'Mensual + Anual'
                        : c.applies_to === 'monthly' ? 'Solo mensual' : 'Solo anual'}
                      {c.plan_ids.length > 0 && (
                        <div className="text-[10px] text-fuchsia-300 mt-0.5">
                          {c.plan_ids.length} plan{c.plan_ids.length > 1 ? 'es' : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {c.used_count}{c.max_uses !== null ? `/${c.max_uses}` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-white/55">
                      {c.expires_at ? new Date(c.expires_at).toLocaleDateString('es-AR') : 'Sin límite'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex gap-1 justify-end">
                        <form action={togglePromoCodeAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="active" value={c.is_active ? 'false' : 'true'} />
                          <button className="text-xs px-2 py-1 rounded border border-white/15 hover:bg-white/5">
                            {c.is_active ? 'Pausar' : 'Activar'}
                          </button>
                        </form>
                        <form action={deletePromoCodeAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <button className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10">
                            Borrar
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
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
