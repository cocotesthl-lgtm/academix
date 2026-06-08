'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

/**
 * El user bloquea una academia. Efectos:
 *  1. Inserta el bloqueo (UNIQUE protege duplicados).
 *  2. Desactiva TODAS sus memberships en ese tenant
 *     (affiliate, instructor, student, owner — todas).
 *  3. Borra sus asignaciones de cursos como instructor.
 *  4. Su existencia desaparece para la academia: ni en listas, ni se
 *     puede re-agregar (addInstructorAction lo filtra).
 *
 * Ventas históricas y links de afiliado existentes NO se tocan
 * (cobros y comisiones ya generadas siguen su curso).
 */
export async function blockTenantAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const tenantId = String(formData.get('tenant_id') ?? '');
  const reason = String(formData.get('reason') ?? '').slice(0, 300) || null;
  if (!tenantId) return;
  const svc = getServiceClient();

  // 1) Insertar el bloqueo (upsert para idempotencia)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('user_tenant_blocks') as any).upsert(
    { user_id: user.id, tenant_id: tenantId, reason },
    { onConflict: 'user_id,tenant_id' }
  );

  // 2) Desactivar memberships activas (excepto owner — no podés bloquear
  // una academia que vos mismo administrás como owner)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('memberships') as any)
    .update({ status: 'inactive' })
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .neq('role', 'owner');

  // 3) Limpiar asignaciones de cursos como instructor
  await svc.from('course_instructors').delete()
    .eq('user_id', user.id).eq('tenant_id', tenantId);

  revalidatePath('/affiliate');
  revalidatePath('/instructor');
}

export async function unblockTenantAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const tenantId = String(formData.get('tenant_id') ?? '');
  if (!tenantId) return;
  const svc = getServiceClient();
  await svc.from('user_tenant_blocks').delete()
    .eq('user_id', user.id).eq('tenant_id', tenantId);
  revalidatePath('/affiliate');
  revalidatePath('/instructor');
}

/**
 * Devuelve true si el user bloqueó al tenant. Usado por addInstructorAction
 * para hacerse el desentendido (devuelve igual que si no existiera el email).
 */
export async function isTenantBlockedBy(userId: string, tenantId: string): Promise<boolean> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('user_tenant_blocks')
    .select('id')
    .eq('user_id', userId).eq('tenant_id', tenantId)
    .maybeSingle<{ id: string }>();
  return !!data;
}
