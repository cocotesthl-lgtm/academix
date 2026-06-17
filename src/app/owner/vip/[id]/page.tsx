import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import {
  updateVipPackMetaAction,
  addMediaItemAction,
  deleteMediaItemAction,
  moveMediaItemAction,
  type VipMediaItem
} from '@/lib/vip/actions';
import { CourseSubscriptionConfig } from '@/components/owner/courses/CourseSubscriptionConfig';

export const dynamic = 'force-dynamic';

type PackRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  pack_description: string | null;
  price_cents: number;
  status: string;
  cover_url: string | null;
  preview_url: string | null;
  media_items: VipMediaItem[] | null;
};

export default async function VipPackEditPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: packRaw } = await (svc.from('courses') as any)
    .select('id, slug, title, description, pack_description, price_cents, currency, status, cover_url, preview_url, media_items, pricing_mode, subscription_frequency, subscription_trial_days')
    .eq('id', id)
    .eq('tenant_id', tenant.id)
    .eq('product_type', 'vip_pack')
    .maybeSingle();
  const pack = packRaw as (PackRow & {
    currency: string;
    pricing_mode: 'one_time' | 'subscription' | null;
    subscription_frequency: 'monthly' | 'yearly' | null;
    subscription_trial_days: number | null;
  }) | null;
  if (!pack) notFound();

  const items: VipMediaItem[] = Array.isArray(pack.media_items) ? pack.media_items : [];
  const publicPath = `/c/${pack.slug}`;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link href="/owner/vip" className="text-xs text-white/50 hover:text-white">← Volver a Contenido VIP</Link>
        <h1 className="text-2xl font-bold mt-1">{pack.title}</h1>
        <p className="text-white/55 text-sm mt-1">
          URL pública: <code className="font-mono text-xs text-white/80">{publicPath}</code>
        </p>
      </div>

      {/* Config */}
      <details className="rounded-xl border border-white/10 bg-white/[0.02] p-5" open>
        <summary className="cursor-pointer font-semibold select-none">⚙️ Configuración del pack</summary>
        <form action={updateVipPackMetaAction} className="space-y-3 mt-4">
          <input type="hidden" name="id" value={pack.id} />
          <div>
            <label className="text-xs text-white/60">Título</label>
            <input name="title" defaultValue={pack.title} required
              className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-white/60">Descripción corta (visible en el catálogo)</label>
            <input name="description" defaultValue={pack.description ?? ''}
              className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-white/60">Descripción larga (visible antes de comprar)</label>
            <textarea name="pack_description" defaultValue={pack.pack_description ?? ''} rows={4}
              placeholder="Detalles del contenido, qué incluye, frecuencia de actualizaciones, etc."
              className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60">Precio (ARS)</label>
              <input name="price" type="number" min={0} step="0.01"
                defaultValue={(pack.price_cents / 100).toString()}
                className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs text-white/60">Estado</label>
              <select name="status" defaultValue={pack.status}
                className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
                <option value="draft">🟡 Borrador (oculto)</option>
                <option value="published">🟢 Publicado (visible)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60">URL de portada (cover)</label>
              <input type="url" name="cover_url" defaultValue={pack.cover_url ?? ''}
                placeholder="https://… imagen de portada"
                className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs text-white/60">URL de preview blureado (opcional)</label>
              <input type="url" name="preview_url" defaultValue={pack.preview_url ?? ''}
                placeholder="https://… preview cuando aún no compró"
                className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono" />
            </div>
          </div>
          <p className="text-[10px] text-white/40">
            💡 Si no pegás preview, el storefront usa la portada con un blur automático para los que aún no compraron.
          </p>
          <button className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
            Guardar configuración
          </button>
        </form>
      </details>

      {/* Subscription mode */}
      <details className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5">
        <summary className="cursor-pointer font-semibold select-none">
          💳 Modo de cobro (pago único vs suscripción recurrente)
        </summary>
        <div className="mt-4">
          <p className="text-xs text-white/55 mb-3">
            Cobrá una vez (pago único, acceso permanente) o configurá una suscripción mensual/anual
            via Mercado Pago. Ideal para packs con contenido nuevo cada mes.
          </p>
          <CourseSubscriptionConfig
            courseId={pack.id}
            initialMode={(pack.pricing_mode ?? 'one_time') as 'one_time' | 'subscription'}
            initialFrequency={pack.subscription_frequency}
            initialTrialDays={pack.subscription_trial_days ?? 0}
            priceCents={pack.price_cents}
            currency={pack.currency}
          />
        </div>
      </details>

      {/* Media items */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">🖼 Contenido del pack ({items.length})</h2>
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-white/40 py-2">Aún no agregaste contenido. Cargá items abajo.</p>
        ) : (
          <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {items.map((item, idx) => (
              <li key={item.id} className="rounded-lg border border-white/10 bg-black/30 overflow-hidden group relative">
                <div className="aspect-square bg-black/50 flex items-center justify-center">
                  {item.type === 'image' && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt={item.title ?? ''} className="w-full h-full object-cover" />
                  )}
                  {item.type === 'video' && (
                    <div className="text-3xl text-white/50">🎬</div>
                  )}
                  {item.type === 'audio' && (
                    <div className="text-3xl text-white/50">🎵</div>
                  )}
                  {item.type === 'embed' && (
                    <div className="text-3xl text-white/50">🔗</div>
                  )}
                </div>
                <div className="p-2">
                  <div className="text-[10px] uppercase text-white/40 tracking-wider">{item.type}</div>
                  {item.title && <div className="text-xs font-medium truncate">{item.title}</div>}
                </div>
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <form action={moveMediaItemAction}>
                    <input type="hidden" name="pack_id" value={pack.id} />
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="dir" value="up" />
                    <button disabled={idx === 0}
                      className="bg-white text-black text-[10px] w-5 h-5 rounded-full disabled:opacity-30">↑</button>
                  </form>
                  <form action={moveMediaItemAction}>
                    <input type="hidden" name="pack_id" value={pack.id} />
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="dir" value="down" />
                    <button disabled={idx === items.length - 1}
                      className="bg-white text-black text-[10px] w-5 h-5 rounded-full disabled:opacity-30">↓</button>
                  </form>
                  <form action={deleteMediaItemAction}>
                    <input type="hidden" name="pack_id" value={pack.id} />
                    <input type="hidden" name="id" value={item.id} />
                    <button className="bg-red-500 text-white text-[10px] w-5 h-5 rounded-full">✕</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <details className="pt-3 border-t border-white/10">
          <summary className="cursor-pointer text-sm font-semibold select-none">+ Agregar contenido</summary>
          <form action={addMediaItemAction} className="grid grid-cols-2 gap-2 mt-3">
            <input type="hidden" name="pack_id" value={pack.id} />
            <select name="type" className="col-span-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
              <option value="image">🖼 Imagen</option>
              <option value="video">🎬 Video</option>
              <option value="audio">🎵 Audio</option>
              <option value="embed">🔗 Embed (YouTube/Drive)</option>
            </select>
            <input name="title" placeholder="Título (opcional)"
              className="col-span-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <input type="url" name="url" required placeholder="URL (https://…)"
              className="col-span-2 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono" />
            <input name="description" placeholder="Descripción (opcional)"
              className="col-span-2 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <label className="col-span-2 flex items-center gap-2 text-xs text-white/75 cursor-pointer">
              <input type="checkbox" name="notify" defaultChecked />
              📧 Notificar a todos los suscriptores actuales que hay contenido nuevo
            </label>
            <button className="col-span-2 rounded bg-white text-black text-sm font-semibold py-2 hover:bg-white/90">
              Agregar al pack
            </button>
            <p className="col-span-2 text-[10px] text-white/40">
              💡 Imágenes: cualquier URL pública (Imgur, Cloudinary, Drive con shared link).
              Video: link de YouTube/Drive. El contenido solo se ve después de que el cliente compre.
            </p>
          </form>
        </details>
      </div>
    </div>
  );
}
