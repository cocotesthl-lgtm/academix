import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/owner/PageHeader';
import { createUserAction } from '@/lib/users/actions';

export const dynamic = 'force-dynamic';

/**
 * /owner/usuarios — Panel de usuarios (una fila por cliente único).
 *
 * A diferencia de /clientes (una fila por compra), agrupa todo el
 * footprint de cada cliente en el tenant y muestra un resumen:
 *   - Nombre + email (fallback al mejor disponible)
 *   - Suma de interacciones por app (cursos, tickets, órdenes, reservas, planes)
 *   - Total gastado en el tenant
 *   - Última actividad
 *
 * Dedupe: user_id cuando existe, buyer_email como fallback para
 * compras anónimas (checkout sin cuenta creada).
 *
 * Click en cada fila → /usuarios/[userId] con detalle completo.
 */

type Bucket = {
  key: string;                      // user_id o "email:xxx" para anónimos
  userId: string | null;            // null cuando sólo tenemos email
  displayName: string | null;
  email: string | null;
  phone: string | null;
  courses: number;
  tickets: number;
  reservations: number;
  orders: number;
  plans: number;
  totalSpentCents: number;
  currency: string;                 // primera currency detectada (aproximado)
  lastActivity: string;             // ISO
};

export default async function OwnerUsuariosPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { tenant } = await requireOwner();
  const sp = await searchParams;
  const search = (sp.q ?? '').trim().toLowerCase();
  const svc = getServiceClient();

  // ── Cargar datos de todas las apps en paralelo ──────────────────
  const [
    enrollmentsData,
    ticketsData,
    reservationsData,
    ordersData,
    plansData,
    salesData
  ] = await Promise.all([
    (async () => {
      try {
        const { data } = await svc.from('enrollments')
          .select('user_id, buyer_name, buyer_email, buyer_phone, created_at')
          .eq('tenant_id', tenant.id);
        return (data ?? []) as Array<{
          user_id: string | null; buyer_name: string | null; buyer_email: string | null;
          buyer_phone: string | null; created_at: string;
        }>;
      } catch { return []; }
    })(),
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (svc.from('event_tickets') as any)
          .select('user_id, buyer_name, buyer_email, created_at')
          .eq('tenant_id', tenant.id);
        return (data ?? []) as Array<{
          user_id: string | null; buyer_name: string | null; buyer_email: string | null; created_at: string;
        }>;
      } catch { return []; }
    })(),
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (svc.from('reservations') as any)
          .select('customer_name, customer_email, customer_phone, created_at')
          .eq('tenant_id', tenant.id);
        return (data ?? []) as Array<{
          customer_name: string | null; customer_email: string; customer_phone: string | null; created_at: string;
        }>;
      } catch { return []; }
    })(),
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (svc.from('physical_orders') as any)
          .select('buyer_user_id, buyer_name, buyer_email, buyer_phone, total_cents, currency, created_at, status')
          .eq('tenant_id', tenant.id);
        return (data ?? []) as Array<{
          buyer_user_id: string | null; buyer_name: string | null; buyer_email: string | null;
          buyer_phone: string | null; total_cents: number; currency: string;
          created_at: string; status: string;
        }>;
      } catch { return []; }
    })(),
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (svc.from('customer_plans') as any)
          .select('user_id, monthly_amount_cents, currency, created_at')
          .eq('tenant_id', tenant.id);
        return (data ?? []) as Array<{
          user_id: string | null; monthly_amount_cents: number; currency: string; created_at: string;
        }>;
      } catch { return []; }
    })(),
    // Ventas: fuente principal de "total gastado" para cursos/VIP/etc.
    (async () => {
      try {
        const { data } = await svc.from('sales')
          .select('buyer_user_id, buyer_email, amount_gross_cents, currency, occurred_at, status')
          .eq('tenant_id', tenant.id).eq('status', 'paid');
        return (data ?? []) as Array<{
          buyer_user_id: string | null; buyer_email: string | null;
          amount_gross_cents: number; currency: string; occurred_at: string; status: string;
        }>;
      } catch { return []; }
    })()
  ]);

  // ── Agregación: dedupe por user_id | email ───────────────────────
  const buckets = new Map<string, Bucket>();
  function key(userId: string | null | undefined, email: string | null | undefined): string | null {
    if (userId) return userId;
    if (email) return `email:${email.toLowerCase()}`;
    return null;
  }
  function upsert(
    userId: string | null | undefined,
    name: string | null | undefined,
    email: string | null | undefined,
    phone: string | null | undefined,
    when: string,
    spend: { cents: number; currency: string } | null,
    bump: 'courses' | 'tickets' | 'reservations' | 'orders' | 'plans'
  ) {
    const k = key(userId, email);
    if (!k) return;
    let b = buckets.get(k);
    if (!b) {
      b = {
        key: k, userId: userId ?? null,
        displayName: name ?? null, email: email ?? null, phone: phone ?? null,
        courses: 0, tickets: 0, reservations: 0, orders: 0, plans: 0,
        totalSpentCents: 0, currency: spend?.currency ?? 'ARS',
        lastActivity: when
      };
      buckets.set(k, b);
    }
    b[bump]++;
    // Preferir el mejor nombre disponible (no null)
    if (name && !b.displayName) b.displayName = name;
    if (email && !b.email) b.email = email;
    if (phone && !b.phone) b.phone = phone;
    if (spend) b.totalSpentCents += spend.cents;
    if (when > b.lastActivity) b.lastActivity = when;
  }

  for (const e of enrollmentsData) {
    upsert(e.user_id, e.buyer_name, e.buyer_email, e.buyer_phone, e.created_at, null, 'courses');
  }
  for (const t of ticketsData) {
    upsert(t.user_id, t.buyer_name, t.buyer_email, null, t.created_at, null, 'tickets');
  }
  for (const r of reservationsData) {
    upsert(null, r.customer_name, r.customer_email, r.customer_phone, r.created_at, null, 'reservations');
  }
  for (const o of ordersData) {
    const paid = o.status === 'paid' || o.status === 'shipped' || o.status === 'delivered' || o.status === 'preparing';
    upsert(
      o.buyer_user_id, o.buyer_name, o.buyer_email, o.buyer_phone,
      o.created_at,
      paid ? { cents: o.total_cents, currency: o.currency } : null,
      'orders'
    );
  }
  for (const p of plansData) {
    upsert(p.user_id, null, null, null, p.created_at, null, 'plans');
  }
  // Ventas → sumar spend a los buckets existentes (matched por user_id o email)
  for (const s of salesData) {
    const k = key(s.buyer_user_id, s.buyer_email);
    if (!k) continue;
    const b = buckets.get(k);
    if (b) {
      b.totalSpentCents += Number(s.amount_gross_cents);
      if (s.occurred_at > b.lastActivity) b.lastActivity = s.occurred_at;
    }
  }

  // ── Enriquecer con profiles (email + display_name cuando falta) ──
  const userIds = Array.from(buckets.values()).map((b) => b.userId).filter(Boolean) as string[];
  if (userIds.length > 0) {
    const { data: profs } = await svc.from('profiles')
      .select('id, email, display_name')
      .in('id', userIds);
    for (const p of (profs ?? []) as Array<{ id: string; email: string | null; display_name: string | null }>) {
      const b = buckets.get(p.id);
      if (!b) continue;
      if (!b.email && p.email) b.email = p.email;
      if (!b.displayName && p.display_name) b.displayName = p.display_name;
    }
  }

  // ── Filtro de búsqueda + orden por última actividad DESC ─────────
  const rows = Array.from(buckets.values())
    .filter((b) => {
      if (!search) return true;
      const hay = [b.displayName, b.email, b.phone].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(search);
    })
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

  const totalUsers = buckets.size;
  const withAccount = Array.from(buckets.values()).filter((b) => b.userId).length;
  const totalRevenue = Array.from(buckets.values()).reduce((s, b) => s + b.totalSpentCents, 0);

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title="Usuarios"
        description="Todos los clientes únicos de tu tenant, agrupados por cuenta. Cada fila abre un detalle con todo su historial."
      />

      {/* Crear usuario rápido: form inline con email + nombre. Si el email
          ya existe, redirige a su detalle en vez de crear duplicado. */}
      <form action={createUserAction} className="flex flex-wrap gap-2 items-end rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-1">Email (obligatorio)</label>
          <input name="email" type="email" required placeholder="cliente@mail.com"
            className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40" />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[10px] uppercase tracking-widest text-white/50 mb-1">Nombre (opcional)</label>
          <input name="display_name" placeholder="Juan Pérez"
            className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40" />
        </div>
        <button className="rounded-md bg-white text-black text-sm font-semibold px-4 py-2">
          + Crear usuario
        </button>
      </form>

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Clientes únicos" value={totalUsers.toString()} />
        <Stat label="Con cuenta registrada" value={`${withAccount}/${totalUsers}`} />
        <Stat label="Revenue total" value={`$ ${(totalRevenue / 100).toLocaleString('es-AR')}`} />
      </div>

      <form method="get" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="🔍 Buscar por nombre, email o teléfono…"
          className="flex-1 rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
        />
        <button className="rounded-md bg-white text-black text-sm font-semibold px-4">Buscar</button>
        {search && (
          <Link href="/usuarios" className="rounded-md border border-white/15 text-white/60 text-sm px-3 py-2 hover:text-white">
            Limpiar
          </Link>
        )}
      </form>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-white/50 text-sm">
            {totalUsers === 0
              ? 'Todavía no hay usuarios. Cuando alguien compre, se enrole, reserve o cobre en tu sitio, va a aparecer acá.'
              : 'Sin resultados con esa búsqueda.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#0f0f0f] text-white/50 text-[10px] uppercase tracking-widest">
              <tr>
                <th className="text-left px-4 py-2.5">Cliente</th>
                <th className="text-left px-3 py-2.5">Actividad</th>
                <th className="text-right px-3 py-2.5">Gastado</th>
                <th className="text-left px-3 py-2.5">Última</th>
                <th className="text-right px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const detailHref = b.userId ? `/usuarios/${b.userId}` : null;
                const nameEl = (
                  <div className="min-w-0">
                    <div className="font-medium truncate">{b.displayName ?? b.email ?? '—'}</div>
                    <div className="text-[11px] text-white/50 truncate">
                      {b.email}
                      {b.phone && <> · {b.phone}</>}
                      {!b.userId && <span className="ml-2 text-amber-400/80">(sin cuenta)</span>}
                    </div>
                  </div>
                );
                return (
                  <tr key={b.key} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      {detailHref ? (
                        <Link href={detailHref} className="hover:underline block">{nameEl}</Link>
                      ) : nameEl}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        {b.courses > 0       && <Chip icon="🎓" n={b.courses} />}
                        {b.tickets > 0       && <Chip icon="🎫" n={b.tickets} />}
                        {b.reservations > 0  && <Chip icon="📅" n={b.reservations} />}
                        {b.orders > 0        && <Chip icon="📦" n={b.orders} />}
                        {b.plans > 0         && <Chip icon="💳" n={b.plans} />}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-emerald-300">
                      {b.totalSpentCents > 0
                        ? `${b.currency} ${(b.totalSpentCents / 100).toLocaleString('es-AR')}`
                        : <span className="text-white/25">—</span>}
                    </td>
                    <td className="px-3 py-3 text-white/55 text-xs whitespace-nowrap">
                      {new Date(b.lastActivity).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {detailHref ? (
                        <Link href={detailHref} className="text-xs text-white/60 hover:text-white">
                          Detalle →
                        </Link>
                      ) : (
                        <span className="text-[10px] text-white/30">sin cuenta</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[11px] text-white/40">
        💡 Los usuarios "sin cuenta" son compras anónimas identificadas solo por email — no tienen historial navegable.
        Aparecen igual para que puedas contactarlos.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-[10px] text-white/50 uppercase tracking-widest">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}

function Chip({ icon, n }: { icon: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-white/10 px-1.5 py-0.5">
      <span>{icon}</span>
      <span className="font-semibold">{n}</span>
    </span>
  );
}
