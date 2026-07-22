import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { getTenantModules } from '@/lib/modules/queries';
import {
  updatePayLinkAction,
  togglePayLinkStatusAction,
  deletePayLinkAction
} from '@/lib/pay-links/actions';
import { CopyLinkButton } from '@/components/owner/pay-links/CopyLinkButton';
import { tenantOrigin } from '@/lib/env';

export const dynamic = 'force-dynamic';

type LinkRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  require_email: boolean;
  require_name: boolean;
  require_phone: boolean;
  require_dni: boolean;
  custom_note: string | null;
  allow_affiliates: boolean;
  affiliate_commission_pct: number | null;
  views_count: number;
  clicks_count: number;
  revenue_cents: number;
};

type Payment = {
  id: string;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  paid_at: string | null;
  created_at: string;
  affiliate_user_id: string | null;
  affiliate_commission_cents: number;
};

export default async function PayLinkEditPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const modules = await getTenantModules(tenant.id);
  const affiliatesOn = modules.affiliates !== false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: link } = await (svc.from('pay_links') as any)
    .select('id, code, title, description, cover_url, amount_cents, currency, status, max_uses, uses_count, expires_at, require_email, require_name, require_phone, require_dni, custom_note, allow_affiliates, affiliate_commission_pct, views_count, clicks_count, revenue_cents')
    .eq('id', id).eq('tenant_id', tenant.id).maybeSingle();
  if (!link) notFound();
  const l = link as LinkRow;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: paymentsRaw } = await (svc.from('pay_link_payments') as any)
    .select('id, buyer_name, buyer_email, buyer_phone, amount_cents, currency, status, paid_at, created_at, affiliate_user_id, affiliate_commission_cents')
    .eq('tenant_id', tenant.id).eq('pay_link_id', id)
    .order('created_at', { ascending: false }).limit(50);
  const payments = (paymentsRaw ?? []) as Payment[];

  const shareUrl = `${tenantOrigin(tenant.slug)}/pay/${l.code}`;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/owner/pay-links" className="text-xs text-white/50 hover:text-white/80">
          ← Volver a links
        </Link>
        <h1 className="text-2xl font-bold mt-1">🔗 {l.title}</h1>
        <div className="text-xs text-white/50 mt-1 font-mono">/pay/{l.code}</div>
      </div>

      {/* Share bar */}
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px]">
          <div className="text-[10px] uppercase tracking-wider text-emerald-300/70 mb-0.5">Compartí este link</div>
          <div className="font-mono text-sm text-emerald-100 truncate">{shareUrl}</div>
        </div>
        <CopyLinkButton url={shareUrl} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Vistas" value={String(l.views_count)} />
        <Stat label="Clicks al pagar" value={String(l.clicks_count)} />
        <Stat label="Pagos exitosos" value={`${l.uses_count}${l.max_uses ? ` / ${l.max_uses}` : ''}`} />
        <Stat label="Recaudado" value={`${(l.revenue_cents / 100).toLocaleString('es-AR')} ${l.currency}`} />
      </div>

      {/* Editor */}
      <form action={updatePayLinkAction} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
        <input type="hidden" name="id" value={l.id} />
        <h2 className="font-semibold">Detalles</h2>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="col-span-full">
            <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1">Título</div>
            <input name="title" defaultValue={l.title} maxLength={120} required
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </label>

          <label className="col-span-full">
            <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1">Descripción</div>
            <textarea name="description" defaultValue={l.description ?? ''} rows={2} maxLength={1000}
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm resize-y" />
          </label>

          <label>
            <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1">URL de imagen (opcional)</div>
            <input name="cover_url" type="url" defaultValue={l.cover_url ?? ''}
              placeholder="https://..."
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </label>

          <label>
            <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1">Nota personalizada (visible al buyer)</div>
            <input name="custom_note" defaultValue={l.custom_note ?? ''} maxLength={500}
              placeholder="Ej. Entrega en 24h por WhatsApp"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </label>

          <label>
            <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1">Monto</div>
            <input name="amount" defaultValue={(l.amount_cents / 100).toString()} required
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </label>

          <label>
            <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1">Moneda</div>
            <select name="currency" defaultValue={l.currency}
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
              <option value="BRL">BRL</option>
              <option value="MXN">MXN</option>
              <option value="COP">COP</option>
              <option value="CLP">CLP</option>
              <option value="PEN">PEN</option>
              <option value="UYU">UYU</option>
            </select>
          </label>

          <label>
            <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1">Cupo máximo (opcional)</div>
            <input name="max_uses" type="number" min="1" defaultValue={l.max_uses ?? ''}
              placeholder="Ilimitado"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </label>

          <label>
            <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1">Vence (opcional)</div>
            <input name="expires_at" type="datetime-local" defaultValue={l.expires_at ? l.expires_at.slice(0, 16) : ''}
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </label>
        </div>

        {/* Buyer fields */}
        <div>
          <div className="text-[11px] uppercase tracking-wider text-white/50 mb-2">Datos que se le piden al buyer</div>
          <div className="flex flex-wrap gap-4">
            <Check name="require_name" label="Nombre" defaultChecked={l.require_name} />
            <Check name="require_email" label="Email" defaultChecked={l.require_email} />
            <Check name="require_phone" label="Teléfono" defaultChecked={l.require_phone} />
            <Check name="require_dni" label="DNI" defaultChecked={l.require_dni} />
          </div>
        </div>

        {/* Affiliates block */}
        <div className={`rounded-lg border p-4 ${affiliatesOn ? 'border-orange-500/25 bg-orange-500/[0.03]' : 'border-white/10 bg-white/[0.02] opacity-70'}`}>
          <div className="text-[11px] uppercase tracking-wider text-white/50 mb-2">Afiliados</div>
          {affiliatesOn ? (
            <>
              <Check name="allow_affiliates" label="Permitir que afiliados promocionen este link" defaultChecked={l.allow_affiliates} />
              <label className="block mt-3 max-w-xs">
                <div className="text-[10px] uppercase tracking-wider text-white/45 mb-1">Comisión al afiliado (%)</div>
                <input name="affiliate_commission_pct" type="number" step="0.01" min="0" max="100"
                  defaultValue={l.affiliate_commission_pct ?? ''}
                  placeholder="Usa el % global del tenant si vacío"
                  className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
              </label>
            </>
          ) : (
            <div className="text-xs text-white/50">
              La app <strong className="text-white/70">Afiliados</strong> está desactivada.
              Prendela en <Link href="/owner/modulos" className="underline">Apps</Link> para que
              tus afiliados puedan compartir este link con su ref.
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
          <button className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
            Guardar cambios
          </button>
          <a href={shareUrl} target="_blank" rel="noopener"
            className="text-sm px-3 py-2 rounded border border-white/15 hover:bg-white/5">
            Ver página pública →
          </a>
        </div>
      </form>

      {/* Status & delete */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
        <h2 className="font-semibold">Estado</h2>
        <div className="flex flex-wrap gap-2 items-center">
          <form action={togglePayLinkStatusAction}>
            <input type="hidden" name="id" value={l.id} />
            <input type="hidden" name="next_status" value={l.status === 'active' ? 'paused' : 'active'} />
            <button className={`text-sm px-3 py-1.5 rounded border ${
              l.status === 'active'
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
            }`}>
              {l.status === 'active' ? '⏸️ Pausar' : '▶️ Reactivar'}
            </button>
          </form>
          <form action={deletePayLinkAction}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {...({ onSubmit: undefined } as any)}
          >
            <input type="hidden" name="id" value={l.id} />
            <button className="text-sm px-3 py-1.5 rounded border border-rose-500/30 text-rose-300 hover:bg-rose-500/10">
              🗑️ Eliminar link
            </button>
          </form>
        </div>
        <p className="text-[11px] text-white/45">
          Pausar: el link deja de aceptar pagos nuevos pero no se borra. Eliminar: se pierden los pagos históricos asociados.
        </p>
      </div>

      {/* Payments */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="font-semibold mb-3">Pagos recibidos ({payments.length})</h2>
        {payments.length === 0 ? (
          <p className="text-xs text-white/40">Sin pagos todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-white/45 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left py-2">Fecha</th>
                  <th className="text-left py-2">Buyer</th>
                  <th className="text-right py-2">Monto</th>
                  <th className="text-left py-2">Estado</th>
                  <th className="text-right py-2">Comisión afiliado</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-white/5">
                    <td className="py-2 text-white/60">{new Date(p.paid_at ?? p.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="py-2">{p.buyer_name || p.buyer_email || '—'}</td>
                    <td className="py-2 text-right font-mono">{(p.amount_cents / 100).toLocaleString('es-AR')} {p.currency}</td>
                    <td className="py-2"><PayStatusChip s={p.status} /></td>
                    <td className="py-2 text-right text-orange-300 font-mono">
                      {p.affiliate_user_id && p.affiliate_commission_cents > 0
                        ? `$${(p.affiliate_commission_cents / 100).toLocaleString('es-AR')}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
      <input type="checkbox" name={name} defaultChecked={defaultChecked}
        className="w-4 h-4 rounded border-white/20 bg-white/10" />
      <span>{label}</span>
    </label>
  );
}

function PayStatusChip({ s }: { s: string }) {
  const map: Record<string, string> = {
    paid: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    failed: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
    refunded: 'border-white/15 text-white/40'
  };
  return <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${map[s] ?? 'border-white/15'}`}>{s}</span>;
}
