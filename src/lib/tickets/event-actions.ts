'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

/**
 * Actions sobre event_tickets que dispara el owner desde la página de
 * detalle del evento. Todas tenant-scoped + audit-safe.
 *
 * (Las actions de soporte viven en lib/tickets/actions.ts — separadas
 * para que el nombre del archivo no confunda).
 */

/** Validación manual: para cuando el scanner falla o el cliente perdió el QR. */
export async function manualValidateTicketAction(formData: FormData): Promise<void> {
  const { tenant, userId } = await requireOwner();
  const ticketId = String(formData.get('ticket_id') ?? '');
  if (!ticketId) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('event_tickets') as any)
    .update({
      validated_at: new Date().toISOString(),
      validated_by_user_id: userId,
      validation_count: 1
    })
    .eq('id', ticketId)
    .eq('tenant_id', tenant.id);
  revalidatePath('/eventos');
}

/** Resetear validación de un ticket (validaste mal, etc). */
export async function unvalidateTicketAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const ticketId = String(formData.get('ticket_id') ?? '');
  if (!ticketId) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('event_tickets') as any)
    .update({
      validated_at: null,
      validated_by_user_id: null,
      validation_count: 0
    })
    .eq('id', ticketId)
    .eq('tenant_id', tenant.id);
  revalidatePath('/eventos');
}

/** Cancelar ticket: libera el asiento, no reembolsa plata (eso va por MP). */
export async function cancelEventTicketAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const ticketId = String(formData.get('ticket_id') ?? '');
  if (!ticketId) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('event_tickets') as any)
    .update({ status: 'cancelled' })
    .eq('id', ticketId)
    .eq('tenant_id', tenant.id);
  revalidatePath('/eventos');
}
