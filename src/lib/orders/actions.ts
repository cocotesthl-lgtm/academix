'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { notifyPhysicalOrderShipped } from '@/lib/emails/dispatch';

export async function setOrderStatusAction(
  orderId: string,
  status: 'pending' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
): Promise<void> {
  const { tenant, userId } = await requireOwner();
  const svc = getServiceClient();

  // Necesitamos el status anterior para saber si tenemos que reponer stock.
  // Si venía de un estado donde el stock ya se decrementó (paid/preparing/shipped/delivered)
  // y ahora vamos a cancelled/refunded, sumamos el stock devuelta.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: current } = await (svc.from('physical_orders') as any)
    .select('status').eq('id', orderId).eq('tenant_id', tenant.id).maybeSingle();
  const prevStatus = (current as { status: string } | null)?.status;

  const patch: Record<string, string | null> = {
    status, updated_at: new Date().toISOString()
  };
  if (status === 'shipped') patch.shipped_at = new Date().toISOString();
  if (status === 'delivered') patch.delivered_at = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('physical_orders') as any).update(patch)
    .eq('id', orderId).eq('tenant_id', tenant.id);

  const stockWasDecremented = prevStatus === 'paid' || prevStatus === 'preparing' ||
    prevStatus === 'shipped' || prevStatus === 'delivered';
  const isReturning = status === 'cancelled' || status === 'refunded';

  if (stockWasDecremented && isReturning) {
    await restockOrderItems(tenant.id, orderId, status === 'refunded' ? 'return' : 'adjustment', userId);
  }

  // Email al comprador cuando marcamos como enviada (con tracking si está cargado).
  // No bloquea la action — si falla el email, la transición ya quedó guardada.
  if (status === 'shipped') {
    await notifyPhysicalOrderShipped({ tenantId: tenant.id, orderId });
  }

  revalidatePath('/orders');
  revalidatePath(`/orders/${orderId}`);
}

/**
 * Repone stock de todos los items de una orden al cancelar/reembolsar.
 * Suma qty al producto (o variante) y registra movimiento con la razón dada.
 * Best-effort: si algún item falla no bloqueamos la transición de la orden.
 */
async function restockOrderItems(
  tenantId: string,
  orderId: string,
  reason: 'return' | 'adjustment',
  actorUserId: string
): Promise<void> {
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: items } = await (svc.from('physical_order_items') as any)
    .select('product_id, variant_id, qty').eq('order_id', orderId);
  const rows = (items ?? []) as Array<{
    product_id: string | null; variant_id: string | null; qty: number;
  }>;
  for (const it of rows) {
    if (!it.product_id) continue;
    try {
      if (it.variant_id) {
        const { data: v } = await svc.from('product_variants')
          .select('stock_qty').eq('id', it.variant_id).maybeSingle<{ stock_qty: number }>();
        if (v) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (svc.from('product_variants') as any)
            .update({ stock_qty: v.stock_qty + it.qty }).eq('id', it.variant_id);
        }
      } else {
        const { data: p } = await svc.from('physical_products')
          .select('stock_qty').eq('id', it.product_id).maybeSingle<{ stock_qty: number }>();
        if (p) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (svc.from('physical_products') as any)
            .update({ stock_qty: p.stock_qty + it.qty }).eq('id', it.product_id);
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('product_stock_movements') as any).insert({
        tenant_id: tenantId,
        product_id: it.product_id,
        variant_id: it.variant_id,
        delta: it.qty,
        reason,
        order_id: orderId,
        actor_user_id: actorUserId,
        note: `Reposición por ${reason === 'return' ? 'reembolso' : 'cancelación'} de orden`
      });
    } catch { /* item skipped — sigue con el próximo */ }
  }
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
