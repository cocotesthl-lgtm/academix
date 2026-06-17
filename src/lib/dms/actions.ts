'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { requireOwner } from '@/lib/auth/guards';

/**
 * DMs entre fan ↔ owner del tenant.
 * - El fan abre un thread (1 por tenant) cuando comprueba que es enrolled en algún pack.
 * - Owner/staff ven el inbox de su tenant + responden.
 * - Conteo de unread por lado para badge en sidebar.
 */

async function getOrCreateThread(tenantId: string, fanUserId: string): Promise<string | null> {
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (svc.from('dm_threads') as any)
    .select('id').eq('tenant_id', tenantId).eq('fan_user_id', fanUserId).maybeSingle();
  if (existing?.id) return existing.id as string;
  const id = randomUUID();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('dm_threads') as any).insert({
    id, tenant_id: tenantId, fan_user_id: fanUserId
  });
  if (error) return null;
  return id;
}

/**
 * Acción FAN: enviar mensaje al owner del tenant.
 * Requiere logueado + enrolled en al menos un curso del tenant
 * (validación silenciosa: si no cumple, no-op).
 */
export async function sendFanMessageAction(formData: FormData): Promise<void> {
  const tenantId = String(formData.get('tenant_id') ?? '');
  const body = String(formData.get('body') ?? '').trim().slice(0, 4000);
  if (!tenantId || !body) return;

  const supa = await createSupabaseServerClient();
  const { data: { user } } = await supa.auth.getUser();
  if (!user) return;

  const svc = getServiceClient();
  // ¿enrolled en algún curso del tenant?
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: enr } = await (svc.from('enrollments') as any)
    .select('id, courses!inner(tenant_id)')
    .eq('user_id', user.id)
    .eq('courses.tenant_id', tenantId)
    .limit(1);
  if (!enr || (enr as unknown[]).length === 0) return;

  const threadId = await getOrCreateThread(tenantId, user.id);
  if (!threadId) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('dm_messages') as any).insert({
    thread_id: threadId, sender_user_id: user.id, sender_kind: 'fan', body
  });
  // Recalcular unread del owner contando fan-msgs sin leer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: ownerUnread } = await (svc.from('dm_messages') as any)
    .select('id', { count: 'exact', head: true })
    .eq('thread_id', threadId).eq('sender_kind', 'fan').is('read_at', null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('dm_threads') as any).update({
    last_message_at: new Date().toISOString(),
    last_message_preview: body.slice(0, 120),
    unread_for_owner: ownerUnread ?? 1,
    unread_for_fan: 0
  }).eq('id', threadId);

  revalidatePath('/owner/mensajes');
}

/**
 * Acción OWNER: responder a un thread del inbox.
 */
export async function sendOwnerMessageAction(formData: FormData): Promise<void> {
  const { tenant, userId } = await requireOwner();
  const threadId = String(formData.get('thread_id') ?? '');
  const body = String(formData.get('body') ?? '').trim().slice(0, 4000);
  if (!threadId || !body) return;

  const svc = getServiceClient();
  // Verificar que el thread pertenece al tenant del owner
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: t } = await (svc.from('dm_threads') as any)
    .select('id, tenant_id').eq('id', threadId).maybeSingle();
  if (!t || t.tenant_id !== tenant.id) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('dm_messages') as any).insert({
    thread_id: threadId, sender_user_id: userId, sender_kind: 'owner', body
  });
  // Update thread: marcar todos los fan-msgs como leídos (porque owner los está respondiendo)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('dm_messages') as any).update({
    read_at: new Date().toISOString()
  }).eq('thread_id', threadId).eq('sender_kind', 'fan').is('read_at', null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: fanUnread } = await (svc.from('dm_messages') as any)
    .select('id', { count: 'exact', head: true })
    .eq('thread_id', threadId).eq('sender_kind', 'owner').is('read_at', null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('dm_threads') as any).update({
    last_message_at: new Date().toISOString(),
    last_message_preview: body.slice(0, 120),
    unread_for_owner: 0,
    unread_for_fan: fanUnread ?? 0
  }).eq('id', threadId);

  revalidatePath('/owner/mensajes');
}

/** Owner marca thread como leído al abrirlo */
export async function markThreadReadAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const threadId = String(formData.get('thread_id') ?? '');
  if (!threadId) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('dm_threads') as any).update({ unread_for_owner: 0 })
    .eq('id', threadId).eq('tenant_id', tenant.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('dm_messages') as any).update({ read_at: new Date().toISOString() })
    .eq('thread_id', threadId).eq('sender_kind', 'fan').is('read_at', null);
  revalidatePath('/owner/mensajes');
}
