import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/owner/PageHeader';
import { addListingAction } from '@/lib/dropship/actions';

export const dynamic = 'force-dynamic';

type PublicSupplierProduct = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  wholesale_price_cents: number;
  currency: string;
  stock_qty: number;
  category: string | null;
  origin_province: string | null;
  suggested_retail_cents: number | null;
  min_markup_percent: number | null;
  supplier_tenant_id: string;
  supplier_name: string | null;
  supplier_lead: number | null;
};

/**
 * /owner/dropship/browse — catálogo público de todos los supplier_products
 * publicados. Filtros por categoría + búsqueda. Cada card tiene "Añadir a
 * mi tienda" con selector de markup inline.
 *
 * Excluye los productos que el tenant actual ya tiene listeados (evita
 * duplicados) y los que él mismo publicó como supplier.
 */
export default async function DropshipBrowsePage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; cat?: string }>;
}) {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const { q, cat } = await searchParams;

  let products: PublicSupplierProduct[] = [];
  let existingListingIds = new Set<string>();
  let categories: string[] = [];
  let migrationMissing = false;

  try {
    // Los que ya tengo listados
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: listings } = await (svc.from('catalog_listings') as any)
      .select('supplier_product_id')
      .eq('reseller_tenant_id', tenant.id);
    existingListingIds = new Set(((listings ?? []) as Array<{ supplier_product_id: string }>)
      .map((r) => r.supplier_product_id));

    // Query base + supplier join
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (svc.from('supplier_products') as any)
      .select('id, slug, title, description, cover_url, wholesale_price_cents, currency, stock_qty, category, origin_province, suggested_retail_cents, min_markup_percent, supplier_tenant_id, tenants ( supplier_display_name, supplier_lead_time_days )')
      .eq('status', 'published')
      .neq('supplier_tenant_id', tenant.id)  // no mostrarme mi propio catálogo
      .order('updated_at', { ascending: false })
      .limit(60);

    if (q?.trim()) {
      query = query.ilike('title', `%${q.trim()}%`);
    }
    if (cat?.trim()) {
      query = query.eq('category', cat.trim());
    }

    const { data, error } = await query;
    if (error?.message?.includes('does not exist')) {
      migrationMissing = true;
    } else {
      products = ((data ?? []) as Array<{
        id: string; slug: string; title: string; description: string | null;
        cover_url: string | null; wholesale_price_cents: number; currency: string;
        stock_qty: number; category: string | null; origin_province: string | null;
        suggested_retail_cents: number | null; min_markup_percent: number | null;
        supplier_tenant_id: string;
        tenants: { supplier_display_name: string | null; supplier_lead_time_days: number | null } | null;
      }>).map((p) => ({
        id: p.id, slug: p.slug, title: p.title, description: p.description,
        cover_url: p.cover_url, wholesale_price_cents: p.wholesale_price_cents,
        currency: p.currency, stock_qty: p.stock_qty, category: p.category,
        origin_province: p.origin_province,
        suggested_retail_cents: p.suggested_retail_cents,
        min_markup_percent: p.min_markup_percent,
        supplier_tenant_id: p.supplier_tenant_id,
        supplier_name: p.tenants?.supplier_display_name ?? null,
        supplier_lead: p.tenants?.supplier_lead_time_days ?? null
      }));
    }

    // Categorías distintas para el filtro
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: catData } = await (svc.from('supplier_products') as any)
      .select('category').eq('status', 'published').not('category', 'is', null);
    categories = Array.from(new Set(((catData ?? []) as Array<{ category: string }>)
      .map((r) => r.category))).sort();
  } catch {
    migrationMissing = true;
  }

  const notYetListed = products.filter((p) => !existingListingIds.has(p.id));

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Catálogo mayorista"
        description="Productos de otros suppliers de OfferNow. Elegí uno, definí tu markup y aparece en tu tienda con tu marca. El envío lo hace el supplier."
        back={{ label: '← Dropshipping', href: '/dropship' }}
      />

      {migrationMissing && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm px-4 py-3">
          Migration <code>0060_dropshipping.sql</code> pendiente. Aplicala para explorar el marketplace.
        </div>
      )}

      {/* Filtros */}
      <form className="flex gap-2 flex-wrap items-center">
        <input name="q" defaultValue={q ?? ''} placeholder="Buscar productos…"
          className="flex-1 min-w-[200px] rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
        <select name="cat" defaultValue={cat ?? ''}
          className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
          <option value="" className="bg-neutral-900">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c} className="bg-neutral-900">{c}</option>
          ))}
        </select>
        <button type="submit"
          className="text-sm bg-white text-black font-semibold px-4 py-2 rounded hover:bg-white/90">
          Filtrar
        </button>
        {(q || cat) && (
          <Link href="/dropship/browse"
            className="text-xs text-white/50 hover:text-white underline">
            Limpiar
          </Link>
        )}
      </form>

      {!migrationMissing && notYetListed.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center">
          <div className="text-4xl mb-2">🔎</div>
          <div className="font-semibold">
            {existingListingIds.size > 0 && products.length > 0
              ? 'Todos los productos que matchean tu búsqueda ya están en tu tienda'
              : 'No hay productos mayoristas disponibles todavía'}
          </div>
          <p className="text-sm text-white/55 mt-1">
            {products.length === 0
              ? 'El marketplace está vacío. Volvé cuando algún supplier publique catálogo.'
              : `Ya tenés ${existingListingIds.size} listeado(s). Probá con otro filtro.`}
          </p>
        </div>
      )}

      {/* Grid de productos */}
      {notYetListed.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notYetListed.map((p) => {
            const wholesaleFmt = (p.wholesale_price_cents / 100).toLocaleString('es-AR');
            const suggestedFmt = p.suggested_retail_cents
              ? (p.suggested_retail_cents / 100).toLocaleString('es-AR')
              : null;
            // Markup default: usa suggested_retail si existe, sino 40%
            const defaultMarkup = p.suggested_retail_cents && p.suggested_retail_cents > p.wholesale_price_cents
              ? Math.round(((p.suggested_retail_cents / p.wholesale_price_cents) - 1) * 100)
              : Math.max(p.min_markup_percent ?? 0, 40);

            return (
              <div key={p.id}
                className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden flex flex-col">
                {/* Cover */}
                <div className="aspect-square bg-black/30 relative">
                  {p.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.cover_url} alt={p.title}
                      className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20 text-5xl">📦</div>
                  )}
                  {p.min_markup_percent && (
                    <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider font-bold bg-amber-500/90 text-amber-950 px-1.5 py-0.5 rounded">
                      Min markup {p.min_markup_percent}%
                    </span>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm text-white leading-tight line-clamp-2">
                        {p.title}
                      </div>
                      <div className="text-[10px] text-white/45 mt-0.5 flex items-center gap-2 flex-wrap">
                        {p.supplier_name && <span>por {p.supplier_name}</span>}
                        {p.origin_province && <span>· 📍 {p.origin_province}</span>}
                        {p.supplier_lead && <span>· ⏱ {p.supplier_lead}d</span>}
                      </div>
                    </div>
                  </div>

                  {p.category && (
                    <div className="text-[10px] text-white/40 mb-2">Cat: {p.category}</div>
                  )}

                  {p.description && (
                    <p className="text-xs text-white/55 leading-snug line-clamp-2 mb-3">
                      {p.description}
                    </p>
                  )}

                  {/* Precios */}
                  <div className="mt-auto space-y-1 pt-2 border-t border-white/5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] uppercase tracking-wider text-white/45">Mayorista</span>
                      <span className="text-lg font-bold tabular-nums">${wholesaleFmt}</span>
                    </div>
                    {suggestedFmt && (
                      <div className="flex items-baseline justify-between">
                        <span className="text-[10px] uppercase tracking-wider text-emerald-400/70">Sugerido</span>
                        <span className="text-sm text-emerald-400 font-semibold tabular-nums">${suggestedFmt}</span>
                      </div>
                    )}
                    <div className="text-[10px] text-white/40 text-right">Stock: {p.stock_qty}</div>
                  </div>

                  {/* Add form */}
                  <form action={addListingAction} className="mt-3 pt-3 border-t border-white/5 space-y-2">
                    <input type="hidden" name="supplier_product_id" value={p.id} />
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-white/60 shrink-0">Markup:</span>
                      <input type="number" name="markup_value" min={p.min_markup_percent ?? 0} max={500}
                        defaultValue={defaultMarkup}
                        className="w-16 rounded bg-white/5 border border-white/15 px-2 py-1 text-xs text-center" />
                      <select name="markup_type" defaultValue="percent"
                        className="rounded bg-white/5 border border-white/15 px-2 py-1 text-xs">
                        <option value="percent" className="bg-neutral-900">%</option>
                        <option value="fixed" className="bg-neutral-900">$ fijo (¢)</option>
                      </select>
                    </div>
                    <button type="submit"
                      className="w-full rounded bg-emerald-500 text-white text-sm font-semibold py-2 hover:bg-emerald-400 transition">
                      + Añadir a mi tienda
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
