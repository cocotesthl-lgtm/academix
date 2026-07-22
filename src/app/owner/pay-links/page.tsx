import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/owner/PageHeader';
import { createPayLinkAction } from '@/lib/pay-links/actions';

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  code: string;
  title: string;
  amount_cents: number;
  currency: string;
  status: 'active' | 'paused' | 'expired' | 'used_up';
  uses_count: number;
  max_uses: number | null;
  views_count: number;
  clicks_count: number;
  revenue_cents: number;
  allow_affiliates: boolean;
  expires_at: string | null;
  created_at: string;
  creator_role: string;
};

export default async function PayLinksPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  let rows: Row[] = [];
  let migrationMissing = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('pay_links') as any)
      .select('id, code, title, amount_cents, currency, status, uses_count, max_uses, views_count, clicks_count, revenue_cents, allow_affiliates, expires_at, created_at, creator_role')
      .eq('tenant_id', tenant.id)
      // El owner ve sólo los suyos y de su staff, no las variantes de afiliados
      .is('parent_link_id', null)
      .order('created_at', { ascending: false });
    if (error) migrationMissing = true;
    else rows = (data ?? []) as Row[];
  } catch { migrationMissing = true; }

  if (migrationMissing) {
    return (
      <div className="space-y-4 max-w-2xl">
        <PageHeader title="Links de pago" />
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-200">
          <p className="font-semibold mb-2">⚠️ Migración pendiente</p>
          <p className="text-sm">Corré la migración <code className="font-mono">0084_payment_links.sql</code> en Supabase para activar la app.</p>
        </div>
      </div>
    );
  }

  const totalRevenue = rows.reduce((s, r) => s + Number(r.revenue_cents), 0);
  const totalUses = rows.reduce((s, r) => s + r.uses_count, 0);
  const activeCount = rows.filter((r) => r.status === 'active').length;

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="🔗 Links de pago"
        description="Cobrá por WhatsApp / mail / DM con una URL corta. Sin crear cursos ni productos."
        actions={
          <form action={createPayLinkAction}>
            <button className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
              + Nuevo link
            </button>
          </form>
        }
      />

      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Links activos" value={String(activeCount)} />
          <Stat label="Links totales" value={String(rows.length)} />
          <Stat label="Pagos recibidos" value={String(totalUses)} />
          <Stat label="Recaudado" value={`${(totalRevenue / 100).toLocaleString('es-AR')} ${rows[0]?.currency ?? 'ARS'}`} />
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center">
          <div className="text-4xl mb-2">🔗</div>
          <div className="text-white/70 font-medium">Aún no creaste ningún link de pago</div>
          <p className="text-xs text-white/45 mt-1 mb-4 max-w-md mx-auto">
            Ideal para servicios one-shot, adelantos, propinas, cualquier monto que quieras cobrar sin subir un producto.
          </p>
          <form action={createPayLinkAction}>
            <button className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
              + Crear el primero
            </button>
          </form>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 divide-y divide-white/5 overflow-hidden">
          {rows.map((r) => (
            <Link key={r.id} href={`/owner/pay-links/${r.id}`}
              className="grid grid-cols-12 gap-3 items-center px-4 py-3 hover:bg-white/[0.03] transition">
              <div className="col-span-12 sm:col-span-5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium text-sm truncate">{r.title}</div>
                  <StatusChip s={r.status} />
                  {r.allow_affiliates && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-300 border border-orange-500/30">
                      afiliados
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/40 mt-0.5 font-mono truncate">
                  /pay/{r.code}
                  {r.expires_at && <span className="ml-2 text-amber-300/60">
                    vence {new Date(r.expires_at).toLocaleDateString('es-AR')}
                  </span>}
                </div>
              </div>
              <div className="col-span-4 sm:col-span-2 text-sm">
                {(r.amount_cents / 100).toLocaleString('es-AR')} <span className="text-white/40 text-xs">{r.currency}</span>
              </div>
              <div className="col-span-4 sm:col-span-2 text-xs text-white/60">
                {r.uses_count}{r.max_uses ? ` / ${r.max_uses}` : ''} pagos
              </div>
              <div className="col-span-4 sm:col-span-3 text-xs text-white/60 text-right">
                <span className="text-emerald-300 font-mono">
                  {r.revenue_cents > 0 ? `$${(r.revenue_cents / 100).toLocaleString('es-AR')}` : '—'}
                </span>
                <span className="text-white/30 ml-2">
                  {r.views_count} vistas
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/45">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
    </div>
  );
}

function StatusChip({ s }: { s: Row['status'] }) {
  const map: Record<Row['status'], string> = {
    active: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    paused: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    expired: 'border-white/15 text-white/40',
    used_up: 'border-white/15 text-white/40'
  };
  const labels: Record<Row['status'], string> = {
    active: 'activo', paused: 'pausado', expired: 'vencido', used_up: 'agotado'
  };
  return <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${map[s]}`}>{labels[s]}</span>;
}
