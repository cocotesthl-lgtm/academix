'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { requireOwner } from '@/lib/auth/guards';

export type TicketResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

async function requireAuthedUser(): Promise<{ id: string; isSuperAdmin: boolean }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthorized');
  const { data: prof } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .maybeSingle<{ is_super_admin: boolean }>();
  return { id: user.id, isSuperAdmin: prof?.is_super_admin ?? false };
}

export async function createTicketAction(
  _prev: TicketResult<{ id: string }> | null,
  formData: FormData
): Promise<TicketResult<{ id: string }>> {
  const { tenant, userId } = await requireOwner();
  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (!subject) return { ok: false, error: 'Asunto requerido.' };
  if (!body) return { ok: false, error: 'Mensaje requerido.' };

  const svc = getServiceClient();

  const ticketPayload = {
    tenant_id: tenant.id,
    opened_by: userId,
    subject,
    status: 'open',
    priority: 'normal',
    last_message_at: new Date().toISOString()
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ticket, error } = await (svc.from('support_tickets') as any)
    .insert(ticketPayload)
    .select('id')
    .single();
  if (error || !ticket) return { ok: false, error: error?.message ?? 'No pudimos crear el ticket.' };

  // First message
  const msgPayload = {
    ticket_id: (ticket as { id: string }).id,
    author_user_id: userId,
    body,
    attachments: []
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('ticket_messages') as any).insert(msgPayload);

  revalidatePath('/tickets');
  return { ok: true, data: { id: (ticket as { id: string }).id } };
}

export async function replyTicketAction(formData: FormData): Promise<void> {
  const user = await requireAuthedUser();
  const ticketId = String(formData.get('ticket_id') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  if (!ticketId || !body) return;

  const svc = getServiceClient();

  // Authorization: founder, or owner of the ticket's tenant, or the ticket opener
  const { data: ticket } = await svc
    .from('support_tickets')
    .select('id, tenant_id, opened_by')
    .eq('id', ticketId)
    .maybeSingle<{ id: string; tenant_id: string; opened_by: string }>();
  if (!ticket) return;

  if (!user.isSuperAdmin && ticket.opened_by !== user.id) {
    const { data: memb } = await svc
      .from('memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('tenant_id', ticket.tenant_id)
      .eq('role', 'owner')
      .eq('status', 'active')
      .maybeSingle();
    if (!memb) return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('ticket_messages') as any).insert({
    ticket_id: ticketId,
    author_user_id: user.id,
    body,
    attachments: []
  });

  // Bump last_message_at, set status='pending' if founder replied to open ticket
  const newStatus = user.isSuperAdmin ? 'pending' : 'open';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('support_tickets') as any)
    .update({ last_message_at: new Date().toISOString(), status: newStatus })
    .eq('id', ticketId);

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath('/tickets');
}

export async function setTicketStatusAction(formData: FormData): Promise<void> {
  const user = await requireAuthedUser();
  const ticketId = String(formData.get('ticket_id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!ticketId || !['open', 'pending', 'closed'].includes(status)) return;

  const svc = getServiceClient();
  const { data: ticket } = await svc
    .from('support_tickets')
    .select('tenant_id, opened_by')
    .eq('id', ticketId)
    .maybeSingle<{ tenant_id: string; opened_by: string }>();
  if (!ticket) return;
  if (!user.isSuperAdmin && ticket.opened_by !== user.id) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('support_tickets') as any).update({ status }).eq('id', ticketId);
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath('/tickets');
}

export async function createAndRedirectAction(formData: FormData): Promise<void> {
  const res = await createTicketAction(null, formData);
  if (res.ok && res.data) redirect(`/tickets/${res.data.id}`);
}
