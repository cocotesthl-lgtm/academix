import { requireSuperAdmin } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { founderAdjustWalletAction } from '@/lib/wallets/founder-actions';

export const dynamic = 'force-dynamic';

type WalletRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  balance_cents: number;
  currency: string;
  updated_at: string;
};

type TxRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  amount_cents: number;
  kind: string;
  note: string | null;
  created_at: string;
};

export default async function FounderWalletsPage() {
  await requireSuperAdmin();
  const svc = getServiceClient();

  let migrationMissing = false;
  let wallets: WalletRow[] = [];
  let txs: TxRow[] = [];
  let tenants = new Map<string, { name: string; slug: string }>();
  let profiles = new Map<string, { display_name: string | null; email: string | null }>();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ws, error } = await (svc.from('wallets') as any)
      .select('id, tenant_id, user_id, balance_cents, currency, updated_at')
      .order('balance_cents', { ascending: false }).limit(500);
    if (error?.message?.includes('does not exist')) migrationMissing = true;
    wallets = (ws ?? []) as WalletRow[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: t } = await (svc.from('wallet_transactions') as any)
      .select('id, tenant_id, user_id, amount_cents, kind, note, created_at')
      .order('created_at', { ascending: false }).limit(100);
    txs = (t ?? []) as TxRow[];

    const tenantIds = Array.from(new Set([...wallets.map((w) => w.tenant_id), ...txs.map((x) => x.tenant_id)]));
    const userIds = Array.from(new Set([...wallets.map((w) => w.user_id), ...txs.map((x) => x.user_id)]));
    if (tenantIds.length > 0) {
      const { data: ts } = await svc.from('tenants').select('id, name, slug').in('id', tenantIds);
      tenants = new Map(((ts ?? []) as Array<{ id: string; name: string; slug: string }>).map((t) => [t.id, t]));
    }
    if (userIds.length > 0) {
      const { data: prs } = await svc.from('profiles').select('id, display_name, email').in('id', userIds);
      profiles = new Map(((prs ?? []) as Array<{ id: string; display_name: string | null; email: string | null }>).map((p) => [p.id, p]));
    }
  } catch { migrationMissing = true; }

  const totalAcrossTenants = wallets.reduce((s, w) => s + w.balance_cents, 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">💰 Wallets de la plataforma</h1>
        <p className="text-sm text-white/55 mt-1">
          Todos los saldos de todos los tenants. Podés acreditar o descontar manualmente.
        </p>
      </div>

      {migrationMissing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          ⚠️ Falta correr la migración 0041 en Supabase.
        </div>
      )}

      {!migrationMissing && (
        <>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-xs text-white/55 uppercase tracking-wide">Saldo total (todos los tenants)</div>
              <div className="text-2xl font-bold mt-1 font-mono">
                $ {(totalAcrossTenants / 100).toLocaleString('es-AR')}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-xs text-white/55 uppercase tracking-wide">Wallets activas (saldo &gt; 0)</div>
              <div className="text-2xl font-bold mt-1">
                {wallets.filter((w) => w.balance_cents > 0).length}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-xs text-white/55 uppercase tracking-wide">Tenants con wallets</div>
              <div className="text-2xl font-bold mt-1">
                {new Set(wallets.map((w) => w.tenant_id)).size}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#0f0f0f] text-white/50 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Tenant</th>
                  <th className="px-3 py-2 text-left">Cliente</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                  <th className="px-3 py-2 text-left">Ajustar</th>
                </tr>
              </thead>
              <tbody>
                {wallets.length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-white/40">Sin wallets en la plataforma.</td></tr>
                ) : wallets.map((w) => {
                  const t = tenants.get(w.tenant_id);
                  const p = profiles.get(w.user_id);
                  return (
                    <tr key={w.id} className="border-t border-white/5">
                      <td className="px-3 py-2.5">
                        <div className="text-xs text-white/55 font-mono">{t?.slug ?? '—'}</div>
                        <div className="text-sm">{t?.name ?? '—'}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{p?.display_name || '(sin nombre)'}</div>
                        <div className="text-xs text-white/45 font-mono">{p?.email}</div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-300">
                        {w.currency} {(w.balance_cents / 100).toLocaleString('es-AR')}
                      </td>
                      <td className="px-3 py-2.5">
                        <form action={founderAdjustWalletAction} className="flex items-center gap-1.5">
                          <input type="hidden" name="tenant_id" value={w.tenant_id} />
                          <input type="hidden" name="user_id" value={w.user_id} />
                          <input type="number" name="amount" step="1" placeholder="$ +/-"
                            className="w-20 rounded bg-white/5 border border-white/15 px-2 py-1 text-xs font-mono" />
                          <input type="text" name="note" maxLength={100} placeholder="Motivo"
                            className="flex-1 rounded bg-white/5 border border-white/15 px-2 py-1 text-xs" />
                          <button type="submit" className="text-xs px-2 py-1 rounded bg-amber-500 text-amber-950 font-bold">
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
              <h2 className="bg-[#0f0f0f] px-4 py-2.5 text-xs uppercase text-white/55 tracking-wide">
                Últimos 100 movimientos (todos los tenants)
              </h2>
              <table className="w-full text-xs">
                <tbody>
                  {txs.map((tx) => {
                    const t = tenants.get(tx.tenant_id);
                    const p = profiles.get(tx.user_id);
                    const positive = tx.amount_cents >= 0;
                    return (
                      <tr key={tx.id} className="border-t border-white/5">
                        <td className="px-3 py-2 text-white/55 whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-3 py-2 text-white/60 font-mono">{t?.slug ?? '—'}</td>
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
