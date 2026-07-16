'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServiceClient } from '@/lib/supabase/service';
import { requireOwner } from '@/lib/auth/guards';

export type UsersResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Acciones del panel de Usuarios /owner/usuarios y /owner/usuarios/[id].
 *
 * Todas requieren owner del tenant activo. Todas revalidan la página de
 * detalle del usuario afectado para que el owner vea el cambio inmediato.
 */

// ─── Helper: valida que el user existe (por id) o resuelve por email ──
async function resolveOrCreateUserByEmail(email: string, name?: string | null): Promise<{ id: string; created: boolean } | null> {
  const svc = getServiceClient();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (svc.from('profiles') as any)
    .select('id').eq('email', cleanEmail).maybeSingle();
  if (existing) return { id: (existing as { id: string }).id, created: false };
  // Crear en auth admin — patrón usado en paypal/process.ts y MP
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const created = await (svc.auth as any).admin.createUser({
    email: cleanEmail,
    email_confirm: true,
    user_metadata: { display_name: name?.trim() || cleanEmail.split('@')[0] }
  });
  const newId = created?.data?.user?.id as string | undefined;
  if (!newId) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('profiles') as any).upsert({
    id: newId, email: cleanEmail, display_name: name?.trim() || null
  }, { onConflict: 'id' });
  return { id: newId, created: true };
}

/**
 * Crear usuario desde el panel. Si ya existe con ese email, retorna el id
 * existente (idempotente). Redirige al detalle al terminar.
 */
export async function createUserAction(formData: FormData): Promise<void> {
  await requireOwner();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const name = String(formData.get('display_name') ?? '').trim() || null;
  if (!email) throw new Error('Email requerido');
  const res = await resolveOrCreateUserByEmail(email, name);
  if (!res) throw new Error('No se pudo crear el usuario');
  revalidatePath('/usuarios');
  revalidatePath(`/usuarios/${res.id}`);
  redirect(`/usuarios/${res.id}`);
}

/**
 * Actualizar datos del profile (display_name, email opcional).
 * El email cambia en auth.users también vía admin.updateUserById.
 */
export async function updateUserProfileAction(formData: FormData): Promise<void> {
  await requireOwner();
  const svc = getServiceClient();
  const userId = String(formData.get('user_id') ?? '');
  const displayName = String(formData.get('display_name') ?? '').trim() || null;
  const email = String(formData.get('email') ?? '').trim().toLowerCase() || null;
  if (!userId) throw new Error('user_id requerido');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('profiles') as any).update({
    display_name: displayName,
    ...(email ? { email } : {})
  }).eq('id', userId);

  if (email) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.auth.admin as any).updateUserById(userId, { email });
    } catch { /* mail change puede fallar por rate limit — silencioso */ }
  }
  revalidatePath(`/usuarios/${userId}`);
}

/**
 * Otorgar enrollment a un curso/producto sin cobro. Reutiliza el patrón
 * de grantEnrollmentAction pero por user_id directo (no email).
 */
export async function grantEnrollmentByUserAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const userId = String(formData.get('user_id') ?? '');
  const courseId = String(formData.get('course_id') ?? '');
  if (!userId || !courseId) throw new Error('user_id y course_id requeridos');

  // Validar que el curso es del tenant
  const { data: c } = await svc.from('courses')
    .select('id').eq('id', courseId).eq('tenant_id', tenant.id).maybeSingle();
  if (!c) throw new Error('Curso no pertenece a este tenant');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('enrollments') as any).insert({
    tenant_id: tenant.id,
    course_id: courseId,
    user_id: userId,
    source: 'manual_grant',
    status: 'active'
  });
  // Silenciar duplicados (idempotente)
  if (error && !error.message.includes('duplicate')) throw new Error(error.message);
  revalidatePath(`/usuarios/${userId}`);
}

/**
 * Revocar (o suspender) un enrollment específico.
 */
export async function setEnrollmentStatusForUserAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const userId = String(formData.get('user_id') ?? '');
  const enrollmentId = String(formData.get('enrollment_id') ?? '');
  const status = String(formData.get('status') ?? 'revoked');
  if (!enrollmentId) throw new Error('enrollment_id requerido');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('enrollments') as any).update({ status })
    .eq('id', enrollmentId).eq('tenant_id', tenant.id);
  revalidatePath(`/usuarios/${userId}`);
}

/**
 * Ajustar saldo del wallet del user. Positivo suma, negativo resta.
 * Crea una wallet_transaction con el concepto para trazabilidad.
 */
export async function adjustWalletAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const userId = String(formData.get('user_id') ?? '');
  const currency = String(formData.get('currency') ?? 'ARS').trim().toUpperCase();
  const amount = Number(formData.get('amount') ?? 0); // en unidades enteras (no centavos)
  const concept = String(formData.get('concept') ?? '').trim() || 'Ajuste manual';
  if (!userId) throw new Error('user_id requerido');
  if (!Number.isFinite(amount) || amount === 0) throw new Error('Monto inválido');

  const amountCents = Math.round(amount * 100);

  // Upsert wallet: sumar amount_cents al balance actual (o crear con este balance)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (svc.from('wallets') as any)
    .select('id, balance_cents')
    .eq('tenant_id', tenant.id).eq('user_id', userId).eq('currency', currency)
    .maybeSingle();

  const kind = amountCents > 0 ? 'credit' : 'debit';
  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('wallets') as any).update({
      balance_cents: existing.balance_cents + amountCents
    }).eq('id', existing.id);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('wallets') as any).insert({
      tenant_id: tenant.id, user_id: userId, currency, balance_cents: amountCents
    });
  }

  // Registrar tx
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('wallet_transactions') as any).insert({
      tenant_id: tenant.id, user_id: userId, currency,
      amount_cents: amountCents, kind, concept, source: 'manual_owner'
    });
  } catch { /* migration antigua sin wallet_transactions — no romper */ }

  revalidatePath(`/usuarios/${userId}`);
}

/**
 * Asignar un plan/suscripción al cliente. Crea customer_plan.
 */
export async function assignPlanAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const userId = String(formData.get('user_id') ?? '');
  const planName = String(formData.get('plan_name') ?? '').trim();
  const monthlyAmount = Number(formData.get('monthly_amount') ?? 0);
  const currency = String(formData.get('currency') ?? 'ARS').trim().toUpperCase();
  const description = String(formData.get('description') ?? '').trim() || null;
  if (!userId || !planName) throw new Error('user_id y plan_name requeridos');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('customer_plans') as any).insert({
    tenant_id: tenant.id,
    user_id: userId,
    plan_name: planName,
    description,
    monthly_amount_cents: Math.round(monthlyAmount * 100),
    currency,
    status: 'active',
    start_date: new Date().toISOString().slice(0, 10)
  });
  revalidatePath(`/usuarios/${userId}`);
}

/**
 * Cambiar/asignar rol de membership del user en el tenant.
 * Roles válidos según schema: owner, instructor, student, affiliate.
 * (Nuevos: admin, staff según migraciones posteriores.)
 */
export async function setUserRoleAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const userId = String(formData.get('user_id') ?? '');
  const role = String(formData.get('role') ?? '').trim();
  if (!userId || !role) throw new Error('user_id y role requeridos');

  // Upsert membership: si ya existe, reactivar; si no, insertar
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (svc.from('memberships') as any)
    .select('id, status').eq('tenant_id', tenant.id).eq('user_id', userId).eq('role', role)
    .maybeSingle();
  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('memberships') as any).update({ status: 'active' }).eq('id', existing.id);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('memberships') as any).insert({
      tenant_id: tenant.id, user_id: userId, role, status: 'active'
    });
  }
  revalidatePath(`/usuarios/${userId}`);
}

/**
 * Revocar un rol específico del user en el tenant.
 */
export async function revokeUserRoleAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const userId = String(formData.get('user_id') ?? '');
  const role = String(formData.get('role') ?? '').trim();
  if (!userId || !role) throw new Error('user_id y role requeridos');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('memberships') as any).update({ status: 'revoked' })
    .eq('tenant_id', tenant.id).eq('user_id', userId).eq('role', role);
  revalidatePath(`/usuarios/${userId}`);
}

/**
 * "Banear" al user en este tenant: revoca todos sus enrollments + memberships.
 * Actúa sólo scoped al tenant activo — el user sigue existiendo globalmente.
 */
export async function banUserFromTenantAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const userId = String(formData.get('user_id') ?? '');
  if (!userId) throw new Error('user_id requerido');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('enrollments') as any).update({ status: 'revoked' })
    .eq('tenant_id', tenant.id).eq('user_id', userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('memberships') as any).update({ status: 'revoked' })
    .eq('tenant_id', tenant.id).eq('user_id', userId);
  revalidatePath(`/usuarios/${userId}`);
  revalidatePath('/usuarios');
}
