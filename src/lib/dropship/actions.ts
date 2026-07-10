'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

/**
 * Activar / desactivar el rol supplier del tenant. Self-serve — cualquier
 * tenant activo puede prenderse el rol y empezar a publicar productos
 * mayoristas.
 */
export async function toggleSupplierRoleAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const activate = String(formData.get('activate') ?? '') === 'true';

  // Defensivo: si migration 0060 pendiente, ignoramos silencioso — el owner
  // ve la página sin toggle porque no se pudo cargar el estado.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('tenants') as any)
      .update({ is_supplier: activate, updated_at: new Date().toISOString() })
      .eq('id', tenant.id);
    revalidatePath('/owner/dropship');
  } catch (e) {
    console.error('[toggleSupplierRole]', e);
  }
}

/**
 * Actualizar el perfil del supplier (display name + bio + lead time).
 * Se muestra a los resellers en el marketplace para que sepan a quién le
 * están comprando.
 */
export async function updateSupplierProfileAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const display_name = String(formData.get('display_name') ?? '').trim().slice(0, 80) || null;
  const bio = String(formData.get('bio') ?? '').trim().slice(0, 500) || null;
  const leadRaw = Number(formData.get('lead_time_days') ?? 0);
  const lead_time_days = Number.isFinite(leadRaw) && leadRaw > 0
    ? Math.min(60, Math.round(leadRaw))
    : null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('tenants') as any)
      .update({
        supplier_display_name: display_name,
        supplier_bio: bio,
        supplier_lead_time_days: lead_time_days,
        updated_at: new Date().toISOString()
      })
      .eq('id', tenant.id);
    revalidatePath('/owner/dropship');
  } catch (e) {
    console.error('[updateSupplierProfile]', e);
  }
}
