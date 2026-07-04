import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { OrderStatusBox } from '@/components/owner/orders/OrderStatusBox';
import { setOrderTrackingAction } from '@/lib/orders/actions';

export const dynamic = 'force-dynamic';

type Order = {
  id: string;
  buyer_email: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  shipping_address: Record<string, string> | null;
  shipping_method_label: string | null;
  items_total_cents: number;
  shipping_cost_cents: number;
  total_cents: number;
  currency: string;
  status: string;
  tracking_number: string | null;
  tracking_url: string | null;
  notes: string | null;
  buyer_notes: string | null;
  payment_id: string | null;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
};

type Item = {
  id: string;
  qty: number;
  unit_price_cents: number;
  product_title: string;
  variant_label: string | null;
  sku: string | null;
};

function formatMoney(cents: number, currency = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency, maximumFractionDigits: 0
  }).format(cents / 100);
}

export default async function OrderDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('physical_orders') as any)
    .select('*').eq('id', id).eq('tenant_id', tenant.id).maybeSingle();
  const order = data as Order | null;
  if (!order) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: itemsRaw } = await (svc.from('physical_order_items') as any)
    .select('id, qty, unit_price_cents, product_title, variant_label, sku')
    .eq('order_id', id);
  const items = (itemsRaw ?? []) as Item[];

  const boundTracking = setOrderTrackingAction.bind(null, id);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/orders" className="text-white/50 hover:text-white text-sm">← Órdenes</Link>
        <span className="text-white/30">/</span>
        <span className="font-mono text-sm text-white/70">#{order.id.slice(0, 8)}</span>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="md:col-span-2 space-y-4">
          {/* Items */}
          <section className="rounded-xl border border-white/10 p-4">
            <h2 className="text-sm font-semibold mb-3">Productos</h2>
            <ul className="divide-y divide-white/5">
              {items.map((it) => (
                <li key={it.id} className="py-3 flex justify-between">
                  <div>
                    <div className="text-sm font-medium">{it.product_title}</div>
                    {it.variant_label && (
                      <div className="text-xs text-white/50">{it.variant_label}</div>
                    )}
                    {it.sku && (
                      <div className="text-[10px] font-mono text-white/40">{it.sku}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-white/50">×{it.qty}</div>
                    <div className="text-sm font-mono">{formatMoney(it.unit_price_cents * it.qty, order.currency)}</div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="pt-3 mt-2 border-t border-white/5 space-y-1 text-sm">
              <div className="flex justify-between text-white/60">
                <span>Subtotal</span>
                <span>{formatMoney(order.items_total_cents, order.currency)}</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Envío</span>
                <span>{order.shipping_cost_cents === 0 ? 'Gratis' : formatMoney(order.shipping_cost_cents, order.currency)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-2 border-t border-white/10">
                <span>Total</span>
                <span>{formatMoney(order.total_cents, order.currency)}</span>
              </div>
            </div>
          </section>

          {/* Comprador */}
          <section className="rounded-xl border border-white/10 p-4">
            <h2 className="text-sm font-semibold mb-3">Comprador</h2>
            <div className="space-y-1 text-sm">
              {order.buyer_name && <div><span className="text-white/50">Nombre:</span> {order.buyer_name}</div>}
              <div><span className="text-white/50">Email:</span> {order.buyer_email}</div>
              {order.buyer_phone && <div><span className="text-white/50">Teléfono:</span> {order.buyer_phone}</div>}
              {order.buyer_notes && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  <div className="text-white/50 text-xs mb-1">Nota del comprador</div>
                  <div className="italic text-white/75">{order.buyer_notes}</div>
                </div>
              )}
            </div>
          </section>

          {/* Envío */}
          {order.shipping_address && (
            <section className="rounded-xl border border-white/10 p-4">
              <h2 className="text-sm font-semibold mb-3">Envío</h2>
              <div className="text-sm space-y-1">
                {order.shipping_method_label && (
                  <div className="text-white/70 mb-2">{order.shipping_method_label}</div>
                )}
                <div>
                  {order.shipping_address.street} {order.shipping_address.number}
                  {order.shipping_address.apt && `, ${order.shipping_address.apt}`}
                </div>
                <div>{order.shipping_address.city}, CP {order.shipping_address.postal_code}</div>
              </div>
            </section>
          )}

          {/* Tracking */}
          {(order.status === 'paid' || order.status === 'preparing' || order.status === 'shipped') && (
            <section className="rounded-xl border border-white/10 p-4">
              <h2 className="text-sm font-semibold mb-3">Tracking</h2>
              <form action={boundTracking} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input name="tracking_number" defaultValue={order.tracking_number ?? ''}
                    placeholder="Número de seguimiento (ej. Correo AR)"
                    className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40" />
                  <input type="url" name="tracking_url" defaultValue={order.tracking_url ?? ''}
                    placeholder="URL de seguimiento (opc)"
                    className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40" />
                </div>
                <textarea name="notes" defaultValue={order.notes ?? ''} rows={2}
                  placeholder="Notas internas"
                  className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40" />
                <button type="submit"
                  className="text-xs rounded bg-white text-black font-semibold px-3 py-1.5 hover:bg-white/90">
                  Guardar tracking
                </button>
              </form>
            </section>
          )}
        </div>

        {/* Columna derecha - status */}
        <aside>
          <OrderStatusBox
            orderId={order.id}
            status={order.status as 'pending' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'}
            paidAt={order.paid_at}
            shippedAt={order.shipped_at}
            deliveredAt={order.delivered_at}
            paymentId={order.payment_id}
          />
        </aside>
      </div>
    </div>
  );
}
