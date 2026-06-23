import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { PageHeader, HeaderSecondary } from "@/components/owner/PageHeader";
import { Pill } from "@/components/owner/Pill";
import { EmptyState } from "@/components/owner/EmptyState";
import { cancelClientSubscriptionAction } from "@/lib/courses/subscriptions";
import { relativeTime, absoluteTime } from "@/lib/time";

export const dynamic = "force-dynamic";

type SubRow = {
  id: string;
  course_id: string;
  user_id: string | null;
  preapproval_id: string;
  status: string;
  frequency: 'monthly' | 'yearly';
  amount_cents: number;
  currency: string;
  started_at: string;
  next_billing_at: string | null;
  cancelled_at: string | null;
};

/**
 * Página del owner para gestionar las suscripciones recurrentes de SUS
 * clientes a sus publicaciones. Diferente a /mi-plan (donde el owner paga al
 * founder) — acá el owner cobra a sus propios compradores.
 *
 * El dinero va directo al MP del owner (no pasa por Curplat).
 */
export default async function OwnerSubscriptionsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { tenant } = await requireOwner();
  const sp = await searchParams;
  const filterStatus = sp.status ?? '';
  const search = (sp.q ?? '').trim().toLowerCase();

  const svc = getServiceClient();

  // Defensivo: tabla subscriptions puede no existir si migration 0013 falló
  let subs: SubRow[] = [];
  let migrationMissing = false;
  try {
    const { data, error } = await svc
      .from('subscriptions')
      .select('id, course_id, user_id, preapproval_id, status, frequency, amount_cents, currency, started_at, next_billing_at, cancelled_at')
      .eq('tenant_id', tenant.id)
      .order('started_at', { ascending: false })
      .limit(500);
    if (error) migrationMissing = true;
    else subs = (data ?? []) as SubRow[];
  } catch { migrationMissing = true; }

  if (migrationMissing) {
    return (
      <div className="max-w-2xl space-y-4">
        <PageHeader title="Suscripciones" description="Clientes con suscripción recurrente activa." />
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-200">
          <p className="font-semibold mb-2">⚠️ Migración 0013 pendiente</p>
          <p className="text-sm">
            Corré <code className="bg-black/30 px-1 rounded">RUN_THIS_NOW.sql</code> en Supabase
            para crear la tabla <code className="bg-black/30 px-1 rounded">subscriptions</code>.
          </p>
        </div>
      </div>
    );
  }

  // Fetch publicaciones + profiles para mostrar nombres
  const courseIds = Array.from(new Set(subs.map((s) => s.course_id)));
  const userIds = Array.from(new Set(subs.map((s) => s.user_id).filter((id): id is string => !!id)));
  const [{ data: courses }, { data: profiles }] = await Promise.all([
    courseIds.length > 0
      ? svc.from('courses').select('id, title').in('id', courseIds)
      : Promise.resolve({ data: [] }),
    userIds.length > 0
      ? svc.from('profiles').select('id, email, display_name').in('id', userIds)
      : Promise.resolve({ data: [] })
  ]);
  const courseMap = new Map(((courses ?? []) as Array<{ id: string; title: string }>).map((c) => [c.id, c.title]));
  const profileMap = new Map(((profiles ?? []) as Array<{ id: string; email: string | null; display_name: string | null }>)
    .map((p) => [p.id, { email: p.email, display_name: p.display_name }]));

  // Filter
  let filtered = subs;
  if (filterStatus) filtered = filtered.filter((s) => s.status === filterStatus);
  if (search) {
    filtered = filtered.filter((s) => {
      const p = s.user_id ? profileMap.get(s.user_id) : null;
      const courseTitle = courseMap.get(s.course_id) ?? '';
      const hay = [
        p?.email, p?.display_name, courseTitle, s.preapproval_id
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(search);
    });
  }

  // Stats
  const active = subs.filter((s) => s.status === 'authorized' || s.status === 'active');
  const monthlyActive = active.filter((s) => s.frequency === 'monthly');
  const yearlyActive = active.filter((s) => s.frequency === 'yearly');
  const mrrCents = monthlyActive.reduce((sum, s) => sum + s.amount_cents, 0) +
                   yearlyActive.reduce((sum, s) => sum + Math.round(s.amount_cents / 12), 0);
  const cancelled = subs.filter((s) => s.status === 'cancelled').length;

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title="Suscripciones"
        description="Clientes con pago recurrente activo en alguno de tus publicaciones. El dinero entra directo a tu MercadoPago."
        actions={<HeaderSecondary href="/courses">Ver publicaciones</HeaderSecondary>}
      />

      {subs.length === 0 ? (
        <EmptyState
          icon="🔁"
          title="Todavía no tenés clientes con suscripción"
          description="Para activar pagos recurrentes, andá a un publicación → Modelo de cobro → 'Suscripción mensual / anual'. Cuando alguien compre, va a aparecer acá."
          primary={{ label: 'Ver publicaciones', href: '/courses' }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Activas" value={String(active.length)} accent="emerald" />
            <Stat label="MRR estimado" value={`$ ${(mrrCents / 100).toLocaleString('es-AR')}`} accent="emerald" />
            <Stat label="Mensuales / Anuales" value={`${monthlyActive.length} / ${yearlyActive.length}`} />
            <Stat label="Canceladas" value={String(cancelled)} accent={cancelled > 0 ? 'rose' : undefined} />
          </div>

          {/* Filtros */}
          <form method="get" className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-white/50 mb-1">Buscar</label>
              <input
                type="text" name="q" defaultValue={sp.q ?? ''}
                placeholder="Nombre, email, publicación, ID externo"
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
              />
            </div>
            <div className="min-w-[160px]">
              <label className="block text-xs text-white/50 mb-1">Estado</label>
              <select name="status" defaultValue={filterStatus}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
                <option value="">Todas</option>
                <option value="authorized">Activas</option>
                <option value="pending">Pendientes</option>
                <option value="cancelled">Canceladas</option>
                <option value="paused">Pausadas</option>
              </select>
            </div>
            <button className="rounded bg-white text-black px-4 py-2 text-sm font-semibold">Filtrar</button>
            {(filterStatus || search) && (
              <a href="/suscripciones" className="text-xs text-white/50 hover:text-white/80 underline">Limpiar</a>
            )}
          </form>

          {/* Tabla */}
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 p-10 text-center text-white/45">
              Sin resultados con esos filtros.
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#0f0f0f] text-white/55 text-xs uppercase tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-3 py-2.5">Cliente</th>
                    <th className="text-left px-3 py-2.5">Publicación</th>
                    <th className="text-left px-3 py-2.5">Frecuencia</th>
                    <th className="text-right px-3 py-2.5">Monto</th>
                    <th className="text-left px-3 py-2.5">Estado</th>
                    <th className="text-left px-3 py-2.5">Próximo cobro</th>
                    <th className="text-right px-3 py-2.5">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const profile = s.user_id ? profileMap.get(s.user_id) : null;
                    const courseTitle = courseMap.get(s.course_id) ?? '—';
                    const isActive = s.status === 'authorized' || s.status === 'active';
                    return (
                      <tr key={s.id} className="border-t border-white/5">
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{profile?.display_name ?? '—'}</div>
                          {profile?.email && (
                            <a href={`mailto:${profile.email}`} className="text-xs text-white/55 hover:text-white">
                              {profile.email}
                            </a>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-white/70">{courseTitle}</td>
                        <td className="px-3 py-2.5 text-xs">
                          {s.frequency === 'monthly' ? 'Mensual' : 'Anual'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {s.currency} {(s.amount_cents / 100).toLocaleString('es-AR')}
                        </td>
                        <td className="px-3 py-2.5">
                          {s.status === 'authorized' || s.status === 'active' ? (
                            <Pill tone="success">Activa</Pill>
                          ) : s.status === 'pending' ? (
                            <Pill tone="warning">Pendiente</Pill>
                          ) : s.status === 'paused' ? (
                            <Pill tone="info">Pausada</Pill>
                          ) : (
                            <Pill tone="neutral">Cancelada</Pill>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-white/55">
                          {s.next_billing_at ? (
                            <span title={absoluteTime(s.next_billing_at)}>{relativeTime(s.next_billing_at)}</span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {isActive && (
                            <form action={cancelClientSubscriptionAction}>
                              <input type="hidden" name="subscription_id" value={s.id} />
                              <button className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10">
                                Cancelar
                              </button>
                            </form>
                          )}
                        </td>
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'emerald' | 'rose' }) {
  const color = accent === 'emerald' ? 'text-emerald-300'
    : accent === 'rose' ? 'text-rose-300' : 'text-white';
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-[10px] text-white/45 uppercase tracking-wider">{label}</div>
      <div className={`text-xl font-bold mt-1.5 font-mono ${color}`}>{value}</div>
    </div>
  );
}
