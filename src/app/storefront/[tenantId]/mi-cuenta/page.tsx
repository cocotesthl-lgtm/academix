import { notFound, redirect } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Plan = {
  id: string; plan_name: string; description: string | null;
  monthly_amount_cents: number; currency: string; status: string;
  start_date: string; end_date: string | null; customer_message: string | null;
};

type Invoice = {
  id: string; number: string | null; concept: string;
  amount_cents: number; currency: string;
  issued_at: string; due_at: string | null; status: string;
  paid_at: string | null; payment_method: string | null;
};

const STATUS = {
  active:    { label: '🟢 Activo',     bg: '#10b981' },
  suspended: { label: '⏸️ Suspendido', bg: '#f59e0b' },
  cancelled: { label: '⚫ Cancelado',   bg: '#737373' },
  finished:  { label: '✓ Finalizado',  bg: '#3b82f6' }
} as Record<string, { label: string; bg: string }>;

export default async function MiCuentaPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();
  const primary = tenant.brand?.primary_color ?? '#0a0a0a';

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/mi-cuenta');

  const svc = getServiceClient();
  let plans: Plan[] = [];
  let invByPlan = new Map<string, Invoice[]>();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ps } = await (svc.from('customer_plans') as any)
      .select('id, plan_name, description, monthly_amount_cents, currency, status, start_date, end_date, customer_message')
      .eq('tenant_id', tenantId).eq('user_id', user.id)
      .order('created_at', { ascending: false });
    plans = (ps ?? []) as Plan[];

    if (plans.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: invs } = await (svc.from('customer_invoices') as any)
        .select('id, number, concept, amount_cents, currency, issued_at, due_at, status, paid_at, payment_method, plan_id')
        .in('plan_id', plans.map((p) => p.id))
        .order('issued_at', { ascending: false });
      for (const row of (invs ?? []) as Array<Invoice & { plan_id: string }>) {
        const arr = invByPlan.get(row.plan_id) ?? [];
        arr.push(row);
        invByPlan.set(row.plan_id, arr);
      }
    }
  } catch { /* migration pendiente */ }

  return (
    <article className="max-w-3xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mi cuenta</h1>
        <p className="text-black/55 text-sm mt-1">Tus servicios contratados en {tenant.name}.</p>
      </div>

      {plans.length === 0 && (
        <div className="rounded-2xl border border-black/10 p-10 text-center text-black/45">
          No tenés servicios contratados todavía. Cuando {tenant.name} te dé de alta, vas a verlo acá.
        </div>
      )}

      {plans.map((plan) => {
        const invoices = invByPlan.get(plan.id) ?? [];
        const dueAmount = invoices.filter((i) => i.status === 'pending').reduce((s, i) => s + i.amount_cents, 0);
        const status = STATUS[plan.status] ?? { label: plan.status, bg: '#888' };
        return (
          <section key={plan.id} className="rounded-2xl border border-black/10 overflow-hidden bg-white">
            {/* Header */}
            <div className="p-6 text-white" style={{ background: primary }}>
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="text-xs uppercase tracking-widest opacity-80">Plan contratado</div>
                  <h2 className="text-2xl font-bold mt-1">{plan.plan_name}</h2>
                  {plan.description && <p className="text-sm opacity-85 mt-1">{plan.description}</p>}
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded"
                  style={{ background: 'rgba(0,0,0,0.25)' }}>
                  {status.label}
                </span>
              </div>
              {plan.monthly_amount_cents > 0 && (
                <div className="mt-4 text-sm opacity-90">
                  Cuota mensual: <strong className="font-mono">{plan.currency} {(plan.monthly_amount_cents / 100).toLocaleString('es-AR')}</strong>
                </div>
              )}
            </div>

            {/* Comunicación del owner al cliente */}
            {plan.customer_message && (
              <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-900">
                📢 {plan.customer_message}
              </div>
            )}

            {/* Deuda destacada */}
            {dueAmount !== 0 && (
              <div className={`px-6 py-4 ${dueAmount > 0 ? 'bg-rose-50 border-b border-rose-200' : 'bg-emerald-50 border-b border-emerald-200'}`}>
                <div className="text-xs uppercase tracking-wide text-black/55">
                  {dueAmount > 0 ? 'Saldo a pagar' : 'Saldo a favor'}
                </div>
                <div className={`text-2xl font-bold mt-1 font-mono ${dueAmount > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  $ {Math.abs(dueAmount / 100).toLocaleString('es-AR')}
                </div>
              </div>
            )}

            {/* Facturas */}
            <div className="p-6">
              <h3 className="text-sm font-semibold mb-3">Historial de facturas</h3>
              {invoices.length === 0 ? (
                <p className="text-xs text-black/40">Sin facturas todavía.</p>
              ) : (
                <ul className="divide-y divide-black/5">
                  {invoices.map((inv) => {
                    const isPaid = inv.status === 'paid';
                    const isCancelled = inv.status === 'cancelled';
                    const isPending = inv.status === 'pending';
                    const isCredit = inv.amount_cents < 0;
                    return (
                      <li key={inv.id} className="py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{inv.concept}</div>
                          <div className="text-[11px] text-black/55 mt-0.5">
                            Emitida {inv.issued_at}{inv.due_at && ` · Vence ${inv.due_at}`}{inv.number && ` · ${inv.number}`}
                          </div>
                          {isPaid && inv.paid_at && (
                            <div className="text-[10px] text-emerald-700 mt-0.5">
                              ✓ Pagada el {new Date(inv.paid_at).toLocaleDateString('es-AR')}{inv.payment_method && ` (${inv.payment_method})`}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className={`font-mono font-bold text-sm ${isCredit ? 'text-emerald-700' : 'text-black'}`}>
                            {isCredit ? '-' : ''}{inv.currency} {Math.abs(inv.amount_cents / 100).toLocaleString('es-AR')}
                          </div>
                          <span className={`text-[9px] uppercase tracking-wider font-bold ${
                            isPaid ? 'text-emerald-700' :
                            isCancelled ? 'text-black/35' :
                            'text-amber-700'
                          }`}>
                            {isPaid ? '✓ Pagada' : isCancelled ? '⚫ Anulada' : '🟡 Pendiente'}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {dueAmount > 0 && (
              <div className="px-6 pb-6">
                <div className="rounded-md bg-black/[0.04] p-3 text-xs text-black/65">
                  Para pagar facturas pendientes, contactá a {tenant.name}.
                  <br />
                  <span className="text-black/45">Pronto vas a poder pagarlas con MercadoPago desde acá.</span>
                </div>
              </div>
            )}
          </section>
        );
      })}
    </article>
  );
}
