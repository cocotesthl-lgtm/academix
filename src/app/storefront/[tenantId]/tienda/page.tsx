import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';
import { storefrontOrigin } from '@/lib/seo/meta';
import { StoreFiltersBar } from '@/components/storefront/products/StoreFiltersBar';
import { CategoryMegamenu } from '@/components/storefront/products/CategoryMegamenu';
import { loadTenantCategories, collectCategoryAndDescendants } from '@/lib/categories/queries';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;

type SearchParams = {
  q?: string;
  cat?: string;      // category slug (readable)
  min?: string;
  max?: string;
  sort?: 'recent' | 'price_asc' | 'price_desc' | 'name';
  in_stock?: '1';
  page?: string;
};

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
  category_id: string | null;
};

type Category = { id: string; slug: string; name: string };

export default async function StorePage({
  params, searchParams
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { tenantId } = await params;
  const sp = await searchParams;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  const svc = getServiceClient();

  // Categorías con jerarquía (incluye parent_id + is_featured para el mega-menú)
  const allWithHierarchy = await loadTenantCategories(tenantId);
  const allCategories = allWithHierarchy.map((c) => ({ id: c.id, slug: c.slug, name: c.name })) as Category[];

  // Query base
  const q = (sp.q ?? '').trim().slice(0, 100);
  const sortKey = sp.sort ?? 'recent';
  const inStockOnly = sp.in_stock === '1';
  const minPrice = sp.min ? Math.max(0, parseInt(sp.min, 10)) : null;
  const maxPrice = sp.max ? Math.max(0, parseInt(sp.max, 10)) : null;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const selectedCatSlug = sp.cat ?? '';
  const selectedCat = allCategories.find((c) => c.slug === selectedCatSlug) ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (svc.from('physical_products') as any)
    .select('id, slug, title, price_cents, compare_at_price_cents, currency, cover_url, stock_qty, track_stock, category_id', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('status', 'published');

  if (q) {
    // ilike es case-insensitive. Sanitizamos % y _ para evitar matches indeseados.
    const safe = q.replace(/[%_]/g, '\\$&');
    query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
  }
  if (selectedCat) {
    // Si es un root con hijos, incluir productos de toda la descendencia.
    const includedIds = collectCategoryAndDescendants(allWithHierarchy, selectedCatSlug);
    if (includedIds.size > 1) {
      query = query.in('category_id', Array.from(includedIds));
    } else {
      query = query.eq('category_id', selectedCat.id);
    }
  }
  if (minPrice !== null) query = query.gte('price_cents', minPrice * 100);
  if (maxPrice !== null && maxPrice > 0) query = query.lte('price_cents', maxPrice * 100);
  if (inStockOnly) query = query.gt('stock_qty', 0);

  // Sort
  switch (sortKey) {
    case 'price_asc':  query = query.order('price_cents', { ascending: true }); break;
    case 'price_desc': query = query.order('price_cents', { ascending: false }); break;
    case 'name':       query = query.order('title', { ascending: true }); break;
    default:           query = query.order('updated_at', { ascending: false });
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  query = query.range(from, to);

  const { data, count } = await query;
  const products = (data ?? []) as ProductCard[];
  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Traer solo categorías que tengan ≥1 producto publicado (para el filtro).
  // Query pequeña — solo IDs distintos usados por productos físicos activos.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: usedCats } = await (svc.from('physical_products') as any)
    .select('category_id').eq('tenant_id', tenantId).eq('status', 'published')
    .not('category_id', 'is', null);
  const usedIds = new Set(((usedCats ?? []) as Array<{ category_id: string }>).map((r) => r.category_id));
  const visibleCategories = allCategories.filter((c) => usedIds.has(c.id));

  const anyFilterActive = !!(q || selectedCatSlug || minPrice !== null || maxPrice !== null || inStockOnly);

  return (
    <article className="max-w-7xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-4 border-b border-black/5 pb-3">
        <CategoryMegamenu categories={allWithHierarchy} />
        {selectedCat && (
          <div className="text-xs text-black/55">
            Estás en <strong className="text-black/80">{selectedCat.name}</strong>
          </div>
        )}
      </div>
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">{selectedCat?.name || 'Tienda'}</h1>
        <p className="text-black/55">
          {anyFilterActive
            ? `${totalCount} resultado${totalCount === 1 ? '' : 's'}`
            : 'Todos los productos disponibles.'}
        </p>
      </header>

      <StoreFiltersBar
        categories={visibleCategories}
        initialQ={q}
        initialCat={selectedCatSlug}
        initialMin={sp.min ?? ''}
        initialMax={sp.max ?? ''}
        initialSort={sortKey}
        initialInStock={inStockOnly}
      />

      {products.length === 0 ? (
        <div className="text-center py-16 text-black/45">
          <div className="text-4xl mb-3">🔍</div>
          <div className="text-lg">
            {anyFilterActive
              ? 'No hay productos que coincidan con tu búsqueda.'
              : 'Todavía no hay productos publicados.'}
          </div>
          {anyFilterActive && (
            <Link href="/tienda" className="inline-block mt-4 text-sm text-blue-600 hover:underline">
              Limpiar filtros
            </Link>
          )}
        </div>
      ) : (
        <>
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

          {totalPages > 1 && (
            <StorePagination currentPage={page} totalPages={totalPages} searchParams={sp} />
          )}
        </>
      )}
    </article>
  );
}

function StorePagination({
  currentPage, totalPages, searchParams
}: {
  currentPage: number;
  totalPages: number;
  searchParams: SearchParams;
}) {
  function pageUrl(p: number): string {
    const usp = new URLSearchParams();
    if (searchParams.q) usp.set('q', searchParams.q);
    if (searchParams.cat) usp.set('cat', searchParams.cat);
    if (searchParams.min) usp.set('min', searchParams.min);
    if (searchParams.max) usp.set('max', searchParams.max);
    if (searchParams.sort) usp.set('sort', searchParams.sort);
    if (searchParams.in_stock === '1') usp.set('in_stock', '1');
    if (p > 1) usp.set('page', String(p));
    const qs = usp.toString();
    return qs ? `/tienda?${qs}` : '/tienda';
  }

  const prev = currentPage > 1 ? currentPage - 1 : null;
  const next = currentPage < totalPages ? currentPage + 1 : null;

  return (
    <nav className="mt-10 flex items-center justify-center gap-2 text-sm">
      {prev ? (
        <Link href={pageUrl(prev)}
          className="px-3 py-1.5 rounded border border-black/15 hover:bg-black/[0.03]">
          ← Anterior
        </Link>
      ) : <span className="px-3 py-1.5 rounded border border-black/5 text-black/25">← Anterior</span>}

      <span className="px-3 py-1.5 text-black/60">
        Página {currentPage} de {totalPages}
      </span>

      {next ? (
        <Link href={pageUrl(next)}
          className="px-3 py-1.5 rounded border border-black/15 hover:bg-black/[0.03]">
          Siguiente →
        </Link>
      ) : <span className="px-3 py-1.5 rounded border border-black/5 text-black/25">Siguiente →</span>}
    </nav>
  );
}
