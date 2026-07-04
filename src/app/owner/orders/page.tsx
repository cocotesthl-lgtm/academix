import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/owner/PageHeader';
import { relativeTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

type OrderRow = {
  id: string;
  buyer_email: string;
  buyer_name: string | null;
  status: string;
  total_cents: number;
  shipping_method_label: string | null;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:    { label: 'pendiente',    color: 'bg-amber-500/15 text-amber-300' },
  paid:       { label: 'pagada',       color: 'bg-emerald-500/15 text-emerald-300' },
  preparing:  { label: 'preparando',   color: 'bg-blue-500/15 text-blue-300' },
  shipped:    { label: 'enviada',      color: 'bg-indigo-500/15 text-indigo-300' },
  delivered:  { label: 'entregada',    color: 'bg-emerald-500/25 text-emerald-200' },
  cancelled:  { label: 'cancelada',    color: 'bg-white/10 text-white/50' },
  refunded:   { label: 'reembolsada',  color: 'bg-rose-500/15 text-rose-300' }
};

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
  }).format(cents / 100);
}

export default async function OrdersListPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('physical_orders') as any)
    .select('id, buyer_email, buyer_name, status, total_cents, shipping_method_label, created_at, paid_at, shipped_at')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })
    .limit(200);
  const rows = (data ?? []) as OrderRow[];

  const pendingShipment = rows.filter((r) => r.status === 'paid' || r.status === 'preparing').length;
  const totalRevenue = rows
    .filter((r) => r.status === 'paid' || r.status === 'preparing' || r.status === 'shipped' || r.status === 'delivered')
    .reduce((s, r) => s + r.total_cents, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Órdenes de la tienda"
        description="Ventas de productos físicos. Marcá como enviadas cuando despachás el paquete."
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-white/10 p-4">
          <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Total órdenes</div>
          <div className="text-2xl font-bold">{rows.length}</div>
        </div>
        <div className="rounded-lg border border-amber-500/30 p-4 bg-amber-500/[0.03]">
          <div className="text-xs text-amber-300 uppercase tracking-wider mb-1">Pendientes de envío</div>
          <div className="text-2xl font-bold">{pendingShipment}</div>
        </div>
        <div className="rounded-lg border border-white/10 p-4">
          <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Ingresos</div>
          <div className="text-2xl font-bold">{formatMoney(totalRevenue)}</div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center">
          <div className="text-4xl mb-2">📦</div>
          <div className="text-white/70 font-medium">Sin órdenes todavía</div>
          <p className="text-xs text-white/45 mt-1 mb-4">
            Cuando alguien te compre un producto físico, aparecerá acá.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 divide-y divide-white/5 overflow-hidden">
          {rows.map((r) => {
            const st = STATUS_LABEL[r.status] ?? { label: r.status, color: 'bg-white/10 text-white/60' };
            return (
              <Link key={r.id} href={`/orders/${r.id}`}
                className="flex items-center gap-4 p-4 hover:bg-white/[0.03] transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-white/50">#{r.id.slice(0, 8)}</span>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                  <div className="text-sm mt-1 truncate">
                    {r.buyer_name ? `${r.buyer_name} · ` : ''}{r.buyer_email}
                  </div>
                  <div className="text-[11px] text-white/45 mt-0.5">
                    {relativeTime(r.created_at)}
                    {r.shipping_method_label && <> · {r.shipping_method_label}</>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold">{formatMoney(r.total_cents)}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
