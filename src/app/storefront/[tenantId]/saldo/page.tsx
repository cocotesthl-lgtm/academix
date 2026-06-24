import { notFound, redirect } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { WalletActions } from '@/components/storefront/WalletActions';

export const dynamic = 'force-dynamic';

type TxRow = {
  id: string;
  amount_cents: number;
  balance_after_cents: number;
  kind: string;
  note: string | null;
  created_at: string;
};

export default async function SaldoPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();
  const primary = tenant.brand?.primary_color ?? '#0a0a0a';

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/saldo');

  const svc = getServiceClient();
  let balance = 0;
  let currency = 'ARS';
  let txs: TxRow[] = [];
  let walletExists = false;
  let transfersEnabled = false;
  let withdrawalsEnabled = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: t } = await (svc.from('tenants') as any)
      .select('wallet_transfers_enabled, wallet_withdrawals_enabled').eq('id', tenantId).maybeSingle();
    transfersEnabled = !!t?.wallet_transfers_enabled;
    withdrawalsEnabled = !!t?.wallet_withdrawals_enabled;
  } catch { /* migration 0042 pendiente */ }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: w } = await (svc.from('wallets') as any)
      .select('balance_cents, currency').eq('tenant_id', tenantId).eq('user_id', user.id).maybeSingle();
    if (w) { walletExists = true; balance = w.balance_cents; currency = w.currency; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: t } = await (svc.from('wallet_transactions') as any)
      .select('id, amount_cents, balance_after_cents, kind, note, created_at')
      .eq('tenant_id', tenantId).eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
    txs = (t ?? []) as TxRow[];
  } catch { /* migration pendiente — sin wallet */ }

  return (
    <article className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mi saldo</h1>
        <p className="text-black/55 text-sm mt-1">En {tenant.name}</p>
      </div>

      <div className="rounded-2xl p-8 text-center text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${primary}, ${primary}dd)` }}>
        <div className="text-xs uppercase tracking-widest opacity-80">Saldo disponible</div>
        <div className="text-5xl font-bold mt-2 font-mono">
          {currency} {(balance / 100).toLocaleString('es-AR')}
        </div>
        {!walletExists && (
          <p className="text-xs mt-3 opacity-70">No tenés saldo todavía. Cargá comprando un producto de tipo &quot;Carga de saldo&quot;.</p>
        )}
      </div>

      <WalletActions
        tenantId={tenantId}
        balanceCents={balance}
        currency={currency}
        transfersEnabled={transfersEnabled}
        withdrawalsEnabled={withdrawalsEnabled}
        primary={primary}
      />

      <div className="rounded-2xl border border-black/10 overflow-hidden">
        <h2 className="bg-black/[0.03] px-4 py-3 text-sm font-semibold">Historial de movimientos</h2>
        {txs.length === 0 ? (
          <div className="p-6 text-sm text-black/40 text-center">Sin movimientos.</div>
        ) : (
          <ul className="divide-y divide-black/5">
            {txs.map((tx) => {
              const positive = tx.amount_cents >= 0;
              const label = ({
                topup: '⬆ Carga',
                spend: '⬇ Consumo',
                refund: '↩ Reintegro',
                admin_adjust: '⚙ Ajuste manual'
              } as Record<string, string>)[tx.kind] ?? tx.kind;
              return (
                <li key={tx.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{label}</div>
                    {tx.note && <div className="text-xs text-black/55 truncate">{tx.note}</div>}
                    <div className="text-[10px] text-black/40 mt-0.5">
                      {new Date(tx.created_at).toLocaleString('es-AR')}
                    </div>
                  </div>
                  <div className={`font-mono font-bold text-sm ${positive ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {positive ? '+' : ''}{(tx.amount_cents / 100).toLocaleString('es-AR')}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </article>
  );
}
