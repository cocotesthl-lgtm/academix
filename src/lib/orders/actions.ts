'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { notifyPhysicalOrderShipped } from '@/lib/emails/dispatch';

export async function setOrderStatusAction(
  orderId: string,
  status: 'pending' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const patch: Record<string, string | null> = {
    status, updated_at: new Date().toISOString()
  };
  if (status === 'shipped') patch.shipped_at = new Date().toISOString();
  if (status === 'delivered') patch.delivered_at = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('physical_orders') as any).update(patch)
    .eq('id', orderId).eq('tenant_id', tenant.id);

  // Email al comprador cuando marcamos como enviada (con tracking si está cargado).
  // No bloquea la action — si falla el email, la transición ya quedó guardada.
  if (status === 'shipped') {
    await notifyPhysicalOrderShipped({ tenantId: tenant.id, orderId });
  }

  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
}

export async function setOrderTrackingAction(
  orderId: string,
  formData: FormData
): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const tracking = String(formData.get('tracking_number') ?? '').trim().slice(0, 100) || null;
  const trackingUrl = String(formData.get('tracking_url') ?? '').trim().slice(0, 500) || null;
  const notes = String(formData.get('notes') ?? '').trim().slice(0, 500) || null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('physical_orders') as any).update({
    tracking_number: tracking, tracking_url: trackingUrl, notes,
    updated_at: new Date().toISOString()
  }).eq('id', orderId).eq('tenant_id', tenant.id);
  revalidatePath(`/orders/${orderId}`);
}
