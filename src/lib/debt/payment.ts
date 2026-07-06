'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { getOwnerBalance } from '@/lib/debt/accrue';
import { env } from '@/lib/env';

/**
 * Creates a MercadoPago Checkout Pro preference using the PLATFORM's MP token,
 * billed to the owner for the exact pending balance. Redirects to init_point.
 */
export async function payDebtAction(): Promise<void> {
  const { tenant, userId } = await requireOwner();
  const platformToken = process.env.PLATFORM_MERCADOPAGO_ACCESS_TOKEN;
  if (!platformToken) {
    throw new Error('PLATFORM_MERCADOPAGO_ACCESS_TOKEN not configured');
  }

  const balanceCents = await getOwnerBalance(tenant.id);
  if (balanceCents <= 0) {
    revalidatePath('/finance');
    return;
  }

  const platformOrigin = env.appUrl;
  const successUrl = `${platformOrigin}/owner/finance?paid=1`;
  const failureUrl = `${platformOrigin}/owner/finance?paid=failed`;
  const webhookUrl = `${platformOrigin}/api/webhooks/platform-mp`;

  const prefBody = {
    items: [
      {
        title: `OfferNow — comisión pendiente · ${tenant.name}`,
        quantity: 1,
        unit_price: balanceCents / 100,
        currency_id: 'ARS'
      }
    ],
    back_urls: { success: successUrl, failure: failureUrl, pending: successUrl },
    auto_return: 'approved',
    external_reference: `debt::${tenant.id}::${userId}::${Date.now()}`,
    notification_url: webhookUrl,
    metadata: {
      kind: 'debt_payment',
      tenant_id: tenant.id,
      amount_cents: balanceCents
    }
  };

  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${platformToken}`
    },
    body: JSON.stringify(prefBody)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`createPreference failed: ${res.status} ${txt}`);
  }
  const pref = (await res.json()) as { init_point: string };
  redirect(pref.init_point);
}
