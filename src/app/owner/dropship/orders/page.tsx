import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/owner/PageHeader';

export const dynamic = 'force-dynamic';

type ResellerOrderRow = {
  id: string;
  status: string;
  items: Array<{ title: string; qty: number; wholesale_price_cents: number }>;
  wholesale_total_cents: number;
  currency: string;
  tracking_number: string | null;
  carrier: string | null;
  supplier_notes: string | null;
  created_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
  supplier_tenants: { name: string; supplier_display_name: string | null } | null;
};

const STATUS_LABEL: Record<string, { emoji: string; label: string; color: string }> = {
  pending:   { emoji: '⏳', label: 'Esperando confirmación', color: 'bg-white/10 text-white/60' },
  confirmed: { emoji: '📥', label: 'Enviada al supplier',    color: 'bg-blue-500/20 text-blue-300' },
  shipped:   { emoji: '📦', label: 'En tránsito',            color: 'bg-emerald-500/20 text-emerald-300' },
  delivered: { emoji: '✅', label: 'Entregada',              color: 'bg-emerald-500/20 text-emerald-300' },
  cancelled: { emoji: '❌', label: 'Cancelada',              color: 'bg-white/10 text-white/40' },
  refunded:  { emoji: '↩',  label: 'Reembolsada',            color: 'bg-white/10 text-white/40' }
};

export default async function ResellerDropshipOrdersPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  let orders: ResellerOrderRow[] = [];
  let migrationMissing = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('supplier_orders') as any)
      .select('*, supplier_tenants:tenants!supplier_orders_supplier_tenant_id_fkey(name, supplier_display_name)')
      .eq('reseller_tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error?.message?.includes('does not exist')) migrationMissing = true;
    else orders = (data ?? []) as ResellerOrderRow[];
  } catch { migrationMissing = true; }

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Mis órdenes dropship"
        description="Órdenes de tu tienda que están siendo procesadas por suppliers. Vas a ver el tracking cuando lo carguen."
        back={{ label: '← Dropshipping', href: '/dropship' }}
      />

      {migrationMissing && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm px-4 py-3">
          Migration <code>0060_dropshipping.sql</code> pendiente.
        </div>
      )}

      {orders.length === 0 && !migrationMissing && (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center">
          <div className="text-4xl mb-2">📦</div>
          <div className="font-semibold">Todavía no tenés órdenes dropship</div>
          <p className="text-sm text-white/55 mt-1">
            Cuando alguien compre uno de tus productos añadidos del marketplace, la orden aparece acá con el estado del envío.
          </p>
        </div>
      )}

      {orders.length > 0 && (
        <div className="space-y-3">
          {orders.map((o) => {
            const st = STATUS_LABEL[o.status] ?? STATUS_LABEL.pending;
            const supplierName = o.supplier_tenants?.supplier_display_name ?? o.supplier_tenants?.name ?? '—';
            const totalFmt = (o.wholesale_total_cents / 100).toLocaleString('es-AR');
            const dateFmt = new Date(o.created_at).toLocaleString('es-AR', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            });

            return (
              <div key={o.id}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${st.color}`}>
                        {st.emoji} {st.label}
                      </span>
                      <span className="text-[10px] text-white/40 font-mono">#{o.id.slice(0, 8)}</span>
                      <span className="text-[10px] text-white/40">{dateFmt}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-white/60">Supplier:</span>{' '}
                      <strong className="text-white">{supplierName}</strong>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold tabular-nums">${totalFmt} {o.currency}</div>
                    <div className="text-[10px] text-white/40">costo mayorista</div>
                  </div>
                </div>

                <ul className="text-xs text-white/70 space-y-0.5 border-t border-white/5 pt-2">
                  {o.items.map((i, idx) => (
                    <li key={idx}>{i.qty}× {i.title}</li>
                  ))}
                </ul>

                {o.tracking_number && (
                  <div className="pt-2 mt-2 border-t border-white/5 text-xs text-white/70 flex items-center gap-2">
                    📦 Tracking: <code className="font-mono text-white">{o.tracking_number}</code>
                    {o.carrier && <span className="text-white/50">· {o.carrier}</span>}
                  </div>
                )}
                {o.supplier_notes && (
                  <div className="mt-2 text-[11px] text-white/50 italic">💬 {o.supplier_notes}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
