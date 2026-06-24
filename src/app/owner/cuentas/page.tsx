import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { createCustomerPlanAction } from '@/lib/customer-plans/actions';
import { PageHeader } from '@/components/owner/PageHeader';

export const dynamic = 'force-dynamic';

type PlanRow = {
  id: string; user_id: string; plan_name: string; description: string | null;
  monthly_amount_cents: number; currency: string; status: string;
  start_date: string; end_date: string | null;
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active:    { label: '🟢 Activo',     cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
  suspended: { label: '⏸️ Suspendido', cls: 'bg-amber-500/10 text-amber-200 border-amber-500/30' },
  cancelled: { label: '⚫ Cancelado',   cls: 'bg-white/10 text-white/55 border-white/15' },
  finished:  { label: '✓ Finalizado',  cls: 'bg-blue-500/10 text-blue-200 border-blue-500/30' }
};

export default async function CuentasPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  let migrationMissing = false;
  let plans: PlanRow[] = [];
  let profiles = new Map<string, { display_name: string | null; email: string | null }>();
  let dueByPlan = new Map<string, { count: number; amount: number }>();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ps, error } = await (svc.from('customer_plans') as any)
      .select('id, user_id, plan_name, description, monthly_amount_cents, currency, status, start_date, end_date')
      .eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    if (error?.message?.includes('does not exist')) migrationMissing = true;
    plans = (ps ?? []) as PlanRow[];

    const userIds = Array.from(new Set(plans.map((p) => p.user_id)));
    if (userIds.length > 0) {
      const { data: prs } = await svc.from('profiles').select('id, display_name, email').in('id', userIds);
      profiles = new Map(((prs ?? []) as Array<{ id: string; display_name: string | null; email: string | null }>)
        .map((p) => [p.id, p]));
    }

    // Facturas pending por plan (suma deuda)
    const planIds = plans.map((p) => p.id);
    if (planIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inv } = await (svc.from('customer_invoices') as any)
        .select('plan_id, amount_cents, status').in('plan_id', planIds).eq('status', 'pending');
      for (const row of (inv ?? []) as Array<{ plan_id: string; amount_cents: number }>) {
        const cur = dueByPlan.get(row.plan_id) ?? { count: 0, amount: 0 };
        cur.count += 1; cur.amount += row.amount_cents;
        dueByPlan.set(row.plan_id, cur);
      }
    }
  } catch { migrationMissing = true; }

  const totalDue = Array.from(dueByPlan.values()).reduce((s, v) => s + v.amount, 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="📋 Cuentas / Planes contratados"
        description="Para clientes recurrentes: cuotas mensuales, facturas, ajustes. Pensado para automotrices, telcos, ISP, prepagas, financiación de productos, etc."
      />

      {migrationMissing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          ⚠️ Falta correr la migración. Pegá <code className="text-xs bg-black/30 px-1.5 py-0.5 rounded">src/db/migrations/RUN_THIS_NOW.sql</code> en Supabase SQL Editor.
        </div>
      )}

      {!migrationMissing && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-xs text-white/55 uppercase tracking-wide">Planes activos</div>
              <div className="text-2xl font-bold mt-1">{plans.filter((p) => p.status === 'active').length}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-xs text-white/55 uppercase tracking-wide">Total facturado pendiente</div>
              <div className="text-2xl font-bold mt-1 font-mono">$ {(totalDue / 100).toLocaleString('es-AR')}</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-xs text-white/55 uppercase tracking-wide">Clientes únicos</div>
              <div className="text-2xl font-bold mt-1">{new Set(plans.map((p) => p.user_id)).size}</div>
            </div>
          </div>

          <form action={createCustomerPlanAction} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
            <h2 className="font-semibold text-sm">+ Crear plan / cuenta</h2>
            <p className="text-xs text-white/55">
              El cliente tiene que estar registrado en tu sitio (su email). Después podés agregarle facturas/cuotas.
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              <input name="user_email" type="email" required placeholder="Email del cliente"
                className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
              <input name="plan_name" required maxLength={200} placeholder='Ej. "Línea 1144-5555" / "Plan Familiar"'
                className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
              <input name="monthly_amount" type="number" step="1" min={0} placeholder="Cuota mensual (ARS, opcional)"
                className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono" />
            </div>
            <input name="description" maxLength={500} placeholder="Descripción opcional (datos del contrato, patente, dirección, etc.)"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <button type="submit" className="rounded bg-white text-black text-sm font-semibold px-4 py-1.5">
              Crear plan
            </button>
          </form>

          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#0f0f0f] text-white/50 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-left">Plan</th>
                  <th className="px-3 py-2 text-right">Cuota</th>
                  <th className="px-3 py-2 text-right">Deuda</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {plans.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-white/40">Sin planes todavía. Creá el primero arriba.</td></tr>
                ) : plans.map((p) => {
                  const prof = profiles.get(p.user_id);
                  const due = dueByPlan.get(p.id);
                  const status = STATUS_LABEL[p.status] ?? { label: p.status, cls: 'bg-white/10 text-white/55' };
                  return (
                    <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{prof?.display_name ?? '(sin nombre)'}</div>
                        <div className="text-xs text-white/45 font-mono">{prof?.email}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{p.plan_name}</div>
                        {p.description && <div className="text-xs text-white/45 truncate max-w-xs">{p.description}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">
                        {p.monthly_amount_cents > 0 ? `$ ${(p.monthly_amount_cents / 100).toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {due ? (
                          <div>
                            <div className="font-mono font-bold text-rose-300">$ {(due.amount / 100).toLocaleString('es-AR')}</div>
                            <div className="text-[10px] text-white/45">{due.count} {due.count === 1 ? 'factura' : 'facturas'}</div>
                          </div>
                        ) : <span className="text-white/30 text-xs">sin deuda</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${status.cls}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link href={`/cuentas/${p.id}`} className="text-xs px-2.5 py-1 rounded border border-white/15 hover:bg-white/5">
                          Abrir →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
