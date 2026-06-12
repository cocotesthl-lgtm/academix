import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { getServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';
import { ticketQrUrl } from '@/lib/tickets/codes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Página pública del ticket — la abre el comprador al escanear su QR
 * con la cámara nativa del celu. Muestra QR + order_number + datos del
 * evento para que pueda mostrarla en la entrada (alternativa al email).
 *
 * NO requiere autenticación. Cualquiera con el qr_token puede ver — el
 * token es secreto-enough (12 chars random) y no incluye info sensible.
 */
export default async function PublicTicketPage({
  params
}: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const tokenClean = token.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (tokenClean.length < 6 || tokenClean.length > 16) notFound();

  const svc = getServiceClient();
  const { data: ticket } = await svc
    .from('event_tickets')
    .select('id, tenant_id, course_id, calendar_date_id, seat_label, order_number, buyer_name, buyer_email, status, validated_at, qr_token')
    .eq('qr_token', tokenClean)
    .maybeSingle<{
      id: string; tenant_id: string; course_id: string; calendar_date_id: string | null;
      seat_label: string | null; order_number: string | null;
      buyer_name: string | null; buyer_email: string | null;
      status: string; validated_at: string | null; qr_token: string;
    }>();
  if (!ticket) notFound();

  const [{ data: tenant }, { data: course }] = await Promise.all([
    svc.from('tenants').select('name, slug, brand').eq('id', ticket.tenant_id).maybeSingle<{ name: string; slug: string; brand: { primary_color?: string; logo_url?: string } | null }>(),
    svc.from('courses').select('title').eq('id', ticket.course_id).maybeSingle<{ title: string }>()
  ]);
  if (!tenant || !course) notFound();

  let eventDate = '';
  let eventTime = '';
  if (ticket.calendar_date_id) {
    const { data: ev } = await svc
      .from('calendar_dates').select('date, start_min')
      .eq('id', ticket.calendar_date_id).maybeSingle<{ date: string; start_min: number }>();
    if (ev) {
      eventDate = new Date(ev.date).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const h = Math.floor(ev.start_min / 60);
      const m = ev.start_min % 60;
      eventTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  const qrDataUrl = await QRCode.toDataURL(
    ticketQrUrl(ticket.qr_token, env.platformApiOrigin),
    { width: 320, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0f0a1e', light: '#ffffff' } }
  );

  const primary = tenant.brand?.primary_color || '#a855f7';
  const isUsed = !!ticket.validated_at;
  const isPending = ticket.status === 'pending';
  const isCancelled = ticket.status === 'cancelled' || ticket.status === 'refunded';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white text-black rounded-2xl overflow-hidden shadow-2xl">
          {/* Header con brand */}
          <div className="p-5 border-b border-black/10 text-center" style={{ background: primary }}>
            {tenant.brand?.logo_url ? (
              <img src={tenant.brand.logo_url} alt={tenant.name} className="h-10 mx-auto" />
            ) : (
              <div className="text-white font-bold text-xl">{tenant.name}</div>
            )}
          </div>

          {/* Estado del ticket */}
          {isUsed && (
            <div className="bg-red-100 border-b border-red-300 px-4 py-3 text-center text-sm font-semibold text-red-800">
              ✗ Ticket ya validado el {new Date(ticket.validated_at!).toLocaleString('es-AR')}
            </div>
          )}
          {isPending && (
            <div className="bg-amber-100 border-b border-amber-300 px-4 py-3 text-center text-sm font-semibold text-amber-800">
              ⏳ Esperando confirmación de pago
            </div>
          )}
          {isCancelled && (
            <div className="bg-zinc-100 border-b border-zinc-300 px-4 py-3 text-center text-sm font-semibold text-zinc-800">
              ✗ Ticket cancelado
            </div>
          )}

          {/* Datos del evento */}
          <div className="p-6 space-y-1 text-center">
            <h1 className="text-2xl font-bold">{course.title}</h1>
            {eventDate && (
              <p className="text-sm text-black/65">{eventDate}{eventTime ? ` · ${eventTime} hs` : ''}</p>
            )}
          </div>

          {/* QR */}
          <div className="px-6 pb-6 flex justify-center">
            <img src={qrDataUrl} alt="QR ticket" className="w-64 h-64" style={{ opacity: isUsed || isCancelled ? 0.3 : 1 }} />
          </div>

          {/* Detalles */}
          <div className="bg-black/[0.03] px-6 py-4 grid grid-cols-2 gap-3 text-sm">
            {ticket.seat_label && (<>
              <div className="text-black/55">Asiento</div>
              <div className="font-mono font-bold text-right">{ticket.seat_label}</div>
            </>)}
            <div className="text-black/55">N° de orden</div>
            <div className="font-mono font-bold text-right">{ticket.order_number}</div>
            <div className="text-black/55">Comprador</div>
            <div className="text-right truncate">{ticket.buyer_name || ticket.buyer_email || '—'}</div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 text-center text-[11px] text-black/50 border-t border-black/10">
            Mostrá esta pantalla en la entrada del evento.
          </div>
        </div>
      </div>
    </div>
  );
}
