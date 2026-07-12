import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import {
  adminAdjustWalletAction,
  setWalletTransfersEnabledAction,
  setWalletWithdrawalsEnabledAction,
  setWalletInvestmentEnabledAction,
  applyWalletYieldAction,
  approveWithdrawalAction,
  rejectWithdrawalAction,
  createWalletCurrencyAction,
  updateWalletCurrencyAction,
  setDefaultWalletCurrencyAction,
  deleteWalletCurrencyAction
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

type CurrencyRow = {
  id: string;
  code: string;
  label: string;
  symbol: string;
  logo_url: string | null;
  is_default: boolean;
  position: number;
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
  let investmentEnabled = false;
  let defaultYieldRateBps = 0;
  let currencies: CurrencyRow[] = [];
  let pendingWithdrawals: Array<{
    id: string; user_id: string; amount_cents: number; currency: string;
    method: string | null; destination: string | null; note: string | null;
    requested_at: string;
  }> = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: t } = await (svc.from('tenants') as any)
      .select('wallet_transfers_enabled, wallet_withdrawals_enabled, wallet_investment_enabled, wallet_default_yield_rate_bps')
      .eq('id', tenant.id).maybeSingle();
    transfersEnabled = !!t?.wallet_transfers_enabled;
    withdrawalsEnabled = !!t?.wallet_withdrawals_enabled;
    investmentEnabled = !!t?.wallet_investment_enabled;
    if (typeof t?.wallet_default_yield_rate_bps === 'number') defaultYieldRateBps = t.wallet_default_yield_rate_bps;
  } catch { /* migration pendiente */ }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cs } = await (svc.from('wallet_currencies') as any)
      .select('id, code, label, symbol, logo_url, is_default, position')
      .eq('tenant_id', tenant.id).order('position');
    currencies = (cs ?? []) as CurrencyRow[];
  } catch { /* migration 0063 pendiente */ }
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

  // Lookup por code (case-insensitive). Fallback si la wallet apunta a
  // una currency que ya no existe en la config.
  const currencyByCode = new Map<string, CurrencyRow>();
  for (const c of currencies) currencyByCode.set(c.code.toLowerCase(), c);
  function currencyOf(code: string): { symbol: string; label: string; logo_url: string | null } {
    const c = currencyByCode.get((code || '').toLowerCase());
    return c ? { symbol: c.symbol, label: c.label, logo_url: c.logo_url } : { symbol: '$', label: code || 'ARS', logo_url: null };
  }
  const defaultCurrency = currencies.find((c) => c.is_default) ?? currencies[0];
  const defaultCode = defaultCurrency?.code ?? 'ars';

  // Totales por moneda
  const totalsByCurrency = new Map<string, number>();
  for (const w of wallets) {
    const key = (w.currency || 'ARS').toLowerCase();
    totalsByCurrency.set(key, (totalsByCurrency.get(key) ?? 0) + w.balance_cents);
  }

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
          {/* ── Monedas (multi-currency) ── */}
          <div className="rounded-xl border border-white/10 bg-gradient-to-br from-emerald-500/[0.06] to-transparent p-5 space-y-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h2 className="font-semibold text-sm">🪙 Monedas de la wallet</h2>
              <span className="text-[11px] text-white/50">
                Cada cliente tiene un saldo POR moneda.
              </span>
            </div>
            <p className="text-xs text-white/60 leading-snug">
              Podés tener varias monedas activas: la oficial (ARS, USD), cripto (BTC, LTC), o algo custom
              (Robux, Puntos, Créditos). Cada una con su símbolo y logo opcional.
            </p>

            {/* Lista actual */}
            {currencies.length > 0 && (
              <div className="space-y-1.5">
                {currencies.map((c) => (
                  <details key={c.id} className="rounded-lg border border-white/10 bg-black/20">
                    <summary className="flex items-center gap-3 px-3 py-2 cursor-pointer list-none">
                      {c.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.logo_url} alt={c.label}
                          className="w-6 h-6 rounded object-cover bg-white/10 shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-xs font-mono shrink-0">
                          {c.symbol}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{c.label}</div>
                        <div className="text-[10px] text-white/40 font-mono">{c.code} · {c.symbol}</div>
                      </div>
                      {c.is_default && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                          Default
                        </span>
                      )}
                      <span className="text-white/30 text-xs">▾</span>
                    </summary>
                    <div className="px-3 pb-3 pt-2 border-t border-white/5 space-y-2">
                      <form action={updateWalletCurrencyAction} className="grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                        <input type="hidden" name="id" value={c.id} />
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-white/45">Nombre</label>
                          <input name="label" defaultValue={c.label} maxLength={40}
                            className="mt-1 w-full rounded bg-white/5 border border-white/15 px-2 py-1 text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-white/45">Símbolo</label>
                          <input name="symbol" defaultValue={c.symbol} maxLength={6}
                            className="mt-1 w-full rounded bg-white/5 border border-white/15 px-2 py-1 text-xs font-mono" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-wider text-white/45">Logo URL (opcional)</label>
                          <input name="logo_url" defaultValue={c.logo_url ?? ''} maxLength={500}
                            placeholder="https://…" type="url"
                            className="mt-1 w-full rounded bg-white/5 border border-white/15 px-2 py-1 text-xs" />
                        </div>
                        <button type="submit"
                          className="rounded bg-white text-black text-xs font-semibold px-3 py-1.5 hover:bg-white/90 h-fit">
                          Guardar
                        </button>
                      </form>
                      <div className="flex items-center gap-1.5 pt-1">
                        {!c.is_default && (
                          <>
                            <form action={setDefaultWalletCurrencyAction}>
                              <input type="hidden" name="id" value={c.id} />
                              <button className="text-[11px] px-2 py-1 rounded border border-white/15 hover:bg-white/5">
                                Marcar como default
                              </button>
                            </form>
                            {currencies.length > 1 && (
                              <form action={deleteWalletCurrencyAction}>
                                <input type="hidden" name="id" value={c.id} />
                                <button className="text-[11px] px-2 py-1 rounded border border-rose-500/30 text-rose-300 hover:bg-rose-500/10">
                                  Eliminar
                                </button>
                              </form>
                            )}
                          </>
                        )}
                        <span className="text-[10px] text-white/40 ml-auto">
                          code: <code className="font-mono bg-black/40 px-1 rounded">{c.code}</code>
                        </span>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            )}

            {/* Form agregar */}
            <form action={createWalletCurrencyAction} className="grid sm:grid-cols-[1fr_auto_1fr_auto] gap-2 items-end pt-2 border-t border-white/5">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/45">Nueva moneda</label>
                <input name="label" required maxLength={40}
                  placeholder="Robux / Litecoin / Créditos…"
                  className="mt-1 w-full rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-sm" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/45">Símbolo</label>
                <input name="symbol" maxLength={6} defaultValue="$"
                  className="mt-1 w-20 rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-sm font-mono" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-white/45">Logo URL (opcional)</label>
                <input name="logo_url" maxLength={500} type="url" placeholder="https://…"
                  className="mt-1 w-full rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-sm" />
              </div>
              <button type="submit"
                className="rounded bg-white text-black text-sm font-semibold px-4 py-1.5 hover:bg-white/90 h-fit">
                + Agregar
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
              <form action={applyWalletYieldAction} className="grid sm:grid-cols-[auto_auto_1fr_1fr_auto] gap-2 items-end">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-white/45">Tasa (%)</label>
                  <input name="rate_pct" type="number" step="0.01" min="0" required
                    defaultValue={(defaultYieldRateBps / 100).toString()}
                    className="mt-1 w-24 rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-sm font-mono" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-white/45">Moneda</label>
                  <select name="currency" defaultValue={defaultCode}
                    className="mt-1 rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-sm">
                    {currencies.map((c) => (
                      <option key={c.id} value={c.code}>{c.symbol} {c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-white/45">Cliente</label>
                  <select name="target"
                    className="mt-1 w-full rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-sm">
                    <option value="all">Todos los clientes con saldo (de la moneda elegida)</option>
                    {wallets.filter((w) => w.balance_cents > 0).map((w) => {
                      const p = profiles.get(w.user_id);
                      const cur = currencyOf(w.currency);
                      return (
                        <option key={`${w.user_id}-${w.currency}`} value={w.user_id}>
                          {p?.display_name || p?.email || w.user_id.slice(0, 8)}
                          {' — '}{cur.symbol} {(w.balance_cents / 100).toLocaleString('es-AR')} {cur.label}
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

          <div className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="text-xs text-white/55 uppercase tracking-wide">Clientes con saldo</div>
                <div className="text-2xl font-bold mt-1">
                  {new Set(wallets.filter((w) => w.balance_cents > 0).map((w) => w.user_id)).size}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="text-xs text-white/55 uppercase tracking-wide">Wallets totales</div>
                <div className="text-2xl font-bold mt-1">{wallets.length}</div>
              </div>
            </div>
            {/* Totales por moneda */}
            {totalsByCurrency.size > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="text-xs text-white/55 uppercase tracking-wide mb-2">Saldo acumulado por moneda</div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {Array.from(totalsByCurrency.entries()).map(([code, total]) => {
                    const cur = currencyOf(code);
                    return (
                      <div key={code} className="flex items-center gap-2 rounded border border-white/5 bg-black/20 px-3 py-2">
                        {cur.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cur.logo_url} alt={cur.label} className="w-7 h-7 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded bg-white/10 flex items-center justify-center text-xs font-mono shrink-0">{cur.symbol}</div>
                        )}
                        <div className="min-w-0">
                          <div className="text-lg font-bold font-mono leading-tight">
                            {cur.symbol} {(total / 100).toLocaleString('es-AR')}
                          </div>
                          <div className="text-[10px] text-white/45 uppercase tracking-wider">{cur.label}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
                  const cur = currencyOf(w.currency);
                  return (
                    <tr key={w.id} className="border-t border-white/5">
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{p?.display_name || '(sin nombre)'}</div>
                        <div className="text-xs text-white/45 font-mono">{p?.email}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {cur.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={cur.logo_url} alt={cur.label} className="w-4 h-4 rounded object-cover" />
                          ) : null}
                          <span className="font-mono font-bold text-emerald-300">
                            {cur.symbol} {(w.balance_cents / 100).toLocaleString('es-AR')}
                          </span>
                          <span className="text-[10px] text-white/45">{cur.label}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-white/55">
                        {new Date(w.updated_at).toLocaleString('es-AR')}
                      </td>
                      <td className="px-3 py-2.5">
                        <form action={adminAdjustWalletAction} className="flex items-center gap-1.5 flex-wrap">
                          <input type="hidden" name="user_id" value={w.user_id} />
                          <input type="hidden" name="currency" value={w.currency} />
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
