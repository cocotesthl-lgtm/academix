import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * /mi-cuenta — Hub unificado del cliente.
 *
 * Concentra en una sola página todo lo que el buyer tiene en este tenant:
 * cursos, entradas de eventos, reservas, órdenes físicas, gift cards, saldo
 * en wallet, planes/suscripciones con facturas. Cada sección aparece sólo
 * si hay data — no molestamos con "sin cursos" / "sin órdenes" / etc.
 *
 * Todas las queries son defensivas con try/catch: si la migración de esa
 * feature aún no corrió en este tenant, la sección simplemente no aparece.
 */
export default async function MiCuentaPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();
  const primary = tenant.brand?.primary_color ?? '#0a0a0a';

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/mi-cuenta');
  const buyerEmail = user.email ?? '';
  const displayName =
    (user.user_metadata?.display_name as string | undefined) ||
    (user.user_metadata?.full_name as string | undefined) ||
    buyerEmail.split('@')[0] || 'cliente';

  const svc = getServiceClient();

  // ── Fetch data (todo en paralelo, todo defensivo) ────────────────
  const [
    enrollmentsRow,
    ticketsRow,
    reservationsRow,
    ordersRow,
    giftCardsRow,
    walletsRow,
    plansRow
  ] = await Promise.all([
    // 1. Enrollments → cursos, VIP, digital, etc.
    (async () => {
      try {
        const { data } = await svc.from('enrollments')
          .select('id, course_id, created_at, courses:course_id(id, slug, title, cover_url, product_type)')
          .eq('tenant_id', tenantId).eq('user_id', user.id)
          .order('created_at', { ascending: false });
        return data ?? [];
      } catch { return []; }
    })(),
    // 2. Event tickets
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (svc.from('event_tickets') as any)
          .select('id, seat_label, status, qr_token, created_at, courses:course_id(id, slug, title, cover_url), calendar_dates:calendar_date_id(event_date, event_time)')
          .eq('tenant_id', tenantId)
          .or(`user_id.eq.${user.id},buyer_email.eq.${buyerEmail}`)
          .in('status', ['confirmed', 'used'])
          .order('created_at', { ascending: false })
          .limit(20);
        return (data ?? []) as Array<{
          id: string; seat_label: string | null; status: string; qr_token: string | null; created_at: string;
          courses: { id: string; slug: string; title: string; cover_url: string | null } | null;
          calendar_dates: { event_date: string | null; event_time: string | null } | null;
        }>;
      } catch { return []; }
    })(),
    // 3. Reservations (mentorship / restaurant / multi_venue)
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (svc.from('reservations') as any)
          .select('id, reservation_date, reservation_time, party_size, status, courses:course_id(id, slug, title), venues:venue_id(name)')
          .eq('tenant_id', tenantId).eq('customer_email', buyerEmail)
          .order('reservation_date', { ascending: false })
          .limit(20);
        return (data ?? []) as Array<{
          id: string; reservation_date: string; reservation_time: string | null;
          party_size: number; status: string;
          courses: { id: string; slug: string; title: string } | null;
          venues: { name: string } | null;
        }>;
      } catch { return []; }
    })(),
    // 4. Physical orders
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (svc.from('physical_orders') as any)
          .select('id, status, total_cents, currency, created_at, shipping_method_label, items_total_cents, shipping_cost_cents')
          .eq('tenant_id', tenantId)
          .or(`buyer_user_id.eq.${user.id},buyer_email.eq.${buyerEmail}`)
          .order('created_at', { ascending: false })
          .limit(20);
        return (data ?? []) as Array<{
          id: string; status: string; total_cents: number; currency: string;
          created_at: string; shipping_method_label: string | null;
          items_total_cents: number; shipping_cost_cents: number;
        }>;
      } catch { return []; }
    })(),
    // 5. Gift cards que el buyer canjeó
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (svc.from('gift_cards') as any)
          .select('id, code, amount_cents, currency, status, redeemed_at, sender_name, message')
          .eq('tenant_id', tenantId).eq('redeemed_by_email', buyerEmail)
          .order('redeemed_at', { ascending: false })
          .limit(10);
        return (data ?? []) as Array<{
          id: string; code: string; amount_cents: number; currency: string;
          status: string; redeemed_at: string | null; sender_name: string | null; message: string | null;
        }>;
      } catch { return []; }
    })(),
    // 6. Wallet balances (puede haber múltiples currencies)
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (svc.from('wallets') as any)
          .select('currency, balance_cents')
          .eq('tenant_id', tenantId).eq('user_id', user.id);
        return (data ?? []) as Array<{ currency: string; balance_cents: number }>;
      } catch { return []; }
    })(),
    // 7. Planes con facturas (lo que ya existía)
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: ps } = await (svc.from('customer_plans') as any)
          .select('id, plan_name, description, monthly_amount_cents, currency, status, start_date, end_date, customer_message')
          .eq('tenant_id', tenantId).eq('user_id', user.id)
          .order('created_at', { ascending: false });
        const plans = (ps ?? []) as Array<{
          id: string; plan_name: string; description: string | null;
          monthly_amount_cents: number; currency: string; status: string;
          start_date: string; end_date: string | null; customer_message: string | null;
        }>;
        if (plans.length === 0) return { plans, invByPlan: new Map<string, Array<Invoice>>() };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: invs } = await (svc.from('customer_invoices') as any)
          .select('id, number, concept, amount_cents, currency, issued_at, due_at, status, paid_at, payment_method, plan_id')
          .in('plan_id', plans.map((p) => p.id))
          .order('issued_at', { ascending: false });
        const invByPlan = new Map<string, Array<Invoice>>();
        for (const row of (invs ?? []) as Array<Invoice & { plan_id: string }>) {
          const arr = invByPlan.get(row.plan_id) ?? [];
          arr.push(row);
          invByPlan.set(row.plan_id, arr);
        }
        return { plans, invByPlan };
      } catch { return { plans: [], invByPlan: new Map<string, Array<Invoice>>() }; }
    })()
  ]);

  type Invoice = {
    id: string; number: string | null; concept: string;
    amount_cents: number; currency: string;
    issued_at: string; due_at: string | null; status: string;
    paid_at: string | null; payment_method: string | null;
  };

  const enrollments = enrollmentsRow as Array<{
    id: string; course_id: string; created_at: string;
    courses: { id: string; slug: string; title: string; cover_url: string | null; product_type: string | null } | null;
  }>;
  const tickets = ticketsRow;
  const reservations = reservationsRow;
  const orders = ordersRow;
  const giftCards = giftCardsRow;
  const wallets = walletsRow;
  const { plans, invByPlan } = plansRow as { plans: Array<PlanFull>; invByPlan: Map<string, Array<Invoice>> };

  type PlanFull = {
    id: string; plan_name: string; description: string | null;
    monthly_amount_cents: number; currency: string; status: string;
    start_date: string; end_date: string | null; customer_message: string | null;
  };

  // Detección para "ni un plan ni una compra ni nada" → empty state global
  const hasAnything =
    enrollments.length > 0 || tickets.length > 0 || reservations.length > 0 ||
    orders.length > 0 || giftCards.length > 0 || wallets.some((w) => w.balance_cents > 0) ||
    plans.length > 0;

  return (
    <article className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <header>
        <h1 className="text-3xl font-bold">Hola, {displayName}</h1>
        <p className="text-black/55 text-sm mt-1">
          Tu cuenta en <strong>{tenant.name}</strong>. Todo lo que compraste, contrataste o tenés reservado.
        </p>
      </header>

      {!hasAnything && (
        <div className="rounded-2xl border border-black/10 p-10 text-center text-black/50 space-y-2">
          <div className="text-4xl">👋</div>
          <p className="text-base">Todavía no tenés compras, contratos ni reservas.</p>
          <p className="text-sm text-black/40">
            Explorá el catálogo y cuando compres algo aparece acá.
          </p>
          <Link href="/" className="inline-block mt-3 rounded-md px-4 py-2 text-white text-sm font-semibold"
            style={{ background: primary }}>
            Ver catálogo
          </Link>
        </div>
      )}

      {/* ── 🎓 Mis cursos / VIP / digital / servicios ── */}
      {enrollments.length > 0 && (
        <Section title="🎓 Mis cursos y contenido" count={enrollments.length} viewAllHref="/learn" viewAllLabel="Ir al player">
          <div className="grid sm:grid-cols-2 gap-3">
            {enrollments.slice(0, 4).map((e) => e.courses && (
              <Link key={e.id} href={`/learn/${e.courses.id}`}
                className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-3 hover:border-black/25 hover:shadow-sm transition">
                {e.courses.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.courses.cover_url} alt="" className="w-14 h-14 rounded-lg object-cover bg-black/5 shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-black/5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-black truncate">{e.courses.title}</div>
                  <div className="text-[11px] text-black/45 mt-0.5">
                    {e.courses.product_type === 'vip_pack' ? '💎 Pack VIP' :
                     e.courses.product_type === 'digital' ? '📁 Producto digital' :
                     e.courses.product_type === 'service' ? '🛠️ Servicio' :
                     '🎓 Curso'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* ── 🎫 Entradas de eventos ── */}
      {tickets.length > 0 && (
        <Section title="🎫 Mis entradas" count={tickets.length}>
          <ul className="divide-y divide-black/5 border border-black/10 rounded-xl bg-white">
            {tickets.slice(0, 5).map((t) => (
              <li key={t.id} className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-black">{t.courses?.title ?? 'Evento'}</div>
                  <div className="text-[12px] text-black/55 mt-0.5">
                    {t.calendar_dates?.event_date && (
                      <>📅 {new Date(t.calendar_dates.event_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</>
                    )}
                    {t.calendar_dates?.event_time && <> · 🕐 {t.calendar_dates.event_time}</>}
                    {t.seat_label && <> · 💺 {t.seat_label}</>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <StatusBadge status={t.status} labels={{ confirmed: '✓ Válida', used: '✔ Usada' }} />
                  {t.qr_token && t.status === 'confirmed' && (
                    <div className="text-[10px] text-black/40 mt-1 font-mono">QR: {t.qr_token.slice(0, 8)}…</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {tickets.length > 5 && (
            <div className="text-xs text-black/45 mt-2">+{tickets.length - 5} más</div>
          )}
        </Section>
      )}

      {/* ── 📅 Reservas / turnos ── */}
      {reservations.length > 0 && (
        <Section title="📅 Mis reservas" count={reservations.length}>
          <ul className="divide-y divide-black/5 border border-black/10 rounded-xl bg-white">
            {reservations.slice(0, 5).map((r) => (
              <li key={r.id} className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-black">{r.courses?.title ?? 'Reserva'}</div>
                  <div className="text-[12px] text-black/55 mt-0.5">
                    📅 {new Date(r.reservation_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {r.reservation_time && <> · 🕐 {r.reservation_time}</>}
                    {r.party_size > 1 && <> · 👥 {r.party_size} personas</>}
                    {r.venues?.name && <> · 📍 {r.venues.name}</>}
                  </div>
                </div>
                <StatusBadge status={r.status} labels={{
                  pending: '🟡 Pendiente', confirmed: '✓ Confirmada',
                  cancelled: '⚫ Cancelada', completed: '✓ Realizada', no_show: '❌ No asististe'
                }} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── 📦 Órdenes físicas ── */}
      {orders.length > 0 && (
        <Section title="📦 Mis órdenes" count={orders.length}>
          <ul className="divide-y divide-black/5 border border-black/10 rounded-xl bg-white">
            {orders.slice(0, 5).map((o) => (
              <li key={o.id} className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-black">
                    Orden <span className="font-mono">#{o.id.slice(0, 8)}</span>
                  </div>
                  <div className="text-[12px] text-black/55 mt-0.5">
                    📅 {new Date(o.created_at).toLocaleDateString('es-AR')}
                    {o.shipping_method_label && <> · 🚚 {o.shipping_method_label}</>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono font-bold text-sm">
                    {o.currency} {(o.total_cents / 100).toLocaleString('es-AR')}
                  </div>
                  <div className="mt-1">
                    <StatusBadge status={o.status} labels={{
                      pending: '🟡 Pendiente pago', paid: '✓ Pagada',
                      preparing: '📦 Preparando', shipped: '🚚 Enviada',
                      delivered: '✅ Entregada', cancelled: '⚫ Cancelada', refunded: '↩ Reembolsada'
                    }} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── 💰 Saldo ── */}
      {wallets.some((w) => w.balance_cents > 0) && (
        <Section title="💰 Mi saldo" viewAllHref="/saldo" viewAllLabel="Ver movimientos">
          <div className="grid sm:grid-cols-3 gap-3">
            {wallets.filter((w) => w.balance_cents > 0).map((w) => (
              <div key={w.currency} className="rounded-xl border border-black/10 bg-white p-4">
                <div className="text-[10px] uppercase tracking-widest text-black/45">{w.currency}</div>
                <div className="text-2xl font-bold font-mono mt-1">
                  {(w.balance_cents / 100).toLocaleString('es-AR')}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── 🎁 Gift cards canjeadas ── */}
      {giftCards.length > 0 && (
        <Section title="🎁 Mis gift cards" count={giftCards.length}>
          <ul className="divide-y divide-black/5 border border-black/10 rounded-xl bg-white">
            {giftCards.slice(0, 5).map((g) => (
              <li key={g.id} className="p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-black font-mono">{g.code}</div>
                  {g.sender_name && (
                    <div className="text-[11px] text-black/50 mt-0.5">De: {g.sender_name}</div>
                  )}
                  {g.message && (
                    <div className="text-[11px] text-black/45 mt-1 italic">"{g.message}"</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-sm">
                    {g.currency} {(g.amount_cents / 100).toLocaleString('es-AR')}
                  </div>
                  <StatusBadge status={g.status} labels={{
                    active: '🟢 Activa', redeemed: '✓ Canjeada',
                    expired: '⏱ Vencida', cancelled: '⚫ Cancelada'
                  }} />
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── 💳 Planes / suscripciones (bloque completo con facturas) ── */}
      {plans.map((plan) => {
        const invoices = invByPlan.get(plan.id) ?? [];
        const dueAmount = invoices.filter((i) => i.status === 'pending').reduce((s, i) => s + i.amount_cents, 0);
        const status = PLAN_STATUS[plan.status] ?? { label: plan.status };
        return (
          <section key={plan.id} className="rounded-2xl border border-black/10 overflow-hidden bg-white">
            <div className="p-6 text-white" style={{ background: primary }}>
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="text-xs uppercase tracking-widest opacity-80">💳 Plan contratado</div>
                  <h2 className="text-2xl font-bold mt-1">{plan.plan_name}</h2>
                  {plan.description && <p className="text-sm opacity-85 mt-1">{plan.description}</p>}
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded"
                  style={{ background: 'rgba(0,0,0,0.25)' }}>{status.label}</span>
              </div>
              {plan.monthly_amount_cents > 0 && (
                <div className="mt-4 text-sm opacity-90">
                  Cuota mensual: <strong className="font-mono">{plan.currency} {(plan.monthly_amount_cents / 100).toLocaleString('es-AR')}</strong>
                </div>
              )}
            </div>

            {plan.customer_message && (
              <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-900">
                📢 {plan.customer_message}
              </div>
            )}

            {dueAmount !== 0 && (
              <div className={`px-6 py-4 ${dueAmount > 0 ? 'bg-rose-50 border-b border-rose-200' : 'bg-emerald-50 border-b border-emerald-200'}`}>
                <div className="text-xs uppercase tracking-wide text-black/55">
                  {dueAmount > 0 ? 'Saldo a pagar' : 'Saldo a favor'}
                </div>
                <div className={`text-2xl font-bold mt-1 font-mono ${dueAmount > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  $ {Math.abs(dueAmount / 100).toLocaleString('es-AR')}
                </div>
              </div>
            )}

            <div className="p-6">
              <h3 className="text-sm font-semibold mb-3">Historial de facturas</h3>
              {invoices.length === 0 ? (
                <p className="text-xs text-black/40">Sin facturas todavía.</p>
              ) : (
                <ul className="divide-y divide-black/5">
                  {invoices.map((inv) => {
                    const isPaid = inv.status === 'paid';
                    const isCancelled = inv.status === 'cancelled';
                    const isPending = inv.status === 'pending';
                    const isCredit = inv.amount_cents < 0;
                    return (
                      <li key={inv.id} className="py-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{inv.concept}</div>
                          <div className="text-[11px] text-black/55 mt-0.5">
                            Emitida {inv.issued_at}{inv.due_at && ` · Vence ${inv.due_at}`}{inv.number && ` · ${inv.number}`}
                          </div>
                          {isPaid && inv.paid_at && (
                            <div className="text-[10px] text-emerald-700 mt-0.5">
                              ✓ Pagada el {new Date(inv.paid_at).toLocaleDateString('es-AR')}{inv.payment_method && ` (${inv.payment_method})`}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className={`font-mono font-bold text-sm ${isCredit ? 'text-emerald-700' : 'text-black'}`}>
                            {isCredit ? '-' : ''}{inv.currency} {Math.abs(inv.amount_cents / 100).toLocaleString('es-AR')}
                          </div>
                          <span className={`text-[9px] uppercase tracking-wider font-bold ${
                            isPaid ? 'text-emerald-700' : isCancelled ? 'text-black/35' : 'text-amber-700'
                          }`}>
                            {isPaid ? '✓ Pagada' : isCancelled ? '⚫ Anulada' : '🟡 Pendiente'}
                          </span>
                          {isPending && inv.amount_cents > 0 && (
                            <div className="mt-1.5">
                              <Link href={`/mi-cuenta/pagar/${inv.id}`}
                                className="inline-block text-[11px] px-3 py-1.5 rounded font-semibold text-white"
                                style={{ background: primary }}>
                                💳 Pagar
                              </Link>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        );
      })}
    </article>
  );
}

const PLAN_STATUS: Record<string, { label: string }> = {
  active:    { label: '🟢 Activo' },
  suspended: { label: '⏸️ Suspendido' },
  cancelled: { label: '⚫ Cancelado' },
  finished:  { label: '✓ Finalizado' }
};

function Section({
  title, count, viewAllHref, viewAllLabel, children
}: {
  title: string; count?: number; viewAllHref?: string; viewAllLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-lg font-bold text-black">
          {title}
          {count !== undefined && (
            <span className="ml-2 text-sm font-normal text-black/45">({count})</span>
          )}
        </h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-xs text-black/60 hover:text-black underline underline-offset-2">
            {viewAllLabel ?? 'Ver todos'} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function StatusBadge({ status, labels }: { status: string; labels: Record<string, string> }) {
  const label = labels[status] ?? status;
  const cls = /✓|✅|Confirmada|Activa|Pagada|Realizada/.test(label)
    ? 'bg-emerald-100 text-emerald-800'
    : /🟡|Pendiente|Preparando|Enviada/.test(label)
      ? 'bg-amber-100 text-amber-800'
      : /❌|Cancelada|No asististe|Vencida/.test(label)
        ? 'bg-rose-100 text-rose-800'
        : 'bg-black/10 text-black/60';
  return (
    <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${cls}`}>
      {label}
    </span>
  );
}
