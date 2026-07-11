import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/owner/PageHeader';
import { createSupplierProductAction, setSupplierProductStatusAction } from '@/lib/dropship/actions';

export const dynamic = 'force-dynamic';

type SupplierProductRow = {
  id: string;
  slug: string;
  title: string;
  cover_url: string | null;
  wholesale_price_cents: number;
  currency: string;
  stock_qty: number;
  status: 'draft' | 'published';
  category: string | null;
  updated_at: string;
};

export default async function SupplierProductsListPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // Gate: solo tenants con is_supplier=true.
  let isSupplier = false;
  let migrationMissing = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('tenants') as any)
      .select('is_supplier').eq('id', tenant.id).maybeSingle();
    if (error?.message?.includes('does not exist')) migrationMissing = true;
    else isSupplier = !!data?.is_supplier;
  } catch { migrationMissing = true; }

  if (!migrationMissing && !isSupplier) {
    // No activó el rol supplier → mandar al hub para que lo prenda.
    redirect('/dropship');
  }

  let products: SupplierProductRow[] = [];
  if (!migrationMissing) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (svc.from('supplier_products') as any)
        .select('id, slug, title, cover_url, wholesale_price_cents, currency, stock_qty, status, category, updated_at')
        .eq('supplier_tenant_id', tenant.id)
        .order('updated_at', { ascending: false });
      products = (data ?? []) as SupplierProductRow[];
    } catch { /* migration */ }
  }

  const published = products.filter((p) => p.status === 'published').length;

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Mi catálogo mayorista"
        description="Productos que otros tenants pueden agregar a sus tiendas con markup. Publicá los que quieras exponer al marketplace."
        back={{ label: '← Dropshipping', href: '/dropship' }}
        actions={
          <form action={createSupplierProductAction} className="inline">
            <input type="hidden" name="title" value="Nuevo producto mayorista" />
            <button type="submit"
              className="rounded-md bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
              + Nuevo producto
            </button>
          </form>
        }
      />

      {migrationMissing && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm px-4 py-3">
          Migration <code>0060_dropshipping.sql</code> pendiente. Aplicala para usar el catálogo mayorista.
        </div>
      )}

      {/* Contadores */}
      {!migrationMissing && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <div className="text-2xl font-bold">{products.length}</div>
            <div className="text-xs text-white/55">Total en catálogo</div>
          </div>
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.03] p-4">
            <div className="text-2xl font-bold text-emerald-300">{published}</div>
            <div className="text-xs text-white/55">Publicados (visibles a resellers)</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <div className="text-2xl font-bold text-white/60">{products.length - published}</div>
            <div className="text-xs text-white/55">En borrador</div>
          </div>
        </div>
      )}

      {!migrationMissing && products.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center">
          <div className="text-4xl mb-2">📦</div>
          <div className="font-semibold">Todavía no tenés productos mayoristas</div>
          <p className="text-sm text-white/55 mt-1">
            Creá el primero — vas a poder setear precio, stock y provincia de origen. Los resellers los verán en el catálogo público cuando los publiques.
          </p>
        </div>
      )}

      {products.length > 0 && (
        <div className="rounded-xl border border-white/10 divide-y divide-white/5 bg-white/[0.02] overflow-hidden">
          {products.map((p) => (
            <div key={p.id} className="flex items-start gap-4 p-4">
              <div className="w-16 h-16 rounded-lg bg-black/40 border border-white/10 overflow-hidden shrink-0">
                {p.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.cover_url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/supplier/products/${p.id}`}
                    className="font-semibold text-white hover:underline">
                    {p.title}
                  </Link>
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                    p.status === 'published'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-white/10 text-white/50'
                  }`}>
                    {p.status === 'published' ? 'Publicado' : 'Borrador'}
                  </span>
                  {p.category && (
                    <span className="text-[10px] text-white/45 border border-white/10 rounded px-1.5 py-0.5">
                      {p.category}
                    </span>
                  )}
                </div>
                <div className="text-sm text-white/65 mt-1 flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-white">
                    $ {(p.wholesale_price_cents / 100).toLocaleString('es-AR')} {p.currency}
                  </span>
                  <span className="text-white/40">·</span>
                  <span>Stock: {p.stock_qty}</span>
                </div>
              </div>
              <form action={setSupplierProductStatusAction}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="status" value={p.status === 'published' ? 'draft' : 'published'} />
                <button type="submit"
                  className={`text-xs font-semibold px-3 py-1.5 rounded transition ${
                    p.status === 'published'
                      ? 'border border-white/15 text-white/75 hover:bg-white/5'
                      : 'bg-emerald-500 text-white hover:bg-emerald-400'
                  }`}>
                  {p.status === 'published' ? 'Despublicar' : 'Publicar'}
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
