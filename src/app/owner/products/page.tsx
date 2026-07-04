import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { createProductAction } from '@/lib/products/actions';
import { PageHeader } from '@/components/owner/PageHeader';
import { relativeTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  price_cents: number;
  currency: string;
  stock_qty: number;
  track_stock: boolean;
  cover_url: string | null;
  updated_at: string;
};

type VariantAgg = { product_id: string; total_stock: number; variant_count: number };

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency, maximumFractionDigits: 0
  }).format(cents / 100);
}

export default async function ProductsListPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('physical_products') as any)
    .select('id, slug, title, status, price_cents, currency, stock_qty, track_stock, cover_url, updated_at')
    .eq('tenant_id', tenant.id)
    .order('updated_at', { ascending: false });
  const rows = (data ?? []) as Row[];

  // Traer stock agregado de variantes por producto
  const productIds = rows.map((r) => r.id);
  let variantByProduct: Record<string, VariantAgg> = {};
  if (productIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: vdata } = await (svc.from('product_variants') as any)
      .select('product_id, stock_qty').in('product_id', productIds);
    const vrows = (vdata ?? []) as Array<{ product_id: string; stock_qty: number }>;
    variantByProduct = vrows.reduce<Record<string, VariantAgg>>((acc, v) => {
      const existing = acc[v.product_id] ?? { product_id: v.product_id, total_stock: 0, variant_count: 0 };
      existing.total_stock += v.stock_qty;
      existing.variant_count += 1;
      acc[v.product_id] = existing;
      return acc;
    }, {});
  }

  const publishedCount = rows.filter((r) => r.status === 'published').length;

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Productos físicos"
        description="Cargá tu catálogo, controlá stock y variantes. Los envíos se configuran en Envíos."
        actions={
          <div className="flex gap-2">
            <Link
              href="/shipping"
              className="rounded border border-white/15 text-white/85 text-sm px-4 py-2 hover:bg-white/5"
            >
              Envíos
            </Link>
            <form action={createProductAction}>
              <button className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
                + Nuevo producto
              </button>
            </form>
          </div>
        }
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center">
          <div className="text-4xl mb-2">📦</div>
          <div className="text-white/70 font-medium">Todavía no tenés productos</div>
          <p className="text-xs text-white/45 mt-1 mb-4">
            Sumá tu primer producto físico. Podés cargar variantes (talles/colores) y stock por variante.
          </p>
          <form action={createProductAction}>
            <button className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
              + Crear el primero
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="text-xs text-white/50">
            {rows.length} producto{rows.length === 1 ? '' : 's'} · {publishedCount} publicado{publishedCount === 1 ? '' : 's'}
          </div>
          <div className="rounded-xl border border-white/10 divide-y divide-white/5 overflow-hidden">
            {rows.map((r) => {
              const variants = variantByProduct[r.id];
              const stockDisplay = variants
                ? `${variants.total_stock} en ${variants.variant_count} variante${variants.variant_count === 1 ? '' : 's'}`
                : r.track_stock
                  ? `${r.stock_qty} en stock`
                  : 'stock ilimitado';
              const lowStock = r.track_stock && !variants && r.stock_qty <= 3;
              return (
                <Link key={r.id} href={`/products/${r.id}`} className="flex items-center gap-4 p-4 hover:bg-white/[0.03] transition">
                  <div className="w-14 h-14 rounded bg-white/5 shrink-0 overflow-hidden">
                    {r.cover_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.cover_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.title || 'Sin título'}</div>
                    <div className="text-[11px] text-white/45 mt-0.5 truncate">
                      {formatMoney(r.price_cents, r.currency)}
                      {' · '}
                      <span className={lowStock ? 'text-amber-300' : ''}>{stockDisplay}</span>
                      {' · '}
                      última edición {relativeTime(r.updated_at)}
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${
                    r.status === 'published'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-amber-500/15 text-amber-300'
                  }`}>
                    {r.status === 'published' ? 'publicado' : 'borrador'}
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
