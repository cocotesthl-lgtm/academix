import { requireOwner } from '@/lib/auth/guards';
import { getTenantModules } from '@/lib/modules/queries';
import { toggleModuleAction, applyPresetAction } from '@/lib/modules/actions';
import { MODULE_KEYS, MODULE_META, MODULE_PRESETS } from '@/lib/modules/types';
import { PageHeader } from '@/components/owner/PageHeader';

export const dynamic = 'force-dynamic';

/**
 * /owner/modulos — el owner elige qué módulos usa este workspace.
 * Los módulos apagados desaparecen del sidebar. Nada de contenido se borra:
 * si un tenant apaga "Catálogo" y lo vuelve a prender, sus publicaciones
 * siguen ahí intactas.
 */
export default async function ModulosPage() {
  const { tenant } = await requireOwner();
  const modules = await getTenantModules(tenant.id);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Módulos"
        description="Elegí qué módulos usa este workspace. Los módulos apagados desaparecen del sidebar; tu contenido queda intacto y podés prenderlos de nuevo cuando quieras."
      />

      {/* Presets rápidos */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
        <h2 className="text-sm font-semibold">Empezar desde un preset</h2>
        <p className="text-xs text-white/55">
          Estos presets te dan una configuración típica según el tipo de negocio. Podés ajustar cada toggle después.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {(Object.keys(MODULE_PRESETS) as Array<keyof typeof MODULE_PRESETS>).map((key) => {
            const p = MODULE_PRESETS[key];
            return (
              <form key={key} action={applyPresetAction}>
                <input type="hidden" name="preset" value={key} />
                <button type="submit"
                  className="w-full text-left rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/25 p-3 transition">
                  <div className="font-medium text-sm">{p.label}</div>
                  <div className="text-[11px] text-white/50 mt-0.5">{p.description}</div>
                </button>
              </form>
            );
          })}
        </div>
      </section>

      {/* Toggles individuales */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] divide-y divide-white/5">
        {MODULE_KEYS.map((k) => {
          const meta = MODULE_META[k];
          const on = modules[k] !== false;
          return (
            <div key={k} className="flex items-start justify-between gap-4 p-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{meta.label}</span>
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                    on ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/50'
                  }`}>
                    {on ? 'Activo' : 'Apagado'}
                  </span>
                </div>
                <p className="text-xs text-white/55 mt-1">{meta.description}</p>
                <p className="text-[10px] text-white/35 mt-1">
                  Sidebar: <span className="font-mono">{meta.sidebarGroup}</span>
                </p>
              </div>
              <form action={toggleModuleAction} className="shrink-0">
                <input type="hidden" name="key" value={k} />
                <input type="hidden" name="enabled" value={on ? 'false' : 'true'} />
                <button type="submit"
                  className={`text-xs font-semibold px-3 py-2 rounded transition ${
                    on
                      ? 'border border-white/15 text-white/75 hover:bg-white/5'
                      : 'bg-white text-black hover:bg-white/90'
                  }`}>
                  {on ? 'Apagar' : 'Prender'}
                </button>
              </form>
            </div>
          );
        })}
      </section>

      <p className="text-[11px] text-white/40">
        Inicio y Configuración siempre están visibles — no se pueden apagar.
      </p>
    </div>
  );
}
