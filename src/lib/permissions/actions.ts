'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { normalizePermissions } from './types';

/**
 * Guarda los permisos de un miembro del workspace. Solo el owner
 * puede llamarla. `permissions` viene como JSON string en el form.
 *
 * Formato aceptado:
 *   {"catalog":["view","edit"],"crm":["admin"], ...}
 * Módulo con array vacío o ausente = sin acceso a ese módulo.
 */
export async function setMemberPermissionsAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const userId = String(formData.get('user_id') ?? '');
  const raw = String(formData.get('permissions') ?? '{}');
  if (!userId) return;

  let parsed: unknown = null;
  try { parsed = JSON.parse(raw); } catch { parsed = null; }

  // Sanea: solo keys y actions conocidas. null si nada válido.
  const clean = normalizePermissions(parsed);

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('memberships') as any)
    .update({ permissions: clean })
    .eq('tenant_id', tenant.id).eq('user_id', userId);

  revalidatePath('/owner/equipo');
}

/**
 * Aplica un preset (owner/instructor/staff/affiliate) a un miembro.
 * Atajo para no configurar checkbox por checkbox.
 */
export async function applyMemberPresetAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const userId = String(formData.get('user_id') ?? '');
  const preset = String(formData.get('preset') ?? '');
  if (!userId) return;

  const { PERMISSION_PRESETS } = await import('./types');
  if (!(preset in PERMISSION_PRESETS)) return;
  const perms = PERMISSION_PRESETS[preset as keyof typeof PERMISSION_PRESETS];

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('memberships') as any)
    .update({ permissions: perms })
    .eq('tenant_id', tenant.id).eq('user_id', userId);

  revalidatePath('/owner/equipo');
}

