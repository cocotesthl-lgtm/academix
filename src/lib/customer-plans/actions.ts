'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

/* ───── Plan CRUD ───── */

export async function createCustomerPlanAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const userEmail = String(formData.get('user_email') ?? '').trim().toLowerCase();
  const planName = String(formData.get('plan_name') ?? '').trim().slice(0, 200);
  const description = String(formData.get('description') ?? '').trim().slice(0, 1000) || null;
  const monthlyPesos = parseFloat(String(formData.get('monthly_amount') ?? '0').replace(/[^0-9.]/g, '') || '0');
  if (!userEmail || !planName) return;

  const svc = getServiceClient();
  const { data: prof } = await svc.from('profiles').select('id').eq('email', userEmail).maybeSingle<{ id: string }>();
  if (!prof) return; // user no existe

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('customer_plans') as any).insert({
    tenant_id: tenant.id,
    user_id: prof.id,
    plan_name: planName,
    description,
    monthly_amount_cents: Math.round(monthlyPesos * 100),
    status: 'active'
  });
  revalidatePath('/owner/cuentas');
}

export async function updateCustomerPlanAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (formData.has('plan_name')) patch.plan_name = String(formData.get('plan_name') ?? '').trim().slice(0, 200);
  if (formData.has('description')) patch.description = String(formData.get('description') ?? '').trim().slice(0, 1000) || null;
  if (formData.has('monthly_amount')) {
    const n = parseFloat(String(formData.get('monthly_amount') ?? '0').replace(/[^0-9.]/g, '') || '0');
    patch.monthly_amount_cents = Math.round(n * 100);
  }
  if (formData.has('status')) {
    const s = String(formData.get('status') ?? '');
    if (['active', 'suspended', 'cancelled', 'finished'].includes(s)) patch.status = s;
  }
  if (formData.has('notes')) patch.notes = String(formData.get('notes') ?? '').slice(0, 2000) || null;
  if (formData.has('customer_message')) patch.customer_message = String(formData.get('customer_message') ?? '').slice(0, 2000) || null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('customer_plans') as any).update(patch).eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/cuentas');
  revalidatePath(`/owner/cuentas/${id}`);
}

export async function deleteCustomerPlanAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  await svc.from('customer_plans').delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/owner/cuentas');
}

/* ───── Invoice CRUD ───── */

export async function createInvoiceAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const planId = String(formData.get('plan_id') ?? '');
  if (!planId) return;
  const concept = String(formData.get('concept') ?? '').trim().slice(0, 200);
  const pesos = parseFloat(String(formData.get('amount') ?? '0').replace(/[^0-9.-]/g, '') || '0');
  const dueAt = String(formData.get('due_at') ?? '').trim() || null;
  const number = String(formData.get('number') ?? '').trim().slice(0, 40) || null;
  if (!concept || !Number.isFinite(pesos)) return;

  const svc = getServiceClient();
  // Necesitamos user_id del plan
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: plan } = await (svc.from('customer_plans') as any)
    .select('user_id, currency').eq('id', planId).eq('tenant_id', tenant.id).maybeSingle();
  if (!plan) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('customer_invoices') as any).insert({
    tenant_id: tenant.id,
    plan_id: planId,
    user_id: plan.user_id,
    concept,
    amount_cents: Math.round(pesos * 100),
    currency: plan.currency || 'ARS',
    due_at: dueAt && /^\d{4}-\d{2}-\d{2}$/.test(dueAt) ? dueAt : null,
    number,
    status: 'pending'
  });
  revalidatePath(`/owner/cuentas/${planId}`);
}

export async function markInvoicePaidAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const planId = String(formData.get('plan_id') ?? '');
  const method = String(formData.get('payment_method') ?? '').trim().slice(0, 40) || 'manual';
  const ref = String(formData.get('payment_ref') ?? '').trim().slice(0, 200) || null;
  if (!id) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('customer_invoices') as any).update({
    status: 'paid',
    paid_at: new Date().toISOString(),
    payment_method: method,
    payment_ref: ref
  }).eq('id', id).eq('tenant_id', tenant.id);
  if (planId) revalidatePath(`/owner/cuentas/${planId}`);
  revalidatePath('/owner/cuentas');
}

export async function cancelInvoiceAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const planId = String(formData.get('plan_id') ?? '');
  if (!id) return;
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('customer_invoices') as any).update({ status: 'cancelled' })
    .eq('id', id).eq('tenant_id', tenant.id);
  if (planId) revalidatePath(`/owner/cuentas/${planId}`);
}
