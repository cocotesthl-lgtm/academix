import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Tiempo de vida de un ticket en estado 'pending' antes de considerarlo
 * abandonado. 15 min es menor que el TTL default de las preferences de MP
 * (~30 min), así que después de este tiempo el comprador ya no puede pagar
 * por esa preference y el asiento queda bloqueado de gusto.
 *
 * Cuando un pending pasa este TTL, lo marcamos cancelled — liberando el
 * UNIQUE index `event_tickets_no_double_seat` para que otro comprador
 * pueda tomar el mismo asiento.
 */
export const PENDING_TICKET_TTL_MIN = 15;

/** ISO timestamp del cutoff: tickets pending con created_at < este valor son stale. */
export function pendingCutoffIso(): string {
  return new Date(Date.now() - PENDING_TICKET_TTL_MIN * 60_000).toISOString();
}

/**
 * Marca como 'cancelled' todos los tickets pending de una fecha de evento
 * que tengan más de PENDING_TICKET_TTL_MIN minutos. Liberar el UNIQUE
 * permite que otros compradores tomen esos asientos.
 *
 * Idempotente — si no hay stale tickets, no hace nada. Defensivo: errores
 * se loguean pero no rompen el flujo del caller.
 *
 * Llamar ANTES de:
 *  - Calcular capacidad disponible (storefront page, checkout capacity check)
 *  - Insertar nuevos tickets pending (checkout endpoint)
 */
export async function cleanupStalePendingTicketsForDate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svc: SupabaseClient<any, any, any>,
  calendarDateId: string
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('event_tickets') as any)
      .update({ status: 'cancelled' })
      .eq('calendar_date_id', calendarDateId)
      .eq('status', 'pending')
      .lt('created_at', pendingCutoffIso());
  } catch (e) {
    console.error('[seat-cleanup] cleanupStalePendingTicketsForDate fallo:', e);
  }
}

/** Cleanup global — pensado para correr en un cron periódico (cada 30 min). */
export async function cleanupAllStalePendingTickets(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  svc: SupabaseClient<any, any, any>
): Promise<{ updated: number }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('event_tickets') as any)
      .update({ status: 'cancelled' })
      .eq('status', 'pending')
      .lt('created_at', pendingCutoffIso())
      .select('id');
    return { updated: Array.isArray(data) ? data.length : 0 };
  } catch (e) {
    console.error('[seat-cleanup] cleanupAllStalePendingTickets fallo:', e);
    return { updated: 0 };
  }
}
