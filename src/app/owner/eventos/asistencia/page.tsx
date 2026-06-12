import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { PageHeader, HeaderSecondary } from '@/components/owner/PageHeader';
import { EmptyState } from '@/components/owner/EmptyState';

export const dynamic = 'force-dynamic';

type EventRow = {
  id: string;
  date: string;
  course_id: string;
  course_title: string;
  total: number;
  used: number;
  pending: number;
  cancelled: number;
};

export default async function TicketsUsagePage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // Eventos futuros (próximos 90 días) y pasados (últimos 30) que tengan tickets
  const todayIso = new Date().toISOString().slice(0, 10);
  const futureLimit = new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10);
  const pastLimit = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

  let upcoming: EventRow[] = [];
  let past: EventRow[] = [];

  try {
    const { data: dates } = await svc
      .from('calendar_dates')
      .select('id, date, course_id')
      .eq('tenant_id', tenant.id)
      .gte('date', pastLimit)
      .lte('date', futureLimit)
      .order('date', { ascending: true })
      .limit(200);
    const datesArr = (dates ?? []) as Array<{ id: string; date: string; course_id: string | null }>;

    if (datesArr.length > 0) {
      const dateIds = datesArr.map((d) => d.id);
      const courseIds = Array.from(new Set(datesArr.map((d) => d.course_id).filter((c): c is string => !!c)));
      const [{ data: courses }, { data: tickets }] = await Promise.all([
        svc.from('courses').select('id, title').in('id', courseIds),
        svc.from('event_tickets').select('calendar_date_id, status, validated_at').in('calendar_date_id', dateIds)
      ]);
      const courseMap = new Map(((courses ?? []) as Array<{ id: string; title: string }>).map((c) => [c.id, c.title]));
      const ticketsByDate = new Map<string, Array<{ status: string; validated_at: string | null }>>();
      for (const t of (tickets ?? []) as Array<{ calendar_date_id: string; status: string; validated_at: string | null }>) {
        if (!ticketsByDate.has(t.calendar_date_id)) ticketsByDate.set(t.calendar_date_id, []);
        ticketsByDate.get(t.calendar_date_id)!.push({ status: t.status, validated_at: t.validated_at });
      }

      for (const d of datesArr) {
        const ts = ticketsByDate.get(d.id) ?? [];
        if (ts.length === 0) continue;
        const row: EventRow = {
          id: d.id,
          date: d.date,
          course_id: d.course_id ?? '',
          course_title: d.course_id ? (courseMap.get(d.course_id) ?? 'Evento') : 'Evento',
          total: ts.filter((t) => t.status === 'confirmed').length,
          used: ts.filter((t) => t.status === 'confirmed' && !!t.validated_at).length,
          pending: ts.filter((t) => t.status === 'pending').length,
          cancelled: ts.filter((t) => t.status === 'cancelled' || t.status === 'refunded').length
        };
        if (d.date >= todayIso) upcoming.push(row);
        else past.push(row);
      }
      past = past.reverse();
    }
  } catch { /* migration 0018/0020 falta */ }

  const noEvents = upcoming.length === 0 && past.length === 0;
  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader
        title="Asistencia"
        description="Cuántas entradas validaste por evento vs cuántas vendiste — el % te dice el rate de asistencia real."
        actions={<HeaderSecondary href="/eventos/validar">Validar entradas</HeaderSecondary>}
      />

      {noEvents ? (
        <EmptyState
          icon="🎟️"
          title="Sin eventos con tickets vendidos"
          description="Cuando vendas entradas para tus eventos, vas a ver acá el % de asistencia por fecha."
          primary={{ label: 'Programar evento', href: '/eventos/calendario' }}
        />
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-3">Próximos eventos</h2>
              <EventsTable rows={upcoming} tenantSlug="" />
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-3">Eventos pasados (últimos 30 días)</h2>
              <EventsTable rows={past} tenantSlug="" />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function EventsTable({ rows }: { rows: EventRow[]; tenantSlug: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.05] text-[11px] uppercase tracking-wider text-white/55">
          <tr>
            <th className="text-left px-4 py-2">Fecha</th>
            <th className="text-left px-4 py-2">Evento</th>
            <th className="text-right px-4 py-2">Vendidos</th>
            <th className="text-right px-4 py-2">Usados</th>
            <th className="text-right px-4 py-2">% asistencia</th>
            <th className="text-right px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = r.total > 0 ? Math.round((r.used / r.total) * 100) : 0;
            return (
              <tr key={r.id} className="border-t border-white/10 hover:bg-white/[0.02] cursor-pointer">
                <td className="px-4 py-2.5 font-mono text-white/70">
                  <a href={`/eventos/${r.id}`} className="block">{r.date}</a>
                </td>
                <td className="px-4 py-2.5">
                  <a href={`/eventos/${r.id}`} className="block hover:text-white">{r.course_title}</a>
                </td>
                <td className="px-4 py-2.5 text-right font-medium">{r.total}</td>
                <td className="px-4 py-2.5 text-right font-medium text-emerald-300">{r.used}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={pct >= 80 ? 'text-emerald-300' : pct >= 50 ? 'text-amber-300' : 'text-white/55'}>
                    {pct}%
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <a href={`/eventos/${r.id}`} className="text-xs text-white/55 hover:text-white">Ver →</a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
