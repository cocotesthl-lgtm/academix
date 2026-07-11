import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/owner/PageHeader';
import {
  markSupplierOrderShippedAction,
  markSupplierOrderDeliveredAction
} from '@/lib/dropship/actions';

export const dynamic = 'force-dynamic';

type SupplierOrderRow = {
  id: string;
  buyer_email: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  shipping_address: Record<string, unknown> | null;
  items: Array<{ supplier_product_id: string; qty: number; wholesale_price_cents: number; title: string }>;
  wholesale_total_cents: number;
  currency: string;
  status: string;
  reseller_notes: string | null;
  supplier_notes: string | null;
  tracking_number: string | null;
  carrier: string | null;
  created_at: string;
  reseller_tenants: { name: string } | null;
};

const STATUS_LABEL: Record<string, { emoji: string; label: string; color: string }> = {
  pending:   { emoji: '⏳', label: 'Pendiente',  color: 'bg-white/10 text-white/60' },
  confirmed: { emoji: '📥', label: 'Nueva',      color: 'bg-blue-500/20 text-blue-300' },
  shipped:   { emoji: '📦', label: 'Enviada',    color: 'bg-emerald-500/20 text-emerald-300' },
  delivered: { emoji: '✅', label: 'Entregada',  color: 'bg-emerald-500/20 text-emerald-300' },
  cancelled: { emoji: '❌', label: 'Cancelada',  color: 'bg-white/10 text-white/40' },
  refunded:  { emoji: '↩',  label: 'Reembolsada', color: 'bg-white/10 text-white/40' }
};

function fmtAddress(a: Record<string, unknown> | null): string {
  if (!a) return '—';
  const parts = [
    a.street, a.number ? `${a.number}` : null, a.apt ? `dpto ${a.apt}` : null,
    a.city, a.province, a.postal_code
  ].filter((x): x is string => !!x && typeof x === 'string');
  return parts.join(', ') || '—';
}

export default async function SupplierOrdersPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // Gate
  let isSupplier = false;
  let migrationMissing = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('tenants') as any)
      .select('is_supplier').eq('id', tenant.id).maybeSingle();
    if (error?.message?.includes('does not exist')) migrationMissing = true;
    else isSupplier = !!data?.is_supplier;
  } catch { migrationMissing = true; }
  if (!migrationMissing && !isSupplier) redirect('/dropship');

  let orders: SupplierOrderRow[] = [];
  if (!migrationMissing) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (svc.from('supplier_orders') as any)
        .select('*, reseller_tenants:tenants!supplier_orders_reseller_tenant_id_fkey(name)')
        .eq('supplier_tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(100);
      orders = (data ?? []) as SupplierOrderRow[];
    } catch { /* ok */ }
  }

  const pending = orders.filter((o) => o.status === 'confirmed' || o.status === 'pending');
  const shipped = orders.filter((o) => o.status === 'shipped');
  const closed = orders.filter((o) => o.status === 'delivered' || o.status === 'cancelled' || o.status === 'refunded');

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Órdenes a enviar"
        description="Órdenes de resellers que compraron tus productos mayoristas. Marcalas como enviadas con tracking para que el buyer reciba el update."
        back={{ label: '← Dropshipping', href: '/dropship' }}
      />

      {migrationMissing && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm px-4 py-3">
          Migration <code>0060_dropshipping.sql</code> pendiente.
        </div>
      )}

      {/* Contadores */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-blue-500/25 bg-blue-500/[0.05] p-4">
          <div className="text-2xl font-bold text-blue-300">{pending.length}</div>
          <div className="text-xs text-white/55">Por enviar</div>
        </div>
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.03] p-4">
          <div className="text-2xl font-bold text-emerald-300">{shipped.length}</div>
          <div className="text-xs text-white/55">En tránsito</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
          <div className="text-2xl font-bold text-white/60">{closed.length}</div>
          <div className="text-xs text-white/55">Cerradas</div>
        </div>
      </div>

      {orders.length === 0 && !migrationMissing && (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center">
          <div className="text-4xl mb-2">📮</div>
          <div className="font-semibold">Todavía no hay órdenes</div>
          <p className="text-sm text-white/55 mt-1">
            Cuando algún reseller venda uno de tus productos, la orden aparece acá con la dirección del buyer para que la envíes.
          </p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="space-y-3">
          {orders.map((o) => {
            const st = STATUS_LABEL[o.status] ?? STATUS_LABEL.pending;
            const totalFmt = (o.wholesale_total_cents / 100).toLocaleString('es-AR');
            const dateFmt = new Date(o.created_at).toLocaleString('es-AR', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            });
            const canShip = o.status === 'confirmed' || o.status === 'pending';
            const canDeliver = o.status === 'shipped';

            return (
              <div key={o.id}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${st.color}`}>
                        {st.emoji} {st.label}
                      </span>
                      <span className="text-[10px] text-white/40 font-mono">
                        #{o.id.slice(0, 8)}
                      </span>
                      <span className="text-[10px] text-white/40">{dateFmt}</span>
                    </div>
                    <div className="text-sm text-white/70">
                      Reseller: <strong className="text-white">{o.reseller_tenants?.name ?? '—'}</strong>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold tabular-nums">${totalFmt} {o.currency}</div>
                    <div className="text-[10px] text-white/40">tu comisión mayorista</div>
                  </div>
                </div>

                {/* Buyer + address */}
                <div className="grid md:grid-cols-2 gap-4 pt-3 border-t border-white/5 text-xs">
                  <div>
                    <div className="text-white/45 uppercase tracking-wider mb-1">Enviar a</div>
                    <div className="text-white font-medium">{o.buyer_name ?? '(sin nombre)'}</div>
                    <div className="text-white/70">{o.buyer_email}</div>
                    {o.buyer_phone && <div className="text-white/70">Tel: {o.buyer_phone}</div>}
                    <div className="text-white/60 mt-1 leading-snug">{fmtAddress(o.shipping_address)}</div>
                  </div>
                  <div>
                    <div className="text-white/45 uppercase tracking-wider mb-1">Productos</div>
                    <ul className="space-y-0.5">
                      {o.items.map((i, idx) => (
                        <li key={idx} className="text-white/80">
                          {i.qty}× {i.title}
                        </li>
                      ))}
                    </ul>
                    {o.reseller_notes && (
                      <div className="mt-2 text-amber-300/80 text-[11px]">
                        📝 Nota del reseller: {o.reseller_notes}
                      </div>
                    )}
                  </div>
                </div>

                {/* Ship form / status */}
                {canShip && (
                  <form action={markSupplierOrderShippedAction}
                    className="pt-3 border-t border-white/5 space-y-2">
                    <input type="hidden" name="order_id" value={o.id} />
                    <div className="grid md:grid-cols-3 gap-2">
                      <input name="tracking_number" placeholder="Nº de tracking"
                        className="rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-xs" />
                      <select name="carrier"
                        className="rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-xs">
                        <option value="" className="bg-neutral-900">— transportista —</option>
                        <option value="Andreani" className="bg-neutral-900">Andreani</option>
                        <option value="Correo Argentino" className="bg-neutral-900">Correo Argentino</option>
                        <option value="OCA" className="bg-neutral-900">OCA</option>
                        <option value="Mercado Envíos" className="bg-neutral-900">Mercado Envíos</option>
                        <option value="Otro" className="bg-neutral-900">Otro</option>
                      </select>
                      <input name="supplier_notes" placeholder="Notas (opc.)"
                        className="rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-xs" />
                    </div>
                    <button type="submit"
                      className="text-xs bg-emerald-500 text-white font-semibold px-4 py-2 rounded hover:bg-emerald-400">
                      📦 Marcar como enviada
                    </button>
                  </form>
                )}

                {o.tracking_number && (
                  <div className="pt-3 border-t border-white/5 text-xs text-white/70 flex items-center gap-3 flex-wrap">
                    <span>📦 Tracking: <code className="font-mono text-white">{o.tracking_number}</code></span>
                    {o.carrier && <span>· {o.carrier}</span>}
                    {canDeliver && (
                      <form action={markSupplierOrderDeliveredAction} className="ml-auto">
                        <input type="hidden" name="order_id" value={o.id} />
                        <button type="submit"
                          className="text-[10px] uppercase tracking-wider font-bold text-emerald-300 hover:underline">
                          ✅ Confirmar entrega
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
