import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/owner/PageHeader';
import { toggleSupplierRoleAction, updateSupplierProfileAction } from '@/lib/dropship/actions';

export const dynamic = 'force-dynamic';

/**
 * Hub del módulo Dropshipping.
 *  · Como RESELLER: acceso al catálogo mayorista + listings + órdenes ruteadas.
 *  · Como SUPPLIER (opcional, self-serve): perfil público + link a
 *    /supplier/products para publicar catálogo mayorista.
 *
 * Ambos roles pueden convivir en el mismo tenant (podés ser reseller Y supplier).
 */
export default async function DropshipPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // Defensivo: si migration 0060 pendiente, mostramos warning y todo lo demás
  // deshabilitado.
  let migrationMissing = false;
  let isSupplier = false;
  let supplierDisplayName: string | null = null;
  let supplierBio: string | null = null;
  let supplierLead: number | null = null;
  let listingsCount = 0;
  let ordersPending = 0;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('tenants') as any)
      .select('is_supplier, supplier_display_name, supplier_bio, supplier_lead_time_days')
      .eq('id', tenant.id).maybeSingle();
    if (error?.message?.includes('does not exist')) {
      migrationMissing = true;
    } else if (data) {
      isSupplier = !!data.is_supplier;
      supplierDisplayName = data.supplier_display_name ?? null;
      supplierBio = data.supplier_bio ?? null;
      supplierLead = data.supplier_lead_time_days ?? null;
    }
  } catch { migrationMissing = true; }

  if (!migrationMissing) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: lc } = await (svc.from('catalog_listings') as any)
        .select('id', { count: 'exact', head: true })
        .eq('reseller_tenant_id', tenant.id);
      listingsCount = lc ?? 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: oc } = await (svc.from('supplier_orders') as any)
        .select('id', { count: 'exact', head: true })
        .eq('reseller_tenant_id', tenant.id)
        .in('status', ['pending', 'confirmed']);
      ordersPending = oc ?? 0;
    } catch { /* ok */ }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Dropshipping"
        description="Marketplace interno: vendé productos de otros suppliers de OfferNow con tu markup, o activate como supplier y dejá que otros los vendan por vos."
      />

      {migrationMissing && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm px-4 py-3">
          La migration <code>0060_dropshipping.sql</code> todavía no corrió. Aplicala para empezar a usar dropshipping.
        </div>
      )}

      {/* ── Como reseller ── */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span>🛒</span> Como reseller
            </h2>
            <p className="text-xs text-white/55 mt-1 max-w-md">
              Explorá el catálogo mayorista, agregá productos a tu tienda con tu markup, y cuando el buyer compre, el supplier se encarga del envío.
            </p>
          </div>
          <Link href="/dropship/browse"
            className="rounded-md bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90 whitespace-nowrap">
            Explorar catálogo mayorista →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-2xl font-bold">{listingsCount}</div>
            <div className="text-xs text-white/55 mt-0.5">Productos en tu tienda</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="text-2xl font-bold">{ordersPending}</div>
            <div className="text-xs text-white/55 mt-0.5">Órdenes por procesar</div>
          </div>
          <Link href="/dropship/orders"
            className="rounded-lg border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.06] flex items-center justify-center text-sm text-white/70 hover:text-white">
            Ver mis órdenes →
          </Link>
        </div>
      </section>

      {/* ── Como supplier (opcional) ── */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span>📦</span> Como supplier
              {isSupplier && (
                <span className="text-[10px] uppercase tracking-wider bg-emerald-500/15 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                  Activo
                </span>
              )}
            </h2>
            <p className="text-xs text-white/55 mt-1 max-w-md">
              Publicá tus productos mayoristas. Otros tenants los agregan a sus tiendas con markup. Al concretarse una venta, te llega la orden con la dirección del buyer para que envíes con la marca del reseller (white-label).
            </p>
          </div>
          <form action={toggleSupplierRoleAction}>
            <input type="hidden" name="activate" value={isSupplier ? 'false' : 'true'} />
            <button type="submit" disabled={migrationMissing}
              className={`rounded-md text-sm font-semibold px-4 py-2 whitespace-nowrap disabled:opacity-50 ${
                isSupplier
                  ? 'border border-white/25 text-white/75 hover:bg-white/5'
                  : 'bg-emerald-500 text-white hover:bg-emerald-400'
              }`}>
              {isSupplier ? 'Desactivar rol supplier' : 'Activar rol supplier'}
            </button>
          </form>
        </div>

        {isSupplier && (
          <>
            <form action={updateSupplierProfileAction}
              className="space-y-3 border-t border-white/10 pt-4">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/60 mb-1">Nombre público del supplier</label>
                  <input name="display_name" defaultValue={supplierDisplayName ?? tenant.name}
                    className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm"
                    placeholder="Ej. Textiles del Sur" />
                  <p className="text-[10px] text-white/40 mt-1">
                    Los resellers ven esto cuando exploran tus productos. No es la marca que ve el buyer final.
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Tiempo típico de envío</label>
                  <div className="flex items-center gap-2">
                    <input name="lead_time_days" type="number" min={1} max={60}
                      defaultValue={supplierLead ?? ''}
                      className="w-24 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
                    <span className="text-sm text-white/60">días</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">Bio corta <span className="text-white/40">(opcional)</span></label>
                <textarea name="bio" defaultValue={supplierBio ?? ''} rows={2} maxLength={500}
                  placeholder="Ej. Mayorista textil de Once. Envíos a todo el país en 5 días."
                  className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
              </div>
              <div className="flex items-center justify-between">
                <button type="submit"
                  className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
                  Guardar perfil
                </button>
                <div className="flex items-center gap-3">
                  <Link href="/supplier/orders"
                    className="text-xs text-emerald-300 hover:underline">
                    Ver mis órdenes a enviar →
                  </Link>
                  <Link href="/supplier/products"
                    className="text-xs text-emerald-300 hover:underline">
                    Mi catálogo mayorista →
                  </Link>
                </div>
              </div>
            </form>
          </>
        )}

        {!isSupplier && !migrationMissing && (
          <p className="text-xs text-white/40 pt-3 border-t border-white/10">
            💡 Buena idea si tenés stock propio y querés que otros tenants lo vendan por vos.
          </p>
        )}
      </section>

      {/* ── Explicación del flujo ── */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <h3 className="text-sm font-semibold mb-3">Cómo funciona</h3>
        <ol className="space-y-2 text-xs text-white/65 list-decimal ml-5">
          <li><strong className="text-white">Como reseller</strong>: explorás el catálogo mayorista, elegís un producto, definís tu markup (%o precio fijo) y aparece en tu tienda con tu marca.</li>
          <li>El buyer compra en tu storefront normalmente — no sabe que es dropship.</li>
          <li>Al confirmarse el pago, el <strong className="text-white">supplier recibe la orden</strong> con la dirección del buyer y envía con packaging neutro (white-label).</li>
          <li>El supplier marca "enviado" con tracking # → el buyer recibe email tuyo con el tracking.</li>
          <li><strong className="text-white">Settle de plata</strong>: vos cobrás 100% del precio de venta. Después le transferís al supplier su parte mayorista (menos la comisión de OfferNow).</li>
        </ol>
        <p className="text-[10px] text-white/40 mt-3 leading-snug">
          MVP: settle es manual entre reseller y supplier. En próxima fase agregamos split automático vía MP Marketplace.
        </p>
      </section>
    </div>
  );
}
