import { requireSuperAdmin } from "@/lib/auth/guards";
import { getAllPlans, getAllAnnouncements } from "@/lib/plans/queries";
import { upsertAnnouncementAction, deleteAnnouncementAction } from "@/lib/plans/promo-actions";

export const dynamic = "force-dynamic";

/**
 * Founder: editor de banner promocional que aparece a los owners al
 * loguearse (top de su dashboard o de la página /mi-plan).
 *
 * Pueden haber varios pero el owner ve solo el más reciente activo.
 */
export default async function FounderBannerPage() {
  await requireSuperAdmin();
  const [plans, banners] = await Promise.all([getAllPlans(), getAllAnnouncements()]);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Banner promocional</h1>
          <p className="text-white/55 text-sm mt-1">
            Mensaje que aparece arriba del panel del owner cuando se loguea.
            Útil para anunciar promos, lanzamientos, mantenimientos.
          </p>
        </div>
        <a href="/plans" className="text-xs text-white/55 hover:text-white underline">← Planes</a>
      </div>

      {/* Nuevo banner */}
      <form action={upsertAnnouncementAction} className="rounded-xl border border-white/15 bg-white/[0.02] p-5 space-y-4">
        <h2 className="font-semibold text-sm">+ Crear nuevo banner</h2>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Título">
            <input name="title" required maxLength={120}
              placeholder="🔥 Black Friday — 50% OFF"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </Field>
          <Field label="Código promo asociado (opcional)">
            <input name="promo_code" maxLength={30}
              placeholder="BLACKFRIDAY50"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono uppercase" />
          </Field>
        </div>

        <Field label="Mensaje">
          <textarea name="message" required rows={2} maxLength={500}
            placeholder="Hasta el 30/11 todos los planes anuales con 50% off el primer año."
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm resize-none" />
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Texto del botón CTA (opcional)">
            <input name="cta_label" maxLength={40}
              placeholder="Aplicar descuento"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </Field>
          <Field label="URL del botón CTA (opcional)">
            <input name="cta_href" type="url" maxLength={200}
              placeholder="/mi-plan"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono" />
          </Field>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Color de fondo">
            <input name="bg_color" type="color" defaultValue="#f97316"
              className="w-full h-10 rounded bg-white/5 border border-white/15 cursor-pointer" />
          </Field>
          <Field label="Color del texto">
            <input name="text_color" type="color" defaultValue="#ffffff"
              className="w-full h-10 rounded bg-white/5 border border-white/15 cursor-pointer" />
          </Field>
          <Field label="Vence el (opcional)">
            <input name="expires_at" type="datetime-local"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </Field>
        </div>

        <Field label="Mostrar solo a owners de estos planes (vacío = todos)">
          <div className="flex flex-wrap gap-3 mt-1">
            {plans.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer rounded border border-white/10 bg-white/[0.02] px-3 py-1.5">
                <input type="checkbox" name="plan_ids" value={p.id} />
                {p.name}
              </label>
            ))}
          </div>
        </Field>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" name="is_active" defaultChecked />
          Activo (visible para owners)
        </label>

        <div className="flex justify-end">
          <button className="rounded-md bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-white/90">
            + Crear banner
          </button>
        </div>
      </form>

      {/* Lista */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-3">
          Banners existentes ({banners.length})
        </h2>
        {banners.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-white/45">
            Todavía no creaste banners.
          </div>
        ) : (
          <div className="space-y-3">
            {banners.map((b) => {
              const expired = b.expires_at && new Date(b.expires_at).getTime() < Date.now();
              return (
                <div key={b.id} className="rounded-xl border border-white/10 overflow-hidden">
                  {/* Preview */}
                  <div className="px-4 py-3 flex items-center gap-3 flex-wrap"
                    style={{ background: b.bg_color, color: b.text_color }}>
                    <div className="flex-1 min-w-0">
                      <strong className="text-sm block">{b.title}</strong>
                      <span className="text-xs opacity-80">{b.message}</span>
                    </div>
                    {b.cta_label && (
                      <span className="text-xs px-3 py-1 rounded bg-black/20 font-semibold">
                        {b.cta_label}
                      </span>
                    )}
                  </div>
                  {/* Meta */}
                  <div className="px-4 py-2 bg-white/[0.02] flex items-center gap-3 flex-wrap text-xs">
                    <span className={`px-2 py-0.5 rounded border ${b.is_active && !expired
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-white/15 text-white/55'}`}>
                      {!b.is_active ? 'Pausado' : expired ? 'Expirado' : 'Activo'}
                    </span>
                    {b.promo_code && <span className="font-mono text-white/55">→ {b.promo_code}</span>}
                    {b.expires_at && <span className="text-white/45">Vence: {new Date(b.expires_at).toLocaleString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>}
                    {b.plan_ids.length > 0 && <span className="text-amber-400">{b.plan_ids.length} plan{b.plan_ids.length > 1 ? 'es' : ''}</span>}
                    <form action={deleteAnnouncementAction} className="ml-auto">
                      <input type="hidden" name="id" value={b.id} />
                      <button className="text-[10px] px-2 py-0.5 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10">
                        Borrar
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
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
