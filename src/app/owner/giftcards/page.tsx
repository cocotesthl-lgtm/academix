import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/owner/PageHeader';
import { GiftCardsCreator } from '@/components/owner/giftcards/GiftCardsCreator';
import { relativeTime } from '@/lib/time';
import type { GiftCard } from '@/lib/giftcards/actions';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:    { label: 'activa',     color: 'bg-emerald-500/15 text-emerald-300' },
  redeemed:  { label: 'canjeada',   color: 'bg-blue-500/15 text-blue-300' },
  expired:   { label: 'expirada',   color: 'bg-white/10 text-white/50' },
  cancelled: { label: 'cancelada',  color: 'bg-rose-500/15 text-rose-300' }
};

function formatMoney(cents: number, currency = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency, maximumFractionDigits: 0
  }).format(cents / 100);
}

export default async function GiftCardsListPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('gift_cards') as any)
    .select('*').eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false }).limit(500);
  const rows = (data ?? []) as GiftCard[];

  const active = rows.filter((r) => r.status === 'active').length;
  const redeemed = rows.filter((r) => r.status === 'redeemed').length;
  const activeValue = rows
    .filter((r) => r.status === 'active').reduce((s, r) => s + r.amount_cents, 0);
  const redeemedValue = rows
    .filter((r) => r.status === 'redeemed').reduce((s, r) => s + r.amount_cents, 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Gift cards"
        description="Vendé tarjetas de regalo con un valor prefijado. El comprador se lleva un QR — al escanearlo, el destinatario aplica el crédito en su próxima compra."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Metric label="Emitidas" value={String(rows.length)} />
        <Metric label="Activas" value={String(active)} accent="emerald" />
        <Metric label="Canjeadas" value={String(redeemed)} accent="blue" />
        <Metric label="Ingresos por canje" value={formatMoney(redeemedValue)} />
      </div>

      <GiftCardsCreator />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center">
          <div className="text-4xl mb-2">🎁</div>
          <div className="text-white/70 font-medium">Todavía no emitiste ninguna gift card</div>
          <p className="text-xs text-white/45 mt-1">
            Creá una arriba con monto + fecha de expiración opcional. Vas a poder descargar el QR listo para pegar en tu diseño de Canva.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 divide-y divide-white/5 overflow-hidden">
          {rows.map((c) => {
            const st = STATUS_LABEL[c.status] ?? { label: c.status, color: 'bg-white/10' };
            const expired = c.expires_at && new Date(c.expires_at) < new Date();
            return (
              <Link key={c.id} href={`/giftcards/${c.id}`}
                className="flex items-center gap-4 p-4 hover:bg-white/[0.03] transition">
                <div className="w-10 h-10 rounded bg-gradient-to-br from-amber-500/20 to-rose-500/20 flex items-center justify-center text-lg shrink-0">
                  🎁
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-bold">{c.code}</span>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${st.color}`}>
                      {st.label}
                    </span>
                    {c.recipient_name && (
                      <span className="text-xs text-white/50">Para: {c.recipient_name}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/45 mt-0.5">
                    Creada {relativeTime(c.created_at)}
                    {c.expires_at && (
                      <> · {expired ? '⚠️ Expiró' : `Válida hasta ${new Date(c.expires_at).toLocaleDateString('es-AR')}`}</>
                    )}
                    {c.status === 'redeemed' && c.redeemed_by_email && (
                      <> · canjeada por {c.redeemed_by_email}</>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold">{formatMoney(c.amount_cents, c.currency)}</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-white/40 text-center">
        Cards activas retenidas: {formatMoney(activeValue)} — plata que "debés" a quien las tenga.
      </p>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: 'emerald' | 'blue' }) {
  const c = accent === 'emerald' ? 'text-emerald-300'
    : accent === 'blue' ? 'text-blue-300' : '';
  return (
    <div className="rounded-lg border border-white/10 p-4">
      <div className="text-[10px] uppercase tracking-wider text-white/45 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${c}`}>{value}</div>
    </div>
  );
}
