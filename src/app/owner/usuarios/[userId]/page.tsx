import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/owner/PageHeader';

export const dynamic = 'force-dynamic';

/**
 * /owner/usuarios/[userId] — Ficha detallada del cliente.
 *
 * Espejo owner-side de /mi-cuenta pero con la view del tenant:
 * - Datos personales (nombre, email, teléfono)
 * - Todos los enrollments (cursos, VIP, digital, servicios, topups)
 * - Event tickets (con status QR)
 * - Physical orders (con status envío + total)
 * - Reservations
 * - Wallets (balance por currency)
 * - Customer plans + últimas facturas
 * - Total gastado + LTV
 *
 * Todo defensivo con try/catch por si alguna migración está pendiente.
 */
export default async function UserDetailPage({
  params
}: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // Perfil base — si no existe, 404 (probablemente cambió el user_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRaw } = await (svc.from('profiles') as any)
    .select('id, email, display_name, created_at, avatar_url')
    .eq('id', userId).maybeSingle();
  if (!profileRaw) notFound();
  const profile = profileRaw as {
    id: string; email: string | null; display_name: string | null;
    created_at: string; avatar_url: string | null;
  };

  const [
    enrollmentsRow,
    ticketsRow,
    reservationsRow,
    ordersRow,
    walletsRow,
    plansRow,
    salesRow
  ] = await Promise.all([
    (async () => {
      try {
        const { data } = await svc.from('enrollments')
          .select('id, course_id, status, source, buyer_name, buyer_phone, buyer_dni, buyer_email, created_at, courses:course_id(title, slug, product_type, cover_url)')
          .eq('tenant_id', tenant.id).eq('user_id', userId)
          .order('created_at', { ascending: false });
        return data ?? [];
      } catch { return []; }
    })(),
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (svc.from('event_tickets') as any)
          .select('id, seat_label, status, qr_token, created_at, courses:course_id(title, slug), calendar_dates:calendar_date_id(event_date, event_time)')
          .eq('tenant_id', tenant.id).eq('user_id', userId)
          .order('created_at', { ascending: false });
        return (data ?? []) as Array<{
          id: string; seat_label: string | null; status: string; qr_token: string | null; created_at: string;
          courses: { title: string; slug: string } | null;
          calendar_dates: { event_date: string | null; event_time: string | null } | null;
        }>;
      } catch { return []; }
    })(),
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (svc.from('reservations') as any)
          .select('id, reservation_date, reservation_time, party_size, status, notes, courses:course_id(title, slug), venues:venue_id(name)')
          .eq('tenant_id', tenant.id).eq('customer_email', profile.email ?? '_none_')
          .order('reservation_date', { ascending: false });
        return (data ?? []) as Array<{
          id: string; reservation_date: string; reservation_time: string | null;
          party_size: number; status: string; notes: string | null;
          courses: { title: string; slug: string } | null;
          venues: { name: string } | null;
        }>;
      } catch { return []; }
    })(),
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (svc.from('physical_orders') as any)
          .select('id, status, total_cents, items_total_cents, shipping_cost_cents, currency, shipping_method_label, created_at')
          .eq('tenant_id', tenant.id).eq('buyer_user_id', userId)
          .order('created_at', { ascending: false });
        return (data ?? []) as Array<{
          id: string; status: string; total_cents: number; items_total_cents: number;
          shipping_cost_cents: number; currency: string; shipping_method_label: string | null; created_at: string;
        }>;
      } catch { return []; }
    })(),
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (svc.from('wallets') as any)
          .select('currency, balance_cents')
          .eq('tenant_id', tenant.id).eq('user_id', userId);
        return (data ?? []) as Array<{ currency: string; balance_cents: number }>;
      } catch { return []; }
    })(),
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: ps } = await (svc.from('customer_plans') as any)
          .select('id, plan_name, monthly_amount_cents, currency, status, start_date, end_date')
          .eq('tenant_id', tenant.id).eq('user_id', userId)
          .order('created_at', { ascending: false });
        const plans = (ps ?? []) as Array<{
          id: string; plan_name: string; monthly_amount_cents: number; currency: string;
          status: string; start_date: string; end_date: string | null;
        }>;
        if (plans.length === 0) return { plans, invoices: [] as Invoice[] };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: invs } = await (svc.from('customer_invoices') as any)
          .select('id, plan_id, concept, amount_cents, currency, issued_at, status, paid_at')
          .in('plan_id', plans.map((p) => p.id))
          .order('issued_at', { ascending: false })
          .limit(10);
        return { plans, invoices: (invs ?? []) as Invoice[] };
      } catch { return { plans: [], invoices: [] as Invoice[] }; }
    })(),
    (async () => {
      try {
        const { data } = await svc.from('sales')
          .select('amount_gross_cents, currency, occurred_at, status, product_title')
          .eq('tenant_id', tenant.id).eq('buyer_user_id', userId).eq('status', 'paid')
          .order('occurred_at', { ascending: false })
          .limit(20);
        return (data ?? []) as Array<{
          amount_gross_cents: number; currency: string; occurred_at: string;
          status: string; product_title: string | null;
        }>;
      } catch { return []; }
    })()
  ]);

  type Invoice = {
    id: string; plan_id: string; concept: string; amount_cents: number;
    currency: string; issued_at: string; status: string; paid_at: string | null;
  };

  const enrollments = enrollmentsRow as Array<{
    id: string; course_id: string; status: string; source: string;
    buyer_name: string | null; buyer_phone: string | null; buyer_dni: string | null;
    buyer_email: string | null; created_at: string;
    courses: { title: string; slug: string; product_type: string | null; cover_url: string | null } | null;
  }>;
  const tickets = ticketsRow;
  const reservations = reservationsRow;
  const orders = ordersRow;
  const wallets = walletsRow;
  const { plans, invoices } = plansRow as { plans: Array<{ id: string; plan_name: string; monthly_amount_cents: number; currency: string; status: string; start_date: string; end_date: string | null }>; invoices: Invoice[] };
  const sales = salesRow;

  // Sumar LTV: sales + physical_orders pagadas
  const salesTotal = sales.reduce((s, x) => s + Number(x.amount_gross_cents), 0);
  const paidOrders = orders.filter((o) => ['paid', 'preparing', 'shipped', 'delivered'].includes(o.status));
  const ordersTotal = paidOrders.reduce((s, o) => s + o.total_cents, 0);
  const ltvCents = salesTotal + ordersTotal;

  // Fallback nombre desde el enrollment más reciente con buyer_name
  const displayName =
    profile.display_name ??
    enrollments.find((e) => e.buyer_name)?.buyer_name ??
    profile.email?.split('@')[0] ??
    'Cliente';
  const displayPhone = enrollments.find((e) => e.buyer_phone)?.buyer_phone ?? null;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-1 text-xs">
        <Link href="/usuarios" className="text-white/50 hover:text-white">← Usuarios</Link>
      </div>

      <PageHeader
        title={displayName}
        description={profile.email ?? 'Sin email'}
      />

      {/* Chips de contacto */}
      <div className="flex flex-wrap gap-2 text-xs">
        {profile.email && (
          <a href={`mailto:${profile.email}`} className="rounded-full bg-white/5 border border-white/10 hover:bg-white/10 px-3 py-1.5">
            ✉️ {profile.email}
          </a>
        )}
        {displayPhone && (
          <a href={`https://wa.me/${displayPhone.replace(/\D/g, '')}`} target="_blank" rel="noopener"
            className="rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 px-3 py-1.5">
            💬 WhatsApp {displayPhone}
          </a>
        )}
        <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1.5 text-white/60">
          Cliente desde {new Date(profile.created_at).toLocaleDateString('es-AR')}
        </span>
      </div>

      {/* Stats top */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="LTV (revenue)" value={`$ ${(ltvCents / 100).toLocaleString('es-AR')}`} accent />
        <Stat label="Enrollments" value={enrollments.length.toString()} />
        <Stat label="Órdenes" value={orders.length.toString()} />
        <Stat label="Reservas / tickets" value={(tickets.length + reservations.length).toString()} />
      </div>

      {/* ── 🎓 Enrollments ── */}
      {enrollments.length > 0 && (
        <SectionCard title={`🎓 Cursos / contenido (${enrollments.length})`}>
          <ul className="divide-y divide-white/5">
            {enrollments.map((e) => (
              <li key={e.id} className="py-3 flex items-center gap-3">
                {e.courses?.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.courses.cover_url} alt="" className="w-12 h-12 rounded object-cover bg-white/5 shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded bg-white/5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{e.courses?.title ?? 'Producto eliminado'}</div>
                  <div className="text-[11px] text-white/50 mt-0.5">
                    {typeLabel(e.courses?.product_type)} · {e.status} · {new Date(e.created_at).toLocaleDateString('es-AR')}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* ── 🎫 Tickets ── */}
      {tickets.length > 0 && (
        <SectionCard title={`🎫 Entradas (${tickets.length})`}>
          <ul className="divide-y divide-white/5">
            {tickets.map((t) => (
              <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{t.courses?.title ?? 'Evento'}</div>
                  <div className="text-[11px] text-white/50 mt-0.5">
                    {t.calendar_dates?.event_date && `📅 ${t.calendar_dates.event_date}`}
                    {t.calendar_dates?.event_time && ` · 🕐 ${t.calendar_dates.event_time}`}
                    {t.seat_label && ` · 💺 ${t.seat_label}`}
                  </div>
                </div>
                <StatusChip status={t.status} />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* ── 📅 Reservas ── */}
      {reservations.length > 0 && (
        <SectionCard title={`📅 Reservas (${reservations.length})`}>
          <ul className="divide-y divide-white/5">
            {reservations.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{r.courses?.title ?? 'Reserva'}</div>
                  <div className="text-[11px] text-white/50 mt-0.5">
                    📅 {r.reservation_date}
                    {r.reservation_time && ` · 🕐 ${r.reservation_time}`}
                    {r.party_size > 1 && ` · 👥 ${r.party_size}`}
                    {r.venues?.name && ` · 📍 ${r.venues.name}`}
                  </div>
                  {r.notes && <div className="text-[10px] text-white/40 mt-0.5 italic">"{r.notes}"</div>}
                </div>
                <StatusChip status={r.status} />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* ── 📦 Órdenes físicas ── */}
      {orders.length > 0 && (
        <SectionCard title={`📦 Órdenes físicas (${orders.length})`}>
          <ul className="divide-y divide-white/5">
            {orders.map((o) => (
              <li key={o.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium font-mono">#{o.id.slice(0, 8)}</div>
                  <div className="text-[11px] text-white/50 mt-0.5">
                    📅 {new Date(o.created_at).toLocaleDateString('es-AR')}
                    {o.shipping_method_label && ` · 🚚 ${o.shipping_method_label}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-sm">
                    {o.currency} {(o.total_cents / 100).toLocaleString('es-AR')}
                  </div>
                  <StatusChip status={o.status} />
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* ── 💰 Wallet ── */}
      {wallets.some((w) => w.balance_cents !== 0) && (
        <SectionCard title="💰 Saldo en wallet">
          <div className="grid sm:grid-cols-3 gap-2">
            {wallets.filter((w) => w.balance_cents !== 0).map((w) => (
              <div key={w.currency} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="text-[10px] uppercase tracking-widest text-white/45">{w.currency}</div>
                <div className={`text-lg font-bold font-mono mt-1 ${w.balance_cents < 0 ? 'text-rose-300' : ''}`}>
                  {(w.balance_cents / 100).toLocaleString('es-AR')}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── 💳 Planes ── */}
      {plans.length > 0 && (
        <SectionCard title={`💳 Planes contratados (${plans.length})`}>
          <ul className="divide-y divide-white/5">
            {plans.map((p) => (
              <li key={p.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{p.plan_name}</div>
                    <div className="text-[11px] text-white/50 mt-0.5">
                      Desde {p.start_date}{p.end_date && ` · Hasta ${p.end_date}`}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {p.monthly_amount_cents > 0 && (
                      <div className="font-mono text-sm">
                        {p.currency} {(p.monthly_amount_cents / 100).toLocaleString('es-AR')} <span className="text-white/40 text-[10px]">/mes</span>
                      </div>
                    )}
                    <StatusChip status={p.status} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {invoices.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="text-[11px] text-white/50 uppercase tracking-widest mb-2">Últimas facturas</div>
              <ul className="space-y-1.5 text-xs">
                {invoices.slice(0, 5).map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between gap-2">
                    <span className="text-white/70 truncate">{inv.concept}</span>
                    <span className="font-mono whitespace-nowrap">
                      {inv.currency} {(inv.amount_cents / 100).toLocaleString('es-AR')}{' '}
                      <StatusChip status={inv.status} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Actividad de compra reciente ── */}
      {sales.length > 0 && (
        <SectionCard title={`💵 Últimas compras (${sales.length})`}>
          <ul className="divide-y divide-white/5">
            {sales.slice(0, 10).map((s, i) => (
              <li key={i} className="py-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm truncate">{s.product_title ?? 'Compra'}</div>
                  <div className="text-[11px] text-white/45">{new Date(s.occurred_at).toLocaleString('es-AR')}</div>
                </div>
                <div className="font-mono text-sm text-emerald-300">
                  {s.currency} {(Number(s.amount_gross_cents) / 100).toLocaleString('es-AR')}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/10 bg-white/[0.02]'}`}>
      <div className="text-[10px] uppercase tracking-widest text-white/50">{label}</div>
      <div className={`text-lg font-bold mt-1 ${accent ? 'text-emerald-300' : ''}`}>{value}</div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function StatusChip({ status }: { status: string }) {
  const good = /paid|confirmed|active|shipped|delivered|used/.test(status);
  const warn = /pending|preparing|suspended|no_show/.test(status);
  const bad = /cancelled|refunded|expired|finished/.test(status);
  const cls =
    good ? 'bg-emerald-500/15 text-emerald-300' :
    warn ? 'bg-amber-500/15 text-amber-300' :
    bad ? 'bg-rose-500/15 text-rose-300' :
    'bg-white/10 text-white/60';
  return (
    <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cls}`}>
      {status}
    </span>
  );
}

function typeLabel(t: string | null | undefined): string {
  switch (t) {
    case 'vip_pack': return '💎 VIP';
    case 'digital':  return '📁 Digital';
    case 'service':  return '🛠️ Servicio';
    case 'event':    return '🎫 Evento';
    case 'mentorship': return '🧑‍🏫 Mentoría';
    case 'topup':    return '💰 Carga saldo';
    case 'physical': return '📦 Físico';
    default:         return '🎓 Curso';
  }
}
