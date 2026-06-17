'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { isTenantBlockedBy } from '@/lib/users/blocks';

/**
 * Gestión del equipo de trabajo de un tenant.
 * Roles:
 *  - staff: vendedor / atención al cliente. Puede ver y gestionar leads del CRM.
 *  - admin: lo mismo que staff + puede invitar a otros. (Por ahora no diferenciamos UI)
 *
 * El owner siempre tiene acceso total (role='owner').
 */

const VALID_TEAM_ROLES = new Set(['staff', 'admin']);

/**
 * Invita a un usuario al equipo por email. El usuario tiene que existir ya
 * (haberse registrado en Curplat). Si no, falla silenciosamente.
 * Si el user bloqueó al tenant, también falla en silencio.
 */
export async function inviteTeamMemberAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const roleRaw = String(formData.get('role') ?? 'staff').trim();
  const role = VALID_TEAM_ROLES.has(roleRaw) ? roleRaw : 'staff';
  if (!email) return;

  const svc = getServiceClient();
  const { data: profile } = await svc
    .from('profiles').select('id').eq('email', email)
    .maybeSingle<{ id: string }>();
  if (!profile) {
    revalidatePath('/owner/equipo');
    return;
  }

  if (await isTenantBlockedBy(profile.id, tenant.id)) {
    revalidatePath('/owner/equipo');
    return;
  }

  // Buscar si ya existe esta combinación tenant+user+role
  const { data: existing } = await svc
    .from('memberships')
    .select('id, status')
    .eq('tenant_id', tenant.id)
    .eq('user_id', profile.id)
    .eq('role', role)
    .maybeSingle<{ id: string; status: string }>();

  if (existing) {
    if (existing.status !== 'active') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('memberships') as any).update({ status: 'active' }).eq('id', existing.id);
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('memberships') as any).insert({
      tenant_id: tenant.id, user_id: profile.id, role, status: 'active'
    });
  }

  revalidatePath('/owner/equipo');
}

export async function removeTeamMemberAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const userId = String(formData.get('user_id') ?? '');
  const role = String(formData.get('role') ?? 'staff');
  if (!userId) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('memberships') as any)
    .delete()
    .eq('tenant_id', tenant.id)
    .eq('user_id', userId)
    .eq('role', role);
  revalidatePath('/owner/equipo');
}
