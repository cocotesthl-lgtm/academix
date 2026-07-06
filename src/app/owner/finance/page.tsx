import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { getOwnerBalance } from "@/lib/debt/accrue";
import { CopyButton } from "@/components/owner/CopyButton";
import { PageHeader, HeaderSecondary } from "@/components/owner/PageHeader";
import { SegmentedTabs, SALES_TABS } from "@/components/owner/SegmentedTabs";

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

  // Subscriptions opcional — si la migration 0013 no corrió, vacío.
  type SubRow = {
    id: string; status: string; frequency: 'monthly' | 'yearly';
    amount_cents: number; currency: string; course_id: string;
    user_id: string | null; started_at: string; next_billing_at: string | null;
  };
  let subsRaw: SubRow[] | null = null;
  try {
    const { data, error } = await svc.from("subscriptions")
      .select("id, status, frequency, amount_cents, currency, course_id, user_id, started_at, next_billing_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error) subsRaw = (data ?? []) as SubRow[];
  } catch { /* tabla no existe */ }

  const ledgerRows = (ledger ?? []) as LedgerRow[];
  const salesRows = (sales ?? []) as SaleRow[];
  const subs = (subsRaw ?? []) as Array<{
    id: string; status: string; frequency: 'monthly' | 'yearly';
    amount_cents: number; currency: string; course_id: string;
    user_id: string | null; started_at: string; next_billing_at: string | null;
  }>;

  // MRR estimado: sumamos amount_cents normalizado a mes de las subs authorized.
  const activeSubs = subs.filter((s) => s.status === 'authorized');
  const mrrCents = activeSubs.reduce((sum, s) =>
    sum + (s.frequency === 'monthly' ? s.amount_cents : Math.round(s.amount_cents / 12)),
    0
  );

  const showReminder = balance >= REMINDER_THRESHOLD && balance < COLLECTION_THRESHOLD;
  const showCollection = balance >= COLLECTION_THRESHOLD;

  return (
    <div className="space-y-8 max-w-5xl">
      <SegmentedTabs tabs={SALES_TABS} />
      <PageHeader
        title="Finanzas"
        description="Vos cobrás directo a tu MercadoPago. Acá vemos la comisión que vas acumulando como deuda con la plataforma."
        actions={<HeaderSecondary href="/ventas">Ver ventas</HeaderSecondary>}
      />

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

      <div className="grid md:grid-cols-4 gap-4">
        <Stat label="Saldo a pagar" value={ars(balance)} highlight />
        <Stat label="MRR estimado" value={ars(mrrCents)} />
        <Stat label="Suscripciones activas" value={activeSubs.length.toString()} />
        <Stat label="Ventas (últimas 10)" value={salesRows.length.toString()} />
      </div>

      {subs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Suscripciones</h2>
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-white/50 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Estado</th>
                  <th className="text-left px-3 py-2">Frecuencia</th>
                  <th className="text-right px-3 py-2">Monto</th>
                  <th className="text-left px-3 py-2">Próximo cobro</th>
                  <th className="text-left px-3 py-2">Inicio</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        s.status === 'authorized' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                        : s.status === 'paused' ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                        : s.status === 'cancelled' ? 'bg-red-500/10 text-red-300 border border-red-500/30'
                        : 'bg-white/5 text-white/50 border border-white/15'
                      }`}>{s.status}</span>
                    </td>
                    <td className="px-3 py-2 text-white/70">{s.frequency === 'monthly' ? 'Mensual' : 'Anual'}</td>
                    <td className="px-3 py-2 text-right font-mono">{ars(s.amount_cents, s.currency)}</td>
                    <td className="px-3 py-2 text-white/70">
                      {s.next_billing_at ? new Date(s.next_billing_at).toLocaleDateString('es-AR') : '—'}
                    </td>
                    <td className="px-3 py-2 text-white/70">
                      {s.started_at ? new Date(s.started_at).toLocaleDateString('es-AR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {balance > 0 && <CryptoPayoutCard balanceCents={balance} />}

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
        Cuando el equipo de OfferNow confirme tu pago en cripto, tu saldo vuelve a 0 automáticamente
        y, si estabas suspendido, tu storefront se reactiva.
      </p>
    </div>
  );
}

/**
 * Card de pago vía cripto. Muestra las direcciones que la plataforma
 * publicó en env vars (CURPLAT_USDT_TRC20, CURPLAT_USDT_ERC20, CURPLAT_BTC).
 * El owner transfiere y manda comprobante por soporte; el founder marca
 * saldado desde /founder/tenants → settleDebtManuallyAction.
 */
function CryptoPayoutCard({ balanceCents }: { balanceCents: number }) {
  const wallets = [
    { label: 'USDT (TRC20 · Tron)', addr: process.env.CURPLAT_USDT_TRC20 || '' },
    { label: 'USDT (BEP20 · BSC)', addr: process.env.CURPLAT_USDT_BEP20 || '' },
    { label: 'USDT (ERC20 · Ethereum)', addr: process.env.CURPLAT_USDT_ERC20 || '' },
    { label: 'BTC (Bitcoin)', addr: process.env.CURPLAT_BTC || '' }
  ].filter((w) => w.addr);

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🪙</span>
          <h3 className="font-semibold">Saldar tu comisión con cripto</h3>
        </div>
        <p className="text-sm text-white/70 leading-relaxed">
          Por ahora la comisión se paga en USDT o BTC. Transferí el equivalente a{' '}
          <strong>${(balanceCents / 100).toLocaleString('es-AR')} ARS</strong> a una de estas direcciones
          y mandanos el comprobante por <a href="/soporte/new" className="underline hover:text-white">soporte</a>.
          En menos de 24h marcamos tu saldo en 0.
        </p>
      </div>

      {wallets.length === 0 ? (
        <div className="rounded border border-white/15 bg-white/5 p-4 text-xs text-white/60">
          El admin de OfferNow todavía no publicó las direcciones de cripto. Pedile el dato por soporte
          y te las pasa a mano mientras tanto.
        </div>
      ) : (
        <div className="space-y-2">
          {wallets.map((w) => (
            <div key={w.label} className="flex items-center gap-3 rounded border border-white/10 bg-white/[0.03] p-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white/50 uppercase tracking-wider">{w.label}</div>
                <div className="font-mono text-xs text-white truncate">{w.addr}</div>
              </div>
              <CopyButton value={w.addr} />
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-white/45 leading-snug">
        Tipo de cambio sugerido: el del momento de la transferencia (CoinGecko / Binance).
        Cualquier diferencia menor se ajusta en el próximo ciclo.
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
