import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';
import { storefrontOrigin } from '@/lib/seo/meta';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params
}: {
  params: Promise<{ tenantId: string }>;
}): Promise<Metadata> {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) return {};
  const origin = storefrontOrigin(tenant.slug);
  const description = `Tienda oficial de ${tenant.name}.`;
  return {
    title: 'Tienda',
    description,
    openGraph: {
      type: 'website',
      title: `Tienda · ${tenant.name}`,
      description,
      url: `${origin}/tienda`,
      siteName: tenant.name
    },
    alternates: { canonical: `${origin}/tienda` }
  };
}

type ProductCard = {
  id: string;
  slug: string;
  title: string;
  price_cents: number;
  compare_at_price_cents: number | null;
  currency: string;
  cover_url: string | null;
  stock_qty: number;
  track_stock: boolean;
};

export default async function StorePage({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('physical_products') as any)
    .select('id, slug, title, price_cents, compare_at_price_cents, currency, cover_url, stock_qty, track_stock')
    .eq('tenant_id', tenantId).eq('status', 'published')
    .order('updated_at', { ascending: false });
  const products = (data ?? []) as ProductCard[];

  return (
    <article className="max-w-6xl mx-auto px-6 py-12">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-2">Tienda</h1>
        <p className="text-black/55">Todos los productos disponibles.</p>
      </header>

      {products.length === 0 ? (
        <div className="text-center py-16 text-black/45">
          <div className="text-4xl mb-3">📦</div>
          <div className="text-lg">Todavía no hay productos publicados.</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {products.map((p) => {
            const discount = p.compare_at_price_cents && p.compare_at_price_cents > p.price_cents
              ? Math.round((1 - p.price_cents / p.compare_at_price_cents) * 100)
              : null;
            const outOfStock = p.track_stock && p.stock_qty <= 0;
            const price = new Intl.NumberFormat('es-AR', {
              style: 'currency', currency: p.currency, maximumFractionDigits: 0
            }).format(p.price_cents / 100);
            const compareAt = p.compare_at_price_cents
              ? new Intl.NumberFormat('es-AR', {
                  style: 'currency', currency: p.currency, maximumFractionDigits: 0
                }).format(p.compare_at_price_cents / 100)
              : null;
            return (
              <Link key={p.id} href={`/p/${p.slug}`}
                className="group block rounded-xl border border-black/10 overflow-hidden bg-white hover:shadow-lg transition">
                <div className="aspect-square bg-zinc-100 overflow-hidden relative">
                  {p.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.cover_url} alt={p.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-black/25 text-4xl">📦</div>
                  )}
                  {discount !== null && (
                    <div className="absolute top-2 left-2 bg-emerald-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                      -{discount}%
                    </div>
                  )}
                  {outOfStock && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-black/70">Sin stock</span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-sm mb-1 line-clamp-2 leading-tight">{p.title}</h3>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="font-bold text-base">{price}</span>
                    {compareAt && (
                      <span className="text-xs text-black/40 line-through">{compareAt}</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </article>
  );
}
