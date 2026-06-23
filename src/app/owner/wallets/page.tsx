import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { adminAdjustWalletAction } from '@/lib/wallets/actions';
import { PageHeader } from '@/components/owner/PageHeader';

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

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ws, error } = await (svc.from('wallets') as any)
      .select('id, user_id, balance_cents, currency, updated_at')
      .eq('tenant_id', tenant.id).order('balance_cents', { ascending: false });
    if (error?.message?.includes('does not exist')) migrationMissing = true;
    wallets = (ws ?? []) as WalletRow[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: t } = await (svc.from('wallet_transactions') as any)
      .select('id, user_id, amount_cents, balance_after_cents, kind, note, created_at')
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
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-xs text-white/55 uppercase tracking-wide">Saldo total acumulado</div>
              <div className="text-2xl font-bold mt-1 font-mono">
                $ {(totalBalance / 100).toLocaleString('es-AR')}
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
                  <th className="px-3 py-2 text-left">Ajustar manual</th>
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
                        <form action={adminAdjustWalletAction} className="flex items-center gap-1.5">
                          <input type="hidden" name="user_id" value={w.user_id} />
                          <input type="number" name="amount" step="1" placeholder="$ +/-"
                            className="w-20 rounded bg-white/5 border border-white/15 px-2 py-1 text-xs font-mono" />
                          <input type="text" name="note" maxLength={100} placeholder="Motivo"
                            className="flex-1 rounded bg-white/5 border border-white/15 px-2 py-1 text-xs" />
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
                          <span className="text-[10px] uppercase tracking-wider bg-white/10 px-1.5 py-0.5 rounded">{tx.kind}</span>
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
