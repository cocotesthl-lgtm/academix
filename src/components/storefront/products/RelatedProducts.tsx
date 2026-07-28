import Link from 'next/link';
import { getServiceClient } from '@/lib/supabase/service';

type RelatedRow = {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  currency: string;
};

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency, maximumFractionDigits: 0
  }).format(cents / 100);
}

/**
 * "Quienes vieron este producto también compraron" — carrusel horizontal
 * estilo MercadoLibre. MVP: mismos productos publicados de la misma categoría,
 * excluyendo el actual. Si no hay categoría o pocos hits, cae a los más
 * recientes del tenant.
 */
export async function RelatedProducts({
  tenantId,
  productId,
  categoryId
}: {
  tenantId: string;
  productId: string;
  categoryId: string | null;
}) {
  const svc = getServiceClient();
  let related: RelatedRow[] = [];

  // 1) Misma categoría
  if (categoryId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('physical_products') as any)
      .select('id, slug, title, cover_url, price_cents, compare_at_price_cents, currency')
      .eq('tenant_id', tenantId)
      .eq('status', 'published')
      .eq('category_id', categoryId)
      .neq('id', productId)
      .order('created_at', { ascending: false })
      .limit(8);
    related = (data ?? []) as RelatedRow[];
  }

  // 2) Fallback: últimos del tenant
  if (related.length < 4) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('physical_products') as any)
      .select('id, slug, title, cover_url, price_cents, compare_at_price_cents, currency')
      .eq('tenant_id', tenantId)
      .eq('status', 'published')
      .neq('id', productId)
      .order('created_at', { ascending: false })
      .limit(8);
    const extras = ((data ?? []) as RelatedRow[]).filter(
      (r) => !related.some((x) => x.id === r.id)
    );
    related = [...related, ...extras].slice(0, 8);
  }

  if (related.length === 0) return null;

  return (
    <section className="mt-12 border-t border-black/10 pt-8">
      <h2 className="text-xl font-bold mb-5">Quienes vieron este producto también compraron</h2>
      <div className="flex gap-4 overflow-x-auto -mx-2 px-2 pb-2 snap-x">
        {related.map((r) => {
          const discount = r.compare_at_price_cents && r.compare_at_price_cents > r.price_cents
            ? Math.round((1 - r.price_cents / r.compare_at_price_cents) * 100)
            : null;
          return (
            <Link
              key={r.id}
              href={`/p/${r.slug}`}
              className="snap-start shrink-0 w-56 rounded-xl border border-black/10 bg-white hover:border-black/30 hover:shadow-md transition group"
            >
              <div className="aspect-square rounded-t-xl bg-zinc-100 overflow-hidden">
                {r.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.cover_url} alt={r.title}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-black/20 text-5xl">📦</div>
                )}
              </div>
              <div className="p-3">
                <div className="text-sm text-black/85 line-clamp-2 min-h-[2.5rem] leading-snug">
                  {r.title}
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <div className="text-lg font-bold text-black">
                    {formatMoney(r.price_cents, r.currency)}
                  </div>
                  {discount !== null && (
                    <div className="text-xs font-bold text-emerald-700">
                      {discount}% OFF
                    </div>
                  )}
                </div>
                {r.compare_at_price_cents && r.compare_at_price_cents > r.price_cents && (
                  <div className="text-xs text-black/40 line-through">
                    {formatMoney(r.compare_at_price_cents, r.currency)}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
