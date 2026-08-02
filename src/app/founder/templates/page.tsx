import { loadSiteTemplateRows } from '@/lib/site/templates/loader';
import {
  updateSiteTemplateAction, toggleSiteTemplateActiveAction,
  createSiteTemplateAction, deleteSiteTemplateAction,
  resetSystemTemplatesAction, enterTemplateEditModeAction
} from '@/lib/site/templates/founder-actions';

export const dynamic = 'force-dynamic';

export default async function FounderTemplatesPage() {
  const rows = await loadSiteTemplateRows();

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Templates de sitio</h1>
          <p className="text-white/60 text-sm mt-1 max-w-xl">
            Cada template es lo que ve el owner al hacer onboarding o al ir a
            <code className="mx-1 px-1 rounded bg-black/40">/owner/templates</code>.
            Podés desactivarlos, editar la metadata (nombre, categoría, emoji, descripción, color, orden)
            o crear nuevos. El diseño visual (secciones, colores, imágenes) por ahora se edita
            desde el código — próximamente vas a poder editarlo con el mismo builder que usan los tenants.
          </p>
        </div>
        <form action={createSiteTemplateAction} className="flex gap-2 items-end">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/50 mb-1">Nombre</label>
            <input name="name" required placeholder="Restaurant premium"
              className="rounded bg-white/5 border border-white/15 px-3 py-1.5 text-sm w-52 focus:outline-none focus:border-white/40" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-white/50 mb-1">Categoría</label>
            <input name="category" required placeholder="Gastronomía"
              className="rounded bg-white/5 border border-white/15 px-3 py-1.5 text-sm w-40 focus:outline-none focus:border-white/40" />
          </div>
          <button type="submit"
            className="text-sm rounded bg-white text-black px-4 py-1.5 font-semibold hover:bg-white/90">
            + Crear
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] p-4 text-xs text-amber-100 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <strong>¿Se rompió algo?</strong> El botón de abajo re-sincroniza los templates <em>del sistema</em>{' '}
            desde el catálogo hardcoded (los <em>custom</em> tuyos no se tocan).
          </div>
          <form action={resetSystemTemplatesAction}>
            <button className="rounded border border-amber-500/50 bg-amber-500/10 px-3 py-1 hover:bg-amber-500/20">
              🔄 Resetear templates del sistema
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-3">
        {rows.map((t) => (
          <form key={t.id} action={updateSiteTemplateAction}
            className={`rounded-xl border p-4 flex items-start gap-4 flex-wrap ${
              t.is_active ? 'border-white/15 bg-white/[0.02]' : 'border-white/10 bg-white/[0.01] opacity-70'
            }`}>
            <input type="hidden" name="id" value={t.id} />

            {/* Preview: emoji grande + color primario */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="w-20 h-20 rounded-lg flex items-center justify-center text-4xl border border-white/10"
                style={{ background: t.suggested_primary ? `${t.suggested_primary}22` : '#333' }}>
                {t.emoji || '📄'}
              </div>
              {t.is_system && (
                <span className="text-[9px] px-1.5 py-0.5 rounded border border-blue-500/40 bg-blue-500/10 text-blue-300 font-semibold">SISTEMA</span>
              )}
              {!t.is_system && (
                <span className="text-[9px] px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-semibold">CUSTOM</span>
              )}
            </div>

            {/* Metadata editable inline */}
            <div className="flex-1 min-w-[260px] grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <label className="block text-[10px] uppercase tracking-wider text-white/50">Nombre</label>
                <input name="name" defaultValue={t.name}
                  className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-white/50">Categoría</label>
                <input name="category" defaultValue={t.category}
                  className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-white/50">Emoji</label>
                <input name="emoji" defaultValue={t.emoji ?? ''} maxLength={4}
                  className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] uppercase tracking-wider text-white/50">Descripción corta</label>
                <input name="short_desc" defaultValue={t.short_desc ?? ''} maxLength={200}
                  className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-white/50">Color primario</label>
                <div className="flex items-center gap-2">
                  <input type="color" name="suggested_primary" defaultValue={t.suggested_primary ?? '#f97316'}
                    className="w-8 h-8 rounded border border-white/15 bg-transparent cursor-pointer" />
                  <input type="text" defaultValue={t.suggested_primary ?? ''}
                    readOnly
                    className="flex-1 text-xs font-mono rounded bg-white/5 border border-white/15 px-2 py-1 text-white/60" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-white/50">Orden</label>
                <input type="number" name="sort_order" defaultValue={t.sort_order}
                  className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] uppercase tracking-wider text-white/50">Descripción larga (opcional)</label>
                <textarea name="long_desc" defaultValue={t.long_desc ?? ''} rows={2} maxLength={1000}
                  className="w-full rounded bg-white/5 border border-white/15 px-2 py-1.5 text-xs" />
              </div>
              <div className="col-span-2 text-[10px] text-white/40 font-mono">
                slug: {t.slug} · id: {t.id.slice(0, 8)}… · updated: {new Date(t.updated_at).toLocaleString('es-AR')}
                {t.modules.length > 0 && (
                  <> · módulos: <span className="text-white/60">{t.modules.join(', ')}</span></>
                )}
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-col gap-1.5 shrink-0 min-w-[150px]">
              <button type="submit"
                className="text-xs rounded bg-white text-black px-3 py-1.5 font-semibold hover:bg-white/90">
                💾 Guardar cambios
              </button>
              <button type="submit" formAction={toggleSiteTemplateActiveAction}
                className={`text-xs rounded px-3 py-1.5 border ${
                  t.is_active
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                    : 'border-white/15 text-white/60 hover:bg-white/5'
                }`}>
                {t.is_active ? '✓ Activo' : '⏸ Inactivo'}
              </button>
              <button type="submit" formAction={enterTemplateEditModeAction}
                title="Editar diseño con el mismo builder que usan los tenants (impersona preview tenant + carga config del template)"
                className="text-xs rounded px-3 py-1.5 border border-orange-500/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 font-semibold">
                🎨 Editar diseño (builder)
              </button>
              <button type="submit" formAction={deleteSiteTemplateAction}
                className="text-xs rounded px-3 py-1.5 border border-rose-500/30 text-rose-300 hover:bg-rose-500/10">
                🗑 Eliminar
              </button>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}
