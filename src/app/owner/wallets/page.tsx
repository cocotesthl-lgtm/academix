import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import {
  adminAdjustWalletAction,
  setWalletTransfersEnabledAction,
  setWalletWithdrawalsEnabledAction,
  setWalletCurrencyAction,
  setWalletInvestmentEnabledAction,
  applyWalletYieldAction,
  approveWithdrawalAction,
  rejectWithdrawalAction
} from '@/lib/wallets/actions';
import Link from 'next/link';
import { PageHeader } from '@/components/owner/PageHeader';
import { SegmentedTabs, SALES_TABS } from '@/components/owner/SegmentedTabs';

export const dynamic = 'force-dynamic';

type WalletRow = {
  id: string;
  user_id: string;
  balance_cents: number;
  currency: string;
  updated_at: string;
};

type TxRow = {
  id: string;
  user_id: string;
  amount_cents: number;
  balance_after_cents: number;
  kind: string;
  concept: string | null;
  note: string | null;
  created_at: string;
};

export default async function WalletsPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  let migrationMissing = false;
  let wallets: WalletRow[] = [];
  let txs: TxRow[] = [];
  let profiles = new Map<string, { display_name: string | null; email: string | null }>();
  let transfersEnabled = false;
  let withdrawalsEnabled = false;
  let currencyLabel = 'ARS';
  let currencySymbol = '$';
  let investmentEnabled = false;
  let defaultYieldRateBps = 0;
  let pendingWithdrawals: Array<{
    id: string; user_id: string; amount_cents: number; currency: string;
    method: string | null; destination: string | null; note: string | null;
    requested_at: string;
  }> = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: t } = await (svc.from('tenants') as any)
      .select('wallet_transfers_enabled, wallet_withdrawals_enabled, wallet_currency_label, wallet_currency_symbol, wallet_investment_enabled, wallet_default_yield_rate_bps')
      .eq('id', tenant.id).maybeSingle();
    transfersEnabled = !!t?.wallet_transfers_enabled;
    withdrawalsEnabled = !!t?.wallet_withdrawals_enabled;
    if (t?.wallet_currency_label) currencyLabel = t.wallet_currency_label;
    if (t?.wallet_currency_symbol) currencySymbol = t.wallet_currency_symbol;
    investmentEnabled = !!t?.wallet_investment_enabled;
    if (typeof t?.wallet_default_yield_rate_bps === 'number') defaultYieldRateBps = t.wallet_default_yield_rate_bps;
  } catch { /* migration 0042/0061/0062 pendiente */ }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pw } = await (svc.from('wallet_withdrawal_requests') as any)
      .select('id, user_id, amount_cents, currency, method, destination, note, requested_at')
      .eq('tenant_id', tenant.id).eq('status', 'pending').order('requested_at');
    pendingWithdrawals = pw ?? [];
  } catch { /* migration 0042 pendiente */ }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ws, error } = await (svc.from('wallets') as any)
      .select('id, user_id, balance_cents, currency, updated_at')
      .eq('tenant_id', tenant.id).order('balance_cents', { ascending: false });
    if (error?.message?.includes('does not exist')) migrationMissing = true;
    wallets = (ws ?? []) as WalletRow[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: t } = await (svc.from('wallet_transactions') as any)
      .select('id, user_id, amount_cents, balance_after_cents, kind, concept, note, created_at')
      .eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(50);
    txs = (t ?? []) as TxRow[];

    const ids = Array.from(new Set([...wallets.map((w) => w.user_id), ...txs.map((x) => x.user_id)]));
    if (ids.length > 0) {
      const { data: prs } = await svc.from('profiles').select('id, display_name, email').in('id', ids);
      profiles = new Map(((prs ?? []) as Array<{ id: string; display_name: string | null; email: string | null }>).map((p) => [p.id, p]));
    }
  } catch { migrationMissing = true; }

  const totalBalance = wallets.reduce((s, w) => s + w.balance_cents, 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <SegmentedTabs tabs={SALES_TABS} />
      <PageHeader
        title="💰 Saldos de clientes"
        description="Acá ves cuánto saldo tiene cada cliente en tu sitio. Se acreditan automáticamente al pagar productos tipo 'Carga de saldo'."
      />

      {migrationMissing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          ⚠️ Falta correr la migración. Pegá <code className="text-xs bg-black/30 px-1.5 py-0.5 rounded">src/db/migrations/RUN_THIS_NOW.sql</code> en Supabase SQL Editor.
        </div>
      )}

      {!migrationMissing && (
        <>
          {/* ── Configuración de la moneda ── */}
          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-emerald-500/[0.06] to-transparent p-5 space-y-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h2 className="font-semibold text-sm">🪙 Moneda de la wallet</h2>
              <span className="text-[11px] text-white/50">
                Preview: <strong className="font-mono text-emerald-300">{currencySymbol} 1.500,00 {currencyLabel}</strong>
              </span>
            </div>
            <p className="text-xs text-white/60 leading-snug">
              Podés usar la moneda oficial (ARS, USD) o algo propio: <em>Créditos</em>, <em>Puntos</em>,
              <em>Coins</em>, o incluso una cripto como BTC. Se muestra en el panel del owner y en
              la página pública <code className="text-[10px] bg-black/40 px-1 rounded">/saldo</code> del cliente.
            </p>
            <form action={setWalletCurrencyAction} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end pt-1">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/45">Nombre corto</label>
                <input name="label" defaultValue={currencyLabel} maxLength={12}
                  placeholder="ARS / BTC / Créditos"
                  className="mt-1 w-full rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/45">Símbolo</label>
                <input name="symbol" defaultValue={currencySymbol} maxLength={4}
                  placeholder="$ / ₿ / ★"
                  className="mt-1 w-full rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-sm font-mono" />
              </div>
              <button type="submit"
                className="rounded bg-white text-black text-sm font-semibold px-4 py-1.5 hover:bg-white/90 h-fit">
                Guardar
              </button>
            </form>
          </div>

          {/* ── Cross-link: "Carga de saldo" como producto vendible ── */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-start gap-3 flex-wrap">
            <div className="text-2xl leading-none">🛒</div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm">Vendé "Carga de saldo" como producto</div>
              <p className="text-xs text-white/60 mt-0.5 leading-snug">
                Creá una publicación tipo "Carga de saldo": el cliente paga, se le acredita en su wallet.
                También podés regalar bonus en cualquier compra (curso, físico, etc.) desde el editor del producto.
              </p>
            </div>
            <Link href="/crear-oferta?type=topup"
              className="text-xs px-3 py-2 rounded bg-white text-black font-semibold hover:bg-white/90 whitespace-nowrap">
              + Nueva carga de saldo
            </Link>
          </div>

          {/* ── Feature flags: transferencias + retiros ── */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
            <h2 className="font-semibold text-sm">Habilitar acciones para tus clientes</h2>
            <form action={setWalletTransfersEnabledAction} className="flex items-center justify-between gap-3 py-2 border-t border-white/5">
              <input type="hidden" name="enabled" value={transfersEnabled ? 'false' : 'true'} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">↗ Permitir transferencias entre clientes</div>
                <div className="text-xs text-white/55 mt-0.5">El cliente puede enviar saldo a otro cliente por email.</div>
              </div>
              <button type="submit"
                className={`text-xs px-3 py-1.5 rounded font-semibold whitespace-nowrap ${
                  transfersEnabled
                    ? 'border border-rose-500/30 text-rose-300 hover:bg-rose-500/10'
                    : 'bg-white text-black hover:bg-white/90'
                }`}>
                {transfersEnabled ? 'Desactivar' : 'Activar'}
              </button>
            </form>
            <form action={setWalletWithdrawalsEnabledAction} className="flex items-center justify-between gap-3 py-2 border-t border-white/5">
              <input type="hidden" name="enabled" value={withdrawalsEnabled ? 'false' : 'true'} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">💸 Permitir solicitudes de retiro</div>
                <div className="text-xs text-white/55 mt-0.5">El cliente solicita retirar saldo. Vos aprobás o rechazás manualmente.</div>
              </div>
              <button type="submit"
                className={`text-xs px-3 py-1.5 rounded font-semibold whitespace-nowrap ${
                  withdrawalsEnabled
                    ? 'border border-rose-500/30 text-rose-300 hover:bg-rose-500/10'
                    : 'bg-white text-black hover:bg-white/90'
                }`}>
                {withdrawalsEnabled ? 'Desactivar' : 'Activar'}
              </button>
            </form>
          </div>

          {/* ── Modo Inversiones ── */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h2 className="font-semibold text-sm">📈 Modo Inversiones</h2>
              <span className={`text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded ${
                investmentEnabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/50'
              }`}>
                {investmentEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-xs text-white/60 leading-snug">
              Cuando está prendido, podés aplicar rendimientos periódicos al saldo de tus clientes.
              Ideal para simular plazos fijos, cuentas remuneradas o cashback recurrente.
            </p>
            <form action={setWalletInvestmentEnabledAction} className="grid sm:grid-cols-[1fr_auto_auto] gap-2 items-end pt-1">
              <input type="hidden" name="enabled" value={investmentEnabled ? 'false' : 'true'} />
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/45">Tasa sugerida por default (%)</label>
                <input name="default_rate_pct" type="number" step="0.01" min="0"
                  defaultValue={(defaultYieldRateBps / 100).toString()}
                  placeholder="5.00"
                  className="mt-1 w-full rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-sm font-mono" />
              </div>
              <button type="submit"
                className={`text-xs px-3 py-2 rounded font-semibold whitespace-nowrap h-fit ${
                  investmentEnabled
                    ? 'border border-rose-500/30 text-rose-300 hover:bg-rose-500/10'
                    : 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400'
                }`}>
                {investmentEnabled ? 'Apagar' : 'Prender'}
              </button>
              <button type="submit"
                className="text-xs px-3 py-2 rounded border border-white/15 hover:bg-white/5 whitespace-nowrap h-fit">
                Guardar tasa
              </button>
            </form>
          </div>

          {/* ── Otorgar rendimientos (solo si Modo Inversiones ON) ── */}
          {investmentEnabled && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] p-5 space-y-3">
              <h2 className="font-semibold text-sm text-emerald-100">💵 Otorgar rendimientos</h2>
              <p className="text-xs text-white/60 leading-snug">
                Aplica un % al saldo actual y lo suma a cada wallet. Ej: 5% sobre $10.000 → +$500 al saldo.
                Podés hacerlo para todos los clientes de una o para uno puntual.
              </p>
              <form action={applyWalletYieldAction} className="grid sm:grid-cols-[auto_1fr_1fr_auto] gap-2 items-end">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-white/45">Tasa (%)</label>
                  <input name="rate_pct" type="number" step="0.01" min="0" required
                    defaultValue={(defaultYieldRateBps / 100).toString()}
                    className="mt-1 w-24 rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-sm font-mono" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-white/45">Cliente</label>
                  <select name="target"
                    className="mt-1 w-full rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-sm">
                    <option value="all">Todos los clientes con saldo</option>
                    {wallets.filter((w) => w.balance_cents > 0).map((w) => {
                      const p = profiles.get(w.user_id);
                      return (
                        <option key={w.user_id} value={w.user_id}>
                          {p?.display_name || p?.email || w.user_id.slice(0, 8)}
                          {' — '}{currencySymbol} {(w.balance_cents / 100).toLocaleString('es-AR')}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-white/45">Concepto</label>
                  <input name="concept" defaultValue="Rendimiento" maxLength={60}
                    className="mt-1 w-full rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-sm" />
                </div>
                <button type="submit"
                  className="text-xs px-4 py-2 rounded bg-emerald-500 text-emerald-950 font-bold hover:bg-emerald-400 whitespace-nowrap h-fit">
                  Aplicar
                </button>
              </form>
            </div>
          )}

          {/* ── Solicitudes de retiro pendientes ── */}
          {pendingWithdrawals.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-3">
              <h2 className="font-semibold text-sm text-amber-200">
                💸 Solicitudes de retiro pendientes ({pendingWithdrawals.length})
              </h2>
              <p className="text-xs text-amber-100/70">
                El saldo del cliente ya fue debitado. Aprobá cuando le hayas pagado, o rechazá si no podés y se le devuelve.
              </p>
              <div className="space-y-2">
                {pendingWithdrawals.map((wr) => {
                  const p = profiles.get(wr.user_id);
                  return (
                    <div key={wr.id} className="rounded-lg border border-amber-500/20 bg-black/30 p-3 grid sm:grid-cols-[1fr_auto] gap-3 items-start">
                      <div className="min-w-0">
                        <div className="flex items-baseline justify-between gap-3">
                          <div className="font-semibold">{p?.display_name ?? '(sin nombre)'} <span className="font-mono text-xs text-white/45">· {p?.email}</span></div>
                          <div className="font-mono font-bold text-amber-200">{wr.currency} {(wr.amount_cents / 100).toLocaleString('es-AR')}</div>
                        </div>
                        <div className="text-xs text-white/65 mt-1">
                          {wr.method && <span><strong>Método:</strong> {wr.method}</span>}
                          {wr.destination && <span className="ml-2"><strong>Destino:</strong> <span className="font-mono">{wr.destination}</span></span>}
                        </div>
                        {wr.note && <div className="text-xs text-white/50 mt-1 italic">&quot;{wr.note}&quot;</div>}
                        <div className="text-[10px] text-white/40 mt-1">{new Date(wr.requested_at).toLocaleString('es-AR')}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <form action={approveWithdrawalAction}>
                          <input type="hidden" name="id" value={wr.id} />
                          <button type="submit" className="text-xs px-2.5 py-1.5 rounded bg-emerald-500 text-emerald-950 font-bold hover:bg-emerald-400 whitespace-nowrap">
                            ✓ Pagué
                          </button>
                        </form>
                        <form action={rejectWithdrawalAction} className="flex items-center gap-1">
                          <input type="hidden" name="id" value={wr.id} />
                          <input type="text" name="reason" placeholder="Motivo" maxLength={120}
                            className="w-24 rounded bg-white/5 border border-white/15 px-2 py-1 text-xs" />
                          <button type="submit" className="text-xs px-2 py-1.5 rounded border border-rose-500/30 text-rose-300 hover:bg-rose-500/10 whitespace-nowrap">
                            ✕ Rechazar
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-xs text-white/55 uppercase tracking-wide">Saldo total acumulado</div>
              <div className="text-2xl font-bold mt-1 font-mono">
                {currencySymbol} {(totalBalance / 100).toLocaleString('es-AR')}
                <span className="text-xs text-white/45 ml-1.5 font-sans font-normal">{currencyLabel}</span>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-xs text-white/55 uppercase tracking-wide">Clientes con saldo</div>
              <div className="text-2xl font-bold mt-1">
                {wallets.filter((w) => w.balance_cents > 0).length}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-xs text-white/55 uppercase tracking-wide">Wallets totales</div>
              <div className="text-2xl font-bold mt-1">{wallets.length}</div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#0f0f0f] text-white/50 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                  <th className="px-3 py-2 text-left">Última actividad</th>
                  <th className="px-3 py-2 text-left">Depósito · Débito · Reembolso</th>
                </tr>
              </thead>
              <tbody>
                {wallets.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-white/40">Sin wallets aún. Vendé un producto tipo "Carga de saldo" o ajustá manualmente.</td></tr>
                ) : wallets.map((w) => {
                  const p = profiles.get(w.user_id);
                  return (
                    <tr key={w.id} className="border-t border-white/5">
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{p?.display_name || '(sin nombre)'}</div>
                        <div className="text-xs text-white/45 font-mono">{p?.email}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-300">
                        {w.currency} {(w.balance_cents / 100).toLocaleString('es-AR')}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-white/55">
                        {new Date(w.updated_at).toLocaleString('es-AR')}
                      </td>
                      <td className="px-3 py-2.5">
                        <form action={adminAdjustWalletAction} className="flex items-center gap-1.5 flex-wrap">
                          <input type="hidden" name="user_id" value={w.user_id} />
                          <input type="number" name="amount" step="1" placeholder="+/- monto"
                            className="w-24 rounded bg-white/5 border border-white/15 px-2 py-1 text-xs font-mono"
                            title="Positivo = acredita. Negativo = debita." />
                          <select name="concept" defaultValue="Depósito"
                            className="rounded bg-white/5 border border-white/15 px-2 py-1 text-xs">
                            <option>Depósito</option>
                            <option>Débito</option>
                            <option>Pago</option>
                            <option>Reembolso</option>
                            <option>Ajuste</option>
                            <option>Bonificación</option>
                          </select>
                          <input type="text" name="note" maxLength={100} placeholder="Nota (opcional)"
                            className="flex-1 min-w-[100px] rounded bg-white/5 border border-white/15 px-2 py-1 text-xs" />
                          <button type="submit" className="text-xs px-2 py-1 rounded bg-white text-black font-semibold">
                            Aplicar
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {txs.length > 0 && (
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <h2 className="bg-[#0f0f0f] px-4 py-2.5 text-xs uppercase text-white/55 tracking-wide">Últimos 50 movimientos</h2>
              <table className="w-full text-xs">
                <tbody>
                  {txs.map((tx) => {
                    const p = profiles.get(tx.user_id);
                    const positive = tx.amount_cents >= 0;
                    return (
                      <tr key={tx.id} className="border-t border-white/5">
                        <td className="px-3 py-2 text-white/55 whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-3 py-2">{p?.display_name || p?.email || '—'}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-0.5">
                            {tx.concept && <span className="text-white/85 font-medium">{tx.concept}</span>}
                            <span className="text-[10px] uppercase tracking-wider text-white/45">{tx.kind}</span>
                          </div>
                        </td>
                        <td className={`px-3 py-2 text-right font-mono ${positive ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {positive ? '+' : ''}{(tx.amount_cents / 100).toLocaleString('es-AR')}
                        </td>
                        <td className="px-3 py-2 text-white/40 italic">{tx.note ?? ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
