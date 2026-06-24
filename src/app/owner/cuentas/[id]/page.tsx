import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import {
  updateCustomerPlanAction,
  createInvoiceAction,
  markInvoicePaidAction,
  cancelInvoiceAction,
  deleteCustomerPlanAction
} from '@/lib/customer-plans/actions';

export const dynamic = 'force-dynamic';

type Plan = {
  id: string; user_id: string; plan_name: string; description: string | null;
  monthly_amount_cents: number; currency: string; status: string;
  start_date: string; end_date: string | null;
  notes: string | null; customer_message: string | null;
};

type Invoice = {
  id: string; number: string | null; concept: string;
  amount_cents: number; currency: string;
  issued_at: string; due_at: string | null; status: string;
  paid_at: string | null; payment_method: string | null; payment_ref: string | null;
};

export default async function CuentaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: planRaw } = await (svc.from('customer_plans') as any)
    .select('id, user_id, plan_name, description, monthly_amount_cents, currency, status, start_date, end_date, notes, customer_message')
    .eq('id', id).eq('tenant_id', tenant.id).maybeSingle();
  const plan = planRaw as Plan | null;
  if (!plan) notFound();

  const { data: profRaw } = await svc.from('profiles')
    .select('display_name, email').eq('id', plan.user_id).maybeSingle<{ display_name: string | null; email: string | null }>();
  const profile = profRaw;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invRaw } = await (svc.from('customer_invoices') as any)
    .select('id, number, concept, amount_cents, currency, issued_at, due_at, status, paid_at, payment_method, payment_ref')
    .eq('plan_id', plan.id).order('issued_at', { ascending: false });
  const invoices = (invRaw ?? []) as Invoice[];

  const dueAmount = invoices.filter((i) => i.status === 'pending').reduce((s, i) => s + i.amount_cents, 0);
  const paidAmount = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.amount_cents, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link href="/cuentas" className="text-xs text-white/55 hover:text-white">← Cuentas</Link>
        <h1 className="text-2xl font-bold mt-1">{plan.plan_name}</h1>
        <p className="text-sm text-white/55 mt-1">
          {profile?.display_name ?? '(sin nombre)'} · <span className="font-mono">{profile?.email ?? '—'}</span>
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
          <div className="text-xs text-rose-200 uppercase tracking-wide">Deuda pendiente</div>
          <div className="text-2xl font-bold mt-1 font-mono text-rose-200">$ {(dueAmount / 100).toLocaleString('es-AR')}</div>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="text-xs text-emerald-200 uppercase tracking-wide">Total pagado</div>
          <div className="text-2xl font-bold mt-1 font-mono text-emerald-200">$ {(paidAmount / 100).toLocaleString('es-AR')}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-xs text-white/55 uppercase tracking-wide">Cuota mensual</div>
          <div className="text-2xl font-bold mt-1 font-mono">{plan.monthly_amount_cents > 0 ? `$ ${(plan.monthly_amount_cents / 100).toLocaleString('es-AR')}` : '—'}</div>
        </div>
      </div>

      {/* ── Config del plan ── */}
      <details className="rounded-xl border border-white/10 bg-white/[0.02] p-5" open>
        <summary className="cursor-pointer font-semibold select-none">⚙ Configuración del plan</summary>
        <form action={updateCustomerPlanAction} className="space-y-3 mt-4">
          <input type="hidden" name="id" value={plan.id} />
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-white/55">Nombre del plan</span>
              <input name="plan_name" defaultValue={plan.plan_name} required maxLength={200}
                className="mt-1 w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs text-white/55">Cuota mensual (ARS)</span>
              <input name="monthly_amount" type="number" step="1" min={0}
                defaultValue={(plan.monthly_amount_cents / 100).toString()}
                className="mt-1 w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono" />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs text-white/55">Descripción / datos del contrato</span>
              <input name="description" defaultValue={plan.description ?? ''} maxLength={500}
                placeholder="Patente AA999BB, dirección de servicio, etc."
                className="mt-1 w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs text-white/55">Estado</span>
              <select name="status" defaultValue={plan.status}
                className="mt-1 w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
                <option value="active">🟢 Activo</option>
                <option value="suspended">⏸️ Suspendido</option>
                <option value="finished">✓ Finalizado</option>
                <option value="cancelled">⚫ Cancelado</option>
              </select>
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-white/55">📢 Mensaje para el cliente (lo ve en su panel)</span>
            <textarea name="customer_message" defaultValue={plan.customer_message ?? ''} rows={2} maxLength={2000}
              placeholder='Ej: "Tu próxima factura vence el 15. Si necesitás un convenio de pago, contactanos."'
              className="mt-1 w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-white/55">🔒 Notas internas (no visible al cliente)</span>
            <textarea name="notes" defaultValue={plan.notes ?? ''} rows={2} maxLength={2000}
              className="mt-1 w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </label>
          <button type="submit" className="rounded bg-white text-black text-sm font-semibold px-4 py-1.5">
            Guardar cambios
          </button>
        </form>
        <form action={deleteCustomerPlanAction} className="mt-4 pt-4 border-t border-white/10">
          <input type="hidden" name="id" value={plan.id} />
          <button type="submit" className="text-xs text-rose-300 hover:underline">
            Eliminar plan (también borra todas sus facturas)
          </button>
        </form>
      </details>

      {/* ── Nueva factura ── */}
      <form action={createInvoiceAction} className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-5 space-y-3">
        <h2 className="font-semibold text-sm">+ Emitir factura / ajuste</h2>
        <input type="hidden" name="plan_id" value={plan.id} />
        <div className="grid sm:grid-cols-4 gap-3">
          <input name="concept" required maxLength={200} placeholder='Ej. "Cuota Mar 2026"'
            className="sm:col-span-2 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <input name="amount" type="number" step="0.01" required placeholder="Monto (negativo = crédito)"
            className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono" />
          <input name="due_at" type="date" placeholder="Vencimiento"
            className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
        </div>
        <div className="flex items-center gap-3">
          <input name="number" maxLength={40} placeholder="Nro. comprobante (opcional)"
            className="flex-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <button type="submit" className="rounded bg-fuchsia-500 text-white text-sm font-semibold px-4 py-1.5 hover:bg-fuchsia-400 whitespace-nowrap">
            Emitir
          </button>
        </div>
        <p className="text-[10px] text-white/45">
          💡 Monto negativo = nota de crédito / ajuste a favor (descuenta deuda).
        </p>
      </form>

      {/* ── Lista de facturas ── */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <h2 className="bg-[#0f0f0f] px-4 py-2.5 text-xs uppercase tracking-wide text-white/55">
          Facturas y movimientos ({invoices.length})
        </h2>
        <table className="w-full text-sm">
          <thead className="bg-[#0a0a0a] text-white/40 text-[10px] uppercase">
            <tr>
              <th className="px-3 py-2 text-left">Fecha</th>
              <th className="px-3 py-2 text-left">Concepto</th>
              <th className="px-3 py-2 text-left">Vence</th>
              <th className="px-3 py-2 text-right">Monto</th>
              <th className="px-3 py-2 text-left">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-white/40">Sin facturas. Emití una arriba.</td></tr>
            ) : invoices.map((inv) => {
              const isPaid = inv.status === 'paid';
              const isCancelled = inv.status === 'cancelled';
              const isPending = inv.status === 'pending';
              const positive = inv.amount_cents >= 0;
              return (
                <tr key={inv.id} className="border-t border-white/5">
                  <td className="px-3 py-2.5 text-xs text-white/55 whitespace-nowrap">
                    {inv.issued_at}{inv.number && <div className="text-[10px] font-mono text-white/35">{inv.number}</div>}
                  </td>
                  <td className="px-3 py-2.5">{inv.concept}</td>
                  <td className="px-3 py-2.5 text-xs text-white/55 whitespace-nowrap">
                    {inv.due_at ?? '—'}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-mono font-semibold ${positive ? 'text-white' : 'text-emerald-300'}`}>
                    {positive ? '' : '-'}{inv.currency} {Math.abs(inv.amount_cents / 100).toLocaleString('es-AR')}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded border ${
                      isPaid ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' :
                      isCancelled ? 'bg-white/10 text-white/45 border-white/15' :
                      'bg-amber-500/10 text-amber-200 border-amber-500/30'
                    }`}>
                      {isPaid ? '✓ Pagada' : isCancelled ? '⚫ Anulada' : '🟡 Pendiente'}
                    </span>
                    {isPaid && inv.payment_method && (
                      <div className="text-[10px] text-white/45 mt-0.5">{inv.payment_method}{inv.payment_ref && ` · ${inv.payment_ref}`}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {isPending && (
                      <div className="flex items-center gap-1 justify-end">
                        <form action={markInvoicePaidAction}>
                          <input type="hidden" name="id" value={inv.id} />
                          <input type="hidden" name="plan_id" value={plan.id} />
                          <input type="hidden" name="payment_method" value="manual" />
                          <button type="submit" className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30">
                            ✓ Marcar pagada
                          </button>
                        </form>
                        <form action={cancelInvoiceAction}>
                          <input type="hidden" name="id" value={inv.id} />
                          <input type="hidden" name="plan_id" value={plan.id} />
                          <button type="submit" className="text-[10px] px-2 py-1 rounded border border-white/15 text-white/55 hover:bg-white/5">
                            Anular
                          </button>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
