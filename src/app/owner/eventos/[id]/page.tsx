import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { PageHeader, HeaderSecondary } from '@/components/owner/PageHeader';
import { Pill } from '@/components/owner/Pill';
import { manualValidateTicketAction, unvalidateTicketAction, cancelEventTicketAction } from '@/lib/tickets/event-actions';
import { relativeTime, absoluteTime } from '@/lib/time';

export const dynamic = 'force-dynamic';

type TicketRow = {
  id: string;
  order_number: string | null;
  qr_token: string | null;
  seat_label: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  status: string;
  validated_at: string | null;
  validation_count: number;
  created_at: string;
};

/**
 * Detalle de un evento — accesible desde /eventos/asistencia clickeando
 * una fila o desde links contextuales. Pensado como hub operativo del
 * día del show:
 *  - Stats grandes arriba (vendidos / validados / % asistencia)
 *  - Tabla detallada con cada ticket + acciones manuales
 *    (validar manual, des-validar, cancelar)
 *  - Link directo al scanner si querés ir a validar
 */
export default async function EventDetailPage({
  params, searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { id: eventId } = await params;
  const sp = await searchParams;
  const search = (sp.q ?? '').trim().toLowerCase();
  const filterStatus = sp.status ?? '';

  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // Cargar el evento + verificar que pertenece al tenant
  type EventRow = {
    id: string; date: string; start_min: number; end_min: number;
    capacity: number; seat_mode: string; course_id: string | null;
    notes: string | null; allow_ticket_reentry?: boolean;
  };
  let eventRaw: EventRow | null = null;
  try {
    const res = await svc
      .from('calendar_dates')
      .select('id, date, start_min, end_min, capacity, seat_mode, course_id, notes, allow_ticket_reentry')
      .eq('id', eventId).eq('tenant_id', tenant.id).maybeSingle();
    if (!res.error) eventRaw = res.data as EventRow | null;
  } catch { /* migration missing */ }
  if (!eventRaw) notFound();
  const event: EventRow = eventRaw;

  // Publicación asociado
  let courseTitle = 'Evento';
  if (event.course_id) {
    const { data } = await svc
      .from('courses').select('title').eq('id', event.course_id).maybeSingle<{ title: string }>();
    courseTitle = data?.title ?? courseTitle;
  }

  // Tickets de este evento
  const { data: tRaw } = await svc
    .from('event_tickets')
    .select('id, order_number, qr_token, seat_label, buyer_name, buyer_email, status, validated_at, validation_count, created_at')
    .eq('calendar_date_id', eventId)
    .order('created_at', { ascending: false });
  const tickets = (tRaw ?? []) as TicketRow[];

  // Filtros
  let filtered = tickets;
  if (filterStatus === 'validated') {
    filtered = filtered.filter((t) => !!t.validated_at && t.status === 'confirmed');
  } else if (filterStatus === 'pending_validation') {
    filtered = filtered.filter((t) => !t.validated_at && t.status === 'confirmed');
  } else if (filterStatus === 'cancelled') {
    filtered = filtered.filter((t) => t.status === 'cancelled' || t.status === 'refunded');
  } else if (filterStatus === 'unconfirmed') {
    filtered = filtered.filter((t) => t.status === 'pending');
  }
  if (search) {
    filtered = filtered.filter((t) => {
      const hay = [t.buyer_name, t.buyer_email, t.order_number, t.seat_label]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(search);
    });
  }

  // Stats
  const confirmed = tickets.filter((t) => t.status === 'confirmed');
  const validated = confirmed.filter((t) => !!t.validated_at);
  const attendanceRate = confirmed.length > 0 ? Math.round((validated.length / confirmed.length) * 100) : 0;
  const cancelled = tickets.filter((t) => t.status === 'cancelled' || t.status === 'refunded');
  const pending = tickets.filter((t) => t.status === 'pending');

  const dateLabel = new Date(event.date + 'T12:00:00').toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  const timeLabel = `${String(Math.floor(event.start_min / 60)).padStart(2, '0')}:${String(event.start_min % 60).padStart(2, '0')}`;

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title={courseTitle}
        description={`${dateLabel} · ${timeLabel} hs${event.notes ? ' · ' + event.notes : ''}`}
        back={{ label: 'Asistencia', href: '/eventos/asistencia' }}
        actions={<HeaderSecondary href="/eventos/validar">🎟️ Ir a validar</HeaderSecondary>}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="Vendidos"
          value={String(confirmed.length)}
          sub={event.capacity > 0 ? `de ${event.capacity}` : undefined}
        />
        <Stat label="Validados" value={String(validated.length)} accent="emerald" />
        <Stat
          label="% asistencia"
          value={`${attendanceRate}%`}
          accent={attendanceRate >= 80 ? 'emerald' : attendanceRate >= 50 ? 'amber' : undefined}
        />
        <Stat label="Cancelados" value={String(cancelled.length)} accent={cancelled.length > 0 ? 'rose' : undefined} />
      </div>

      {event.allow_ticket_reentry && (
        <div className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-2.5 text-sm text-fuchsia-200">
          🔄 Re-entry habilitado — los tickets se pueden escanear más de una vez.
        </div>
      )}

      {/* Filtros */}
      <form method="get" className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-white/50 mb-1">Buscar</label>
          <input
            type="text" name="q" defaultValue={sp.q ?? ''}
            placeholder="Nombre, email, N° orden o asiento"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
          />
        </div>
        <div className="min-w-[160px]">
          <label className="block text-xs text-white/50 mb-1">Estado</label>
          <select name="status" defaultValue={filterStatus}
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
            <option value="">Todos</option>
            <option value="validated">Solo validados</option>
            <option value="pending_validation">Vendidos sin validar</option>
            <option value="unconfirmed">Pago pendiente</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>
        <button className="rounded bg-white text-black px-4 py-2 text-sm font-semibold">Filtrar</button>
        {(filterStatus || search) && (
          <Link href={`/eventos/${eventId}`} className="text-xs text-white/50 hover:text-white/80 underline">Limpiar</Link>
        )}
      </form>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center text-white/45">
          {tickets.length === 0 ? 'No hay tickets vendidos para este evento todavía.' : 'Sin tickets con esos filtros.'}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#0f0f0f] text-white/50 text-xs uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-2.5">Comprador</th>
                <th className="text-left px-3 py-2.5">N° orden</th>
                <th className="text-left px-3 py-2.5">Asiento</th>
                <th className="text-left px-3 py-2.5">Estado</th>
                <th className="text-left px-3 py-2.5">Validado</th>
                <th className="text-right px-3 py-2.5">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const isValidated = !!t.validated_at && t.status === 'confirmed';
                const isConfirmed = t.status === 'confirmed';
                return (
                  <tr key={t.id} className="border-t border-white/5">
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{t.buyer_name ?? '—'}</div>
                      {t.buyer_email && (
                        <a href={`mailto:${t.buyer_email}`} className="text-xs text-white/55 hover:text-white">
                          {t.buyer_email}
                        </a>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{t.order_number ?? '—'}</td>
                    <td className="px-3 py-2.5 font-mono">{t.seat_label ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      {isValidated ? (
                        <Pill tone="success">✓ usado</Pill>
                      ) : isConfirmed ? (
                        <Pill tone="info">sin validar</Pill>
                      ) : t.status === 'pending' ? (
                        <Pill tone="warning">pago pendiente</Pill>
                      ) : (
                        <Pill tone="neutral">cancelado</Pill>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-white/55 text-xs">
                      {t.validated_at
                        ? <span title={absoluteTime(t.validated_at)}>{relativeTime(t.validated_at)}</span>
                        : '—'}
                      {t.validation_count > 1 && <div className="text-fuchsia-300 text-[10px]">×{t.validation_count} entradas</div>}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex gap-1 justify-end flex-wrap">
                        {isConfirmed && !isValidated && (
                          <form action={manualValidateTicketAction}>
                            <input type="hidden" name="ticket_id" value={t.id} />
                            <button className="text-xs px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20">
                              Validar manual
                            </button>
                          </form>
                        )}
                        {isConfirmed && isValidated && (
                          <form action={unvalidateTicketAction}>
                            <input type="hidden" name="ticket_id" value={t.id} />
                            <button className="text-xs px-2 py-1 rounded border border-white/15 hover:bg-white/5">
                              Des-validar
                            </button>
                          </form>
                        )}
                        {t.status !== 'cancelled' && t.status !== 'refunded' && (
                          <form action={cancelEventTicketAction}>
                            <input type="hidden" name="ticket_id" value={t.id} />
                            <button className="text-xs px-2 py-1 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10">
                              Cancelar
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-white/40">
        Mostrando {filtered.length} de {tickets.length} ticket{tickets.length === 1 ? '' : 's'}.
      </p>
    </div>
  );
}

function Stat({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: 'emerald' | 'rose' | 'amber';
}) {
  const color = accent === 'emerald' ? 'text-emerald-300'
    : accent === 'rose' ? 'text-rose-300'
    : accent === 'amber' ? 'text-amber-300'
    : 'text-white';
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-[10px] text-white/45 uppercase tracking-wider">{label}</div>
      <div className={`text-2xl font-bold mt-1.5 ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-white/40 mt-1">{sub}</div>}
    </div>
  );
}
