import 'server-only';
import { getServiceClient } from '@/lib/supabase/service';

/**
 * Lógica central de validación de tickets. La usan:
 *  - POST /api/tickets/validate (desde el scanner del owner)
 *  - GET /v/[token] (link directo del QR)
 *
 * Reglas:
 *  - El que valida debe ser owner del tenant del ticket (o tener
 *    permiso explícito si es afiliado validator — Fase 4, todavía no).
 *  - Solo se valida tickets confirmed. Pending/cancelled/refunded → error.
 *  - Si validated_at ya existe y el evento NO tiene allow_ticket_reentry,
 *    devolvemos "already_used" con datos del intento anterior.
 *  - Si hay re-entry permitido, se incrementa validation_count y se
 *    actualiza validated_at al last scan.
 *
 * Acepta:
 *  - `code`: puede ser qr_token (12 chars), order_number (6 chars),
 *    o una URL completa con `/v/<token>` (lo extraemos).
 */

export type ValidationResult =
  | { ok: true; status: 're_entry'; ticket: TicketSummary; previousAt: string }
  | { ok: true; status: 'first_use'; ticket: TicketSummary }
  | { ok: false; status: 'not_found' | 'wrong_tenant' | 'not_confirmed' | 'already_used' | 'unauthorized';
      ticket?: TicketSummary; previousAt?: string }

export type TicketSummary = {
  id: string;
  order_number: string | null;
  seat_label: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  status: string;
  course_title: string;
  event_date: string;          // ISO date
  validated_at: string | null;
  validation_count: number;
  allow_reentry: boolean;
};

/**
 * Extrae el token útil del input crudo del scanner. La pistola puede
 * "tipear" el qr_token directo, una URL completa, o el order_number.
 * Devolvemos un objeto que nos diga por qué campo buscar.
 */
export function parseScannerInput(raw: string): { kind: 'token' | 'order'; value: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // URL con /v/<token>
  const urlMatch = trimmed.match(/\/v\/([A-Z0-9]{8,16})(?:[/?#]|$)/i);
  if (urlMatch) return { kind: 'token', value: urlMatch[1].toUpperCase() };
  // Solo letras/numeros sin espacios — heuristic por largo
  const clean = trimmed.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (clean.length === 12) return { kind: 'token', value: clean };
  if (clean.length === 6) return { kind: 'order', value: clean };
  // Permitimos cualquier cosa de 6-16 chars y tratamos como token (fallback)
  if (clean.length >= 6 && clean.length <= 16) {
    return { kind: clean.length <= 6 ? 'order' : 'token', value: clean };
  }
  return null;
}

/**
 * @param validatorUserId quien escanea — debe ser owner del tenant.
 * @param tenantId tenant scope para evitar cross-tenant leak.
 * @param input código crudo recibido del scanner.
 */
export async function validateTicket(opts: {
  validatorUserId: string;
  tenantId: string;
  input: string;
}): Promise<ValidationResult> {
  const parsed = parseScannerInput(opts.input);
  if (!parsed) return { ok: false, status: 'not_found' };

  const svc = getServiceClient();

  // Resolver el ticket
  const column = parsed.kind === 'token' ? 'qr_token' : 'order_number';
  const { data: ticketRaw } = await svc
    .from('event_tickets')
    .select('id, tenant_id, course_id, calendar_date_id, order_number, seat_label, buyer_name, buyer_email, status, validated_at, validation_count')
    .eq(column, parsed.value)
    .maybeSingle<{
      id: string; tenant_id: string; course_id: string; calendar_date_id: string | null;
      order_number: string | null; seat_label: string | null;
      buyer_name: string | null; buyer_email: string | null;
      status: string; validated_at: string | null; validation_count: number;
    }>();

  if (!ticketRaw) return { ok: false, status: 'not_found' };
  if (ticketRaw.tenant_id !== opts.tenantId) return { ok: false, status: 'wrong_tenant' };

  // Fetch course title + event date + reentry flag (no podemos hacer JOIN limpio)
  const { data: course } = await svc
    .from('courses').select('title').eq('id', ticketRaw.course_id).maybeSingle<{ title: string }>();
  let eventDate = '';
  let allowReentry = false;
  if (ticketRaw.calendar_date_id) {
    const { data: ev } = await svc
      .from('calendar_dates').select('date, allow_ticket_reentry')
      .eq('id', ticketRaw.calendar_date_id).maybeSingle<{ date: string; allow_ticket_reentry: boolean }>();
    eventDate = ev?.date ?? '';
    allowReentry = !!ev?.allow_ticket_reentry;
  }

  const summary: TicketSummary = {
    id: ticketRaw.id,
    order_number: ticketRaw.order_number,
    seat_label: ticketRaw.seat_label,
    buyer_name: ticketRaw.buyer_name,
    buyer_email: ticketRaw.buyer_email,
    status: ticketRaw.status,
    course_title: course?.title ?? 'Evento',
    event_date: eventDate,
    validated_at: ticketRaw.validated_at,
    validation_count: ticketRaw.validation_count,
    allow_reentry: allowReentry
  };

  if (ticketRaw.status !== 'confirmed') {
    return { ok: false, status: 'not_confirmed', ticket: summary };
  }

  // Ya usado + no se permite re-entry
  if (ticketRaw.validated_at && !allowReentry) {
    return { ok: false, status: 'already_used', ticket: summary, previousAt: ticketRaw.validated_at };
  }

  // Marcar como usado (o incrementar count si re-entry)
  const now = new Date().toISOString();
  const isReEntry = !!ticketRaw.validated_at;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('event_tickets') as any)
    .update({
      validated_at: now,
      validated_by_user_id: opts.validatorUserId,
      validation_count: ticketRaw.validation_count + 1
    })
    .eq('id', ticketRaw.id);

  return isReEntry
    ? { ok: true, status: 're_entry', ticket: { ...summary, validated_at: now, validation_count: summary.validation_count + 1 }, previousAt: ticketRaw.validated_at! }
    : { ok: true, status: 'first_use', ticket: { ...summary, validated_at: now, validation_count: 1 } };
}
