import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerBalance } from "@/lib/debt/accrue";
import { payDebtAction } from "@/lib/debt/payment";

export const dynamic = "force-dynamic";

type LedgerRow = {
  id: string;
  type: string;
  amount_cents: number;
  balance_after_cents: number;
  commission_rate_applied: number | null;
  status: string;
  created_at: string;
  sale_id: string | null;
};

type SaleRow = {
  id: string;
  external_id: string;
  amount_gross_cents: number;
  currency: string;
  status: string;
  occurred_at: string;
};

const REMINDER_THRESHOLD = 50_000_00; // ARS 50.000 in cents
const COLLECTION_THRESHOLD = 200_000_00;

function ars(cents: number, currency = 'ARS') {
  return `${(cents / 100).toLocaleString('es-AR')} ${currency}`;
}

export default async function OwnerFinance() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  const [balance, { data: ledger }, { data: sales }] = await Promise.all([
    getOwnerBalance(tenant.id),
    svc.from("owner_debt_ledger")
      .select("id, type, amount_cents, balance_after_cents, commission_rate_applied, status, created_at, sale_id")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(20),
    svc.from("sales")
      .select("id, external_id, amount_gross_cents, currency, status, occurred_at")
      .eq("tenant_id", tenant.id)
      .order("occurred_at", { ascending: false })
      .limit(10)
  ]);

  const ledgerRows = (ledger ?? []) as LedgerRow[];
  const salesRows = (sales ?? []) as SaleRow[];

  const showReminder = balance >= REMINDER_THRESHOLD && balance < COLLECTION_THRESHOLD;
  const showCollection = balance >= COLLECTION_THRESHOLD;

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Finanzas</h1>
        <p className="text-white/60 text-sm mt-1">
          Vos cobrás directo a tu MercadoPago. Acá vemos la comisión que vas acumulando como deuda con la plataforma.
        </p>
      </div>

      {showCollection && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 p-4">
          <strong>Pago requerido.</strong> Tu saldo supera ARS 200.000. Vamos a habilitarte el botón para
          pagar en los próximos días, o te suspendemos el storefront tras 7 días de gracia.
        </div>
      )}
      {showReminder && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 p-4">
          Saldo creciendo. Podés esperar al próximo cierre, pero te avisamos para que tengas visibilidad.
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <Stat label="Saldo a pagar" value={ars(balance)} highlight />
        <Stat label="Ventas (últimas 10)" value={salesRows.length.toString()} />
        <Stat label="Movimientos de ledger" value={ledgerRows.length.toString()} />
      </div>

      {balance > 0 && (
        <form action={payDebtAction}>
          <button className="rounded-md bg-white text-black px-5 py-2.5 font-semibold hover:bg-white/90">
            Pagar saldo ({ars(balance)})
          </button>
          <p className="text-xs text-white/40 mt-2">
            Te redirige a MercadoPago para pagar la comisión acumulada. Una vez confirmado el pago,
            tu storefront se reactiva automáticamente si estaba suspendido.
          </p>
        </form>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">Últimos movimientos</h2>
        <div className="rounded-xl border border-white/10 overflow-hidden">
          {ledgerRows.length === 0 ? (
            <div className="p-6 text-sm text-white/50">
              Sin movimientos todavía. Cuando MP confirme tu primera venta vas a ver acá la comisión acumulada.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-white/50 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5">Fecha</th>
                  <th className="text-left px-4 py-2.5">Tipo</th>
                  <th className="text-right px-4 py-2.5">Monto</th>
                  <th className="text-right px-4 py-2.5">Tasa</th>
                  <th className="text-right px-4 py-2.5">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="px-4 py-2.5 text-white/60">{new Date(r.created_at).toLocaleString('es-AR')}</td>
                    <td className="px-4 py-2.5">{r.type}</td>
                    <td className={`px-4 py-2.5 text-right font-mono ${r.amount_cents >= 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                      {r.amount_cents >= 0 ? '+' : ''}{(r.amount_cents / 100).toLocaleString('es-AR')}
                    </td>
                    <td className="px-4 py-2.5 text-right text-white/60 font-mono">
                      {r.commission_rate_applied !== null ? `${(r.commission_rate_applied * 100).toFixed(2)}%` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono">{(r.balance_after_cents / 100).toLocaleString('es-AR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Últimas ventas</h2>
        <div className="rounded-xl border border-white/10 overflow-hidden">
          {salesRows.length === 0 ? (
            <div className="p-6 text-sm text-white/50">Sin ventas todavía.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-white/50 text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-2.5">Fecha</th>
                  <th className="text-left px-4 py-2.5">MP ID</th>
                  <th className="text-left px-4 py-2.5">Estado</th>
                  <th className="text-right px-4 py-2.5">Monto bruto</th>
                </tr>
              </thead>
              <tbody>
                {salesRows.map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="px-4 py-2.5 text-white/60">{new Date(s.occurred_at).toLocaleString('es-AR')}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{s.external_id}</td>
                    <td className="px-4 py-2.5">{s.status}</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {ars(s.amount_gross_cents, s.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <p className="text-xs text-white/40">
        El cobro de la deuda vía botón "Pagar saldo" se habilita en la próxima versión.
      </p>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-white/30 bg-white/[0.05]' : 'border-white/10 bg-white/[0.02]'}`}>
      <div className="text-xs text-white/50 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-2 font-mono">{value}</div>
    </div>
  );
}
