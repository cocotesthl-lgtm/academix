import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { StudentRowActions } from "@/components/owner/StudentRowActions";

export const dynamic = "force-dynamic";

/**
 * Panel de Clientes — gente que compró cursos/eventos en la academia.
 * Antes se llamaba "Alumnos" pero terminológicamente "cliente" es más
 * consistente con todo el flujo de venta (compra → cliente → enrollment).
 *
 * NOTA: la tabla DB sigue siendo `enrollments` por compat. La
 * migración del nombre es progresiva en UI y nuevos features.
 */

type EnrollmentRow = {
  id: string;
  course_id: string;
  user_id: string;
  source: string;
  status: string;
  created_at: string;
  buyer_name: string | null;
  buyer_dni: string | null;
  buyer_location: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  buyer_extra: Record<string, unknown> | null;
  booking_date: string | null;
  booking_id: string | null;
};

type CourseRow = { id: string; title: string };
type ProfileRow = { id: string; email: string | null; display_name: string | null };

export default async function OwnerClientesPage({
  searchParams
}: {
  searchParams: Promise<{ course?: string; q?: string }>;
}) {
  const { tenant } = await requireOwner();
  const sp = await searchParams;
  const filterCourse = sp.course ?? '';
  const search = (sp.q ?? '').trim().toLowerCase();

  const svc = getServiceClient();

  let query = svc
    .from('enrollments')
    .select('id, course_id, user_id, source, status, created_at, buyer_name, buyer_dni, buyer_location, buyer_email, buyer_phone, buyer_extra, booking_date, booking_id')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false });

  if (filterCourse) {
    query = query.eq('course_id', filterCourse);
  }

  let { data: enrollmentsRaw, error: enrollErr } = await query.limit(500);
  if (enrollErr) {
    const baseQuery = svc
      .from('enrollments')
      .select('id, course_id, user_id, source, status, created_at, buyer_name, buyer_dni, buyer_location, buyer_email, buyer_phone')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });
    if (filterCourse) baseQuery.eq('course_id', filterCourse);
    const fallback = await baseQuery.limit(500);
    enrollmentsRaw = fallback.data;
  }
  const enrollments = (enrollmentsRaw ?? []) as EnrollmentRow[];

  const bookingIds = enrollments.map((e) => e.booking_id).filter(Boolean) as string[];
  const bookingMap = new Map<string, { slot_start: string; slot_end: string }>();
  if (bookingIds.length > 0) {
    try {
      const { data: bkRaw, error: bkErr } = await svc
        .from('bookings')
        .select('id, slot_start, slot_end')
        .in('id', bookingIds);
      if (!bkErr) {
        for (const b of ((bkRaw ?? []) as Array<{ id: string; slot_start: string; slot_end: string }>)) {
          bookingMap.set(b.id, { slot_start: b.slot_start, slot_end: b.slot_end });
        }
      }
    } catch { /* tabla bookings no existe */ }
  }

  const { data: coursesRaw } = await svc
    .from('courses')
    .select('id, title')
    .eq('tenant_id', tenant.id)
    .order('title');
  const courses = (coursesRaw ?? []) as CourseRow[];
  const courseMap = new Map(courses.map((c) => [c.id, c]));

  const userIds = Array.from(new Set(enrollments.map((e) => e.user_id).filter(Boolean)));
  let profileMap = new Map<string, ProfileRow>();
  if (userIds.length > 0) {
    const { data: profsRaw } = await svc
      .from('profiles')
      .select('id, email, display_name')
      .in('id', userIds);
    profileMap = new Map(((profsRaw ?? []) as ProfileRow[]).map((p) => [p.id, p]));
  }

  const filtered = search
    ? enrollments.filter((e) => {
        const hay = [
          e.buyer_name, e.buyer_dni, e.buyer_email, e.buyer_phone,
          profileMap.get(e.user_id)?.email, profileMap.get(e.user_id)?.display_name
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(search);
      })
    : enrollments;

  const uniqueClients = new Set(enrollments.map((e) => e.user_id)).size;
  const totalPurchases = enrollments.length;
  const withFullInfo = enrollments.filter((e) => e.buyer_name && e.buyer_dni && e.buyer_phone).length;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="text-white/60 text-sm mt-1">
          Datos de contacto de quienes compraron cursos o tickets.
          Vas a poder verlos también si el pago quedó pendiente.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Clientes únicos" value={uniqueClients} />
        <Stat label="Compras totales" value={totalPurchases} />
        <Stat label="Con datos completos" value={`${withFullInfo}/${totalPurchases}`} />
      </div>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-white/50 mb-1">Buscar</label>
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ''}
            placeholder="Nombre, DNI, email o teléfono"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
          />
        </div>
        <div className="min-w-[180px]">
          <label className="block text-xs text-white/50 mb-1">Curso</label>
          <select
            name="course"
            defaultValue={filterCourse}
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm"
          >
            <option value="">Todos</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
        <button className="rounded bg-white text-black px-4 py-2 text-sm font-semibold">
          Filtrar
        </button>
        {(filterCourse || search) && (
          <a href="/clientes" className="text-xs text-white/50 hover:text-white/80 underline">
            Limpiar
          </a>
        )}
      </form>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-white/50 text-sm">
            {enrollments.length === 0
              ? 'Todavía no hay clientes. Cuando alguien compre, va a aparecer acá con sus datos.'
              : 'Sin resultados con esos filtros.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-white/50 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2.5">Nombre</th>
                <th className="text-left px-3 py-2.5">DNI</th>
                <th className="text-left px-3 py-2.5">Email</th>
                <th className="text-left px-3 py-2.5">Celular</th>
                <th className="text-left px-3 py-2.5">Ubicación</th>
                <th className="text-left px-3 py-2.5">Curso</th>
                <th className="text-left px-3 py-2.5">Estado</th>
                <th className="text-left px-3 py-2.5">Fecha</th>
                <th className="text-right px-3 py-2.5">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const profile = profileMap.get(e.user_id);
                const displayName = e.buyer_name ?? profile?.display_name ?? '—';
                const displayEmail = e.buyer_email ?? profile?.email ?? '—';
                const course = courseMap.get(e.course_id);
                return (
                  <>
                  <tr key={e.id} className="border-t border-white/5">
                    <td className="px-3 py-2.5 font-medium">{displayName}</td>
                    <td className="px-3 py-2.5 text-white/70 font-mono text-xs">{e.buyer_dni ?? '—'}</td>
                    <td className="px-3 py-2.5 text-white/70">
                      {displayEmail !== '—' ? (
                        <a href={`mailto:${displayEmail}`} className="hover:text-white underline-offset-2 hover:underline">{displayEmail}</a>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-white/70">
                      {e.buyer_phone ? (
                        <a
                          href={`https://wa.me/${e.buyer_phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener"
                          className="hover:text-white underline-offset-2 hover:underline"
                        >
                          {e.buyer_phone}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-white/70">{e.buyer_location ?? '—'}</td>
                    <td className="px-3 py-2.5 text-white/70">{course?.title ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        e.status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                          : e.status === 'suspended'
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                            : 'bg-white/5 text-white/50 border border-white/15'
                      }`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-white/50 text-xs whitespace-nowrap">
                      {new Date(e.created_at).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-3 py-2.5 text-right relative">
                      <StudentRowActions enrollment={{
                        id: e.id,
                        status: e.status,
                        buyer_name: e.buyer_name,
                        buyer_dni: e.buyer_dni,
                        buyer_location: e.buyer_location,
                        buyer_phone: e.buyer_phone,
                        buyer_email: e.buyer_email
                      }} />
                    </td>
                  </tr>
                  {(() => {
                    const bk = e.booking_id ? bookingMap.get(e.booking_id) : null;
                    const hasExtras = e.buyer_extra && Object.keys(e.buyer_extra).length > 0;
                    if (!bk && !e.booking_date && !hasExtras) return null;
                    return (
                      <tr key={`${e.id}-extras`} className="border-t border-white/5">
                        <td colSpan={9} className="px-3 py-2 text-xs text-white/55 bg-white/[0.01] space-y-1">
                          {bk && (
                            <div>
                              <span className="text-white/40 mr-2">🗓️ Reserva:</span>
                              <strong className="text-emerald-300">
                                {new Date(bk.slot_start).toLocaleString('es-AR', {
                                  weekday: 'short', day: '2-digit', month: 'short',
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </strong>
                            </div>
                          )}
                          {e.booking_date && !bk && (
                            <div>
                              <span className="text-white/40 mr-2">📅 Fecha de inicio:</span>
                              <strong className="text-emerald-300">
                                {new Date(e.booking_date + 'T12:00:00').toLocaleDateString('es-AR')}
                              </strong>
                            </div>
                          )}
                          {hasExtras && (
                            <div>
                              <span className="text-white/40 mr-2">Campos extra:</span>
                              {Object.entries(e.buyer_extra!).map(([k, v], i, arr) => (
                                <span key={k}>
                                  <strong className="text-white/70">{k}</strong>:{' '}
                                  {typeof v === 'boolean' ? (v ? '✓' : '✗') : String(v)}
                                  {i < arr.length - 1 ? ' · ' : ''}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })()}</>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-white/40">
        El teléfono linkea a WhatsApp · El email a tu cliente de mail por defecto.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-xs text-white/50 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold mt-2">{value}</div>
    </div>
  );
}
