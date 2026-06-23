import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

type Bundle = {
  id: string; slug: string; title: string; description: string | null;
  status: string; price_cents: number; list_price_cents: number | null;
  cover_url: string | null;
};

type Item = {
  course_id: string; position: number;
  courses: { id: string; title: string; product_type: string | null; price_cents: number; slug: string } | null;
};

export default async function BundlePublicPage({ params }: {
  params: Promise<{ tenantId: string; slug: string }>;
}) {
  const { tenantId, slug } = await params;
  const tenant = await getTenantById(tenantId);
  const primary = tenant?.brand?.primary_color ?? '#0a0a0a';
  const svc = getServiceClient();

  let bundle: Bundle | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('bundles') as any)
      .select('id, slug, title, description, status, price_cents, list_price_cents, cover_url')
      .eq('tenant_id', tenantId).eq('slug', slug).maybeSingle();
    bundle = data as Bundle | null;
  } catch { /* tabla puede no existir */ }
  if (!bundle || bundle.status !== 'published') notFound();

  // Items del bundle
  let items: Item[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('bundle_items') as any)
      .select('course_id, position, courses ( id, title, product_type, price_cents, slug )')
      .eq('bundle_id', bundle.id).order('position');
    items = (data ?? []) as unknown as Item[];
  } catch { /* ignore */ }

  const listPrice = items.reduce((s, i) => s + (i.courses?.price_cents ?? 0), 0);
  const discount = listPrice > bundle.price_cents
    ? Math.round((1 - bundle.price_cents / listPrice) * 100) : 0;

  // Para el checkout, MercadoPago se usa por publicación/producto. Como un bundle
  // es multi-item, redirigimos al carrito si está activo, sino al primer item.
  const h = await headers();
  const host = h.get('host') ?? '';

  return (
    <article className="max-w-4xl mx-auto px-6 py-10">
      <Link href="/" className="text-xs text-black/50 hover:text-black">← Volver</Link>

      <div className="grid md:grid-cols-3 gap-8 mt-4">
        <div className="md:col-span-2 space-y-4">
          {bundle.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bundle.cover_url} alt="" className="w-full rounded-xl border border-black/10" />
          )}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-wider bg-fuchsia-500/10 text-fuchsia-700 px-2 py-1 rounded">
              🎁 Pack / Bundle
            </span>
            {discount > 0 && (
              <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-500 text-white px-2 py-1 rounded">
                -{discount}%
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold">{bundle.title}</h1>
          {bundle.description && (
            <p className="text-black/70 leading-relaxed">{bundle.description}</p>
          )}

          {items.length > 0 && (
            <section className="pt-4">
              <h2 className="text-xl font-bold mb-3">Qué incluye</h2>
              <ul className="space-y-2">
                {items.map((it) => (
                  <li key={it.course_id} className="rounded-lg border border-black/10 p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{it.courses?.title ?? '—'}</div>
                      <div className="text-[10px] text-black/50">
                        {it.courses?.product_type === 'vip_pack' ? '🔒 VIP Pack' : '📦 Producto'} ·
                        $ {((it.courses?.price_cents ?? 0) / 100).toLocaleString('es-AR')}
                      </div>
                    </div>
                    {it.courses?.slug && (
                      <Link href={`/c/${it.courses.slug}`}
                        className="text-xs px-2 py-1 rounded border border-black/15 hover:bg-black/5">
                        Ver →
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="md:col-span-1">
          <div className="sticky top-24 rounded-xl border border-black/10 p-6 space-y-4">
            <div>
              <div className="text-3xl font-bold">
                $ {(bundle.price_cents / 100).toLocaleString('es-AR')}
              </div>
              {listPrice > bundle.price_cents && (
                <div className="text-sm text-black/50">
                  Valor suelto: <span className="line-through">$ {(listPrice / 100).toLocaleString('es-AR')}</span>
                </div>
              )}
              <p className="text-xs text-black/55 mt-1">Pack con descuento · Acceso permanente</p>
            </div>
            <p className="text-xs text-black/55">
              Los bundles se compran ítem por ítem desde sus páginas individuales.
              Pronto vamos a agregar &quot;Comprar pack completo&quot; en 1 click.
            </p>
            {items.length > 0 && items[0].courses?.slug && (
              <Link href={`/c/${items[0].courses.slug}`}
                className="block w-full text-center rounded-md py-3 font-semibold text-white"
                style={{ background: primary }}>
                Empezar por el primero →
              </Link>
            )}
            <p className="text-[10px] text-center text-black/35">
              {host}
            </p>
          </div>
        </aside>
      </div>
    </article>
  );
}
