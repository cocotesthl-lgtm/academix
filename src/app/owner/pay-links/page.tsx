import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/owner/PageHeader';
import { createPayLinkAction } from '@/lib/pay-links/actions';
import { AppSectionList } from '@/components/owner/courses/AppSectionList';
import { tenantOrigin } from '@/lib/env';

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
  revenue_cents: number;
  cover_url: string | null;
};

export default async function PayLinksPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const origin = tenantOrigin(tenant.slug);

  let rows: Row[] = [];
  let migrationMissing = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('pay_links') as any)
      .select('id, code, title, amount_cents, currency, status, uses_count, max_uses, views_count, revenue_cents, cover_url')
      .eq('tenant_id', tenant.id)
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
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <AppSectionList
            kind="paylinks"
            rows={rows.map((r) => ({
              id: r.id,
              slug: r.code,
              title: r.title,
              status: r.status,
              price_cents: r.amount_cents,
              currency: r.currency,
              cover_url: r.cover_url,
              clients: r.uses_count,
              revenue: r.revenue_cents,
              editHref: `/pay-links/${r.id}`,
              publicHref: `${origin}/pay/${r.code}`
            }))}
          />
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
