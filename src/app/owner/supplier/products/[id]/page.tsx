import { notFound, redirect } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/owner/PageHeader';
import {
  updateSupplierProductAction,
  setSupplierProductStatusAction,
  deleteSupplierProductAction
} from '@/lib/dropship/actions';

export const dynamic = 'force-dynamic';

type SupplierProduct = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  gallery: string[];
  wholesale_price_cents: number;
  currency: string;
  sku: string | null;
  stock_qty: number;
  track_stock: boolean;
  weight_g: number | null;
  category: string | null;
  origin_province: string | null;
  status: 'draft' | 'published';
  suggested_retail_cents: number | null;
  min_markup_percent: number | null;
};

const AR_PROVINCES = [
  'CABA', 'Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
  'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz',
  'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'
];

export default async function EditSupplierProductPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // Gate por is_supplier
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: t } = await (svc.from('tenants') as any)
    .select('is_supplier').eq('id', tenant.id).maybeSingle();
  if (!t?.is_supplier) redirect('/dropship');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('supplier_products') as any)
    .select('*').eq('id', id).eq('supplier_tenant_id', tenant.id).maybeSingle();
  const product = data as SupplierProduct | null;
  if (!product) notFound();

  const boundUpdate = updateSupplierProductAction.bind(null, product.id);

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={product.title}
        description={product.status === 'published' ? 'Este producto está visible en el marketplace mayorista.' : 'En borrador — todavía no lo ven los resellers.'}
        back={{ label: '← Mi catálogo mayorista', href: '/supplier/products' }}
        actions={
          <div className="flex gap-2">
            <form action={setSupplierProductStatusAction}>
              <input type="hidden" name="id" value={product.id} />
              <input type="hidden" name="status" value={product.status === 'published' ? 'draft' : 'published'} />
              <button type="submit"
                className={`text-sm font-semibold px-4 py-2 rounded ${
                  product.status === 'published'
                    ? 'border border-white/15 text-white/75 hover:bg-white/5'
                    : 'bg-emerald-500 text-white hover:bg-emerald-400'
                }`}>
                {product.status === 'published' ? 'Despublicar' : 'Publicar'}
              </button>
            </form>
          </div>
        }
      />

      <form action={boundUpdate} className="space-y-5">
        {/* Básicos */}
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
          <h2 className="text-sm font-semibold">Datos básicos</h2>
          <div>
            <label className="block text-xs text-white/60 mb-1">Título</label>
            <input name="title" defaultValue={product.title} required maxLength={200}
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Descripción</label>
            <textarea name="description" defaultValue={product.description ?? ''} rows={3} maxLength={2000}
              placeholder="Detalles del producto que ayuden al reseller a decidir si lo agrega."
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-white/60 mb-1">Categoría</label>
              <input name="category" defaultValue={product.category ?? ''} maxLength={80}
                placeholder="Ropa, Electrónica, Hogar…"
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Provincia de origen</label>
              <select name="origin_province" defaultValue={product.origin_province ?? ''}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
                <option value="" className="bg-neutral-900">— sin especificar —</option>
                {AR_PROVINCES.map((p) => (
                  <option key={p} value={p} className="bg-neutral-900">{p}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Precios mayoristas */}
        <section className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.03] p-5 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <span>💰</span> Precios (en centavos)
          </h2>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-white/60 mb-1">Precio mayorista *</label>
              <input name="wholesale_price_cents" type="number" min={0} required
                defaultValue={product.wholesale_price_cents}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
              <p className="text-[10px] text-white/40 mt-1">Lo que vos cobrás por unidad.</p>
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Precio sugerido de venta</label>
              <input name="suggested_retail_cents" type="number" min={0}
                defaultValue={product.suggested_retail_cents ?? ''}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
              <p className="text-[10px] text-white/40 mt-1">Sugerencia al reseller (opcional).</p>
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Markup mínimo (%)</label>
              <input name="min_markup_percent" type="number" min={0} max={500}
                defaultValue={product.min_markup_percent ?? ''}
                placeholder="ej. 20"
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
              <p className="text-[10px] text-white/40 mt-1">Fuerza a los resellers a agregar este mínimo de margen (opcional).</p>
            </div>
          </div>
        </section>

        {/* Stock */}
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
          <h2 className="text-sm font-semibold">Stock y envío</h2>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-white/60 mb-1">Cantidad disponible</label>
              <input name="stock_qty" type="number" min={0}
                defaultValue={product.stock_qty}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">SKU (opcional)</label>
              <input name="sku" defaultValue={product.sku ?? ''} maxLength={60}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-white/60 mb-1">Peso (gramos)</label>
              <input name="weight_g" type="number" min={0}
                defaultValue={product.weight_g ?? ''}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="track_stock" defaultChecked={product.track_stock} />
            Trackear stock (baja automáticamente en cada venta)
          </label>
        </section>

        {/* Imágenes */}
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
          <h2 className="text-sm font-semibold">Imágenes</h2>
          <div>
            <label className="block text-xs text-white/60 mb-1">URL de la portada</label>
            <input name="cover_url" type="url" defaultValue={product.cover_url ?? ''}
              placeholder="https://…"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Galería (una URL por línea, max 12)</label>
            <textarea name="gallery"
              defaultValue={(product.gallery ?? []).join('\n')}
              rows={4}
              placeholder="https://…&#10;https://…"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono" />
          </div>
        </section>

        <div className="flex items-center justify-between pt-2">
          <form action={deleteSupplierProductAction}>
            <input type="hidden" name="id" value={product.id} />
            <button type="submit"
              className="text-xs text-rose-400 hover:text-rose-300 underline underline-offset-2">
              Eliminar producto
            </button>
          </form>
          <button type="submit"
            className="rounded-md bg-white text-black px-6 py-2.5 font-semibold hover:bg-white/90">
            Guardar cambios
          </button>
        </div>
      </form>
    </div>
  );
}
