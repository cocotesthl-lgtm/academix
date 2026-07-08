import { requireOwner } from '@/lib/auth/guards';
import { getTenantModules } from '@/lib/modules/queries';
import { toggleModuleAction, applyPresetAction } from '@/lib/modules/actions';
import { MODULE_KEYS, MODULE_META, MODULE_PRESETS, MODULE_TREE, MODULE_LEVEL, type ModuleKey } from '@/lib/modules/types';
import { PageHeader } from '@/components/owner/PageHeader';

export const dynamic = 'force-dynamic';

/**
 * /owner/modulos — el owner elige qué módulos usa este workspace.
 * Los módulos apagados desaparecen del sidebar y del wizard "Crear oferta".
 * Nada de contenido se borra: si un tenant apaga "Ecommerce" y lo vuelve a
 * prender, sus productos siguen ahí intactos.
 *
 * Layout:
 *  · Presets (arriba) — configuraciones típicas por vertical
 *  · Grupos macro con sus submódulos anidados
 */
export default async function ModulosPage() {
  const { tenant } = await requireOwner();
  const modules = await getTenantModules(tenant.id);
  const macroKeys = MODULE_KEYS.filter((k) => MODULE_LEVEL[k] === 'macro');

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Módulos"
        description="Elegí qué módulos usa este workspace. Los módulos apagados desaparecen del sidebar y del wizard 'Crear oferta'; tu contenido queda intacto y podés prenderlos de nuevo cuando quieras."
      />

      {/* Presets rápidos */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <span>⚡</span> Empezar desde un preset
        </h2>
        <p className="text-xs text-white/55">
          Estos presets te dan una configuración típica según el tipo de negocio. Podés ajustar cada toggle después.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(Object.keys(MODULE_PRESETS) as Array<keyof typeof MODULE_PRESETS>).map((key) => {
            const p = MODULE_PRESETS[key];
            return (
              <form key={key} action={applyPresetAction}>
                <input type="hidden" name="preset" value={key} />
                <button type="submit"
                  className="w-full text-left rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/25 p-3 transition">
                  <div className="font-medium text-sm">{p.label}</div>
                  <div className="text-[11px] text-white/50 mt-0.5 leading-snug">{p.description}</div>
                </button>
              </form>
            );
          })}
        </div>
      </section>

      {/* Toggles agrupados: macro + submódulos anidados */}
      <div className="space-y-4">
        {macroKeys.map((macro) => {
          const macroMeta = MODULE_META[macro];
          const macroOn = modules[macro] !== false;
          const subs = MODULE_TREE[macro] ?? [];
          return (
            <section key={macro} className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
              {/* Header del grupo macro */}
              <div className="flex items-start justify-between gap-4 p-5 border-b border-white/5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-base">{macroMeta.label}</span>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                      macroOn ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/50'
                    }`}>
                      {macroOn ? 'Activo' : 'Apagado'}
                    </span>
                  </div>
                  <p className="text-xs text-white/55 mt-1">{macroMeta.description}</p>
                </div>
                <ModuleToggle current={macroOn} moduleKey={macro} />
              </div>

              {/* Submódulos dentro del macro (solo si el macro está activo) */}
              {macroOn && subs.length > 0 && (
                <div className="divide-y divide-white/5 bg-white/[0.01]">
                  {subs.map((sub) => (
                    <SubModuleRow key={sub} moduleKey={sub} current={modules[sub] !== false} />
                  ))}
                </div>
              )}
              {/* Nota si el macro está apagado y tiene subs */}
              {!macroOn && subs.length > 0 && (
                <div className="p-4 text-[11px] text-white/40 italic">
                  Prendé este módulo para configurar sus features detalladas.
                </div>
              )}
            </section>
          );
        })}
      </div>

      <p className="text-[11px] text-white/40">
        Inicio y Configuración siempre están visibles — no se pueden apagar.
      </p>
    </div>
  );
}

function SubModuleRow({ moduleKey, current }: { moduleKey: ModuleKey; current: boolean }) {
  const meta = MODULE_META[moduleKey];
  return (
    <div className="flex items-start justify-between gap-4 p-4 pl-8">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {meta.emoji && <span>{meta.emoji}</span>}
          <span className="font-medium text-sm">{meta.label}</span>
          <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
            current ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/50'
          }`}>
            {current ? 'On' : 'Off'}
          </span>
        </div>
        <p className="text-[11px] text-white/50 mt-1 leading-snug">{meta.description}</p>
      </div>
      <ModuleToggle current={current} moduleKey={moduleKey} small />
    </div>
  );
}

function ModuleToggle({ current, moduleKey, small = false }: { current: boolean; moduleKey: ModuleKey; small?: boolean }) {
  return (
    <form action={toggleModuleAction} className="shrink-0">
      <input type="hidden" name="key" value={moduleKey} />
      <input type="hidden" name="enabled" value={current ? 'false' : 'true'} />
      <button type="submit"
        className={`font-semibold rounded transition ${small ? 'text-[11px] px-2.5 py-1.5' : 'text-xs px-3 py-2'} ${
          current
            ? 'border border-white/15 text-white/75 hover:bg-white/5'
            : 'bg-white text-black hover:bg-white/90'
        }`}>
        {current ? 'Apagar' : 'Prender'}
      </button>
    </form>
  );
}
