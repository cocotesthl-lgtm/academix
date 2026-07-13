'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { validatePayPalCredentials, type PayPalMode } from './client';

export type ConnectResult = { ok: true } | { ok: false; error: string };

/**
 * Guarda las credentials de PayPal del owner. Valida contra la API antes
 * de persistir para dar feedback inmediato de "Client ID/Secret ok".
 *
 * Storage layout (integrations table):
 *   provider = 'paypal'
 *   external_account_id = business email
 *   access_token_enc = client_secret (plaintext, mismo modelo que MP;
 *                     RLS bloquea lectura fuera del owner + service)
 *   metadata = { client_id, sandbox: boolean }
 *   webhook_secret = webhook_id (opcional, para Fase B)
 */
export async function connectPaypalAction(formData: FormData): Promise<ConnectResult> {
  const { tenant, userId } = await requireOwner();
  const clientId = String(formData.get('client_id') ?? '').trim();
  const clientSecret = String(formData.get('client_secret') ?? '').trim();
  const businessEmail = String(formData.get('business_email') ?? '').trim().toLowerCase();
  const sandbox = formData.get('sandbox') === 'on' || formData.get('sandbox') === 'true';
  const webhookId = String(formData.get('webhook_id') ?? '').trim() || null;
  // Moneda en que PayPal cobra al buyer. Default USD.
  const rawCurrency = String(formData.get('currency') ?? 'USD').trim().toUpperCase();
  const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : 'USD';

  if (!clientId || !clientSecret) {
    return { ok: false, error: 'Faltan Client ID y/o Client Secret.' };
  }
  if (!businessEmail || !businessEmail.includes('@')) {
    return { ok: false, error: 'Email de la cuenta business inválido.' };
  }

  const mode: PayPalMode = sandbox ? 'sandbox' : 'live';

  // Ping a PayPal para verificar credentials — falla acá antes de guardar
  // basura en la DB. UX: el owner ve el error al instante.
  const check = await validatePayPalCredentials({ clientId, clientSecret, mode });
  if (!check.ok) return { ok: false, error: check.error };

  const svc = getServiceClient();
  // Upsert por (tenant_id, provider) — existe unique
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('integrations') as any).upsert({
    tenant_id: tenant.id,
    provider: 'paypal',
    status: 'connected',
    external_account_id: businessEmail,
    access_token_enc: clientSecret,
    webhook_secret: webhookId,
    metadata: {
      client_id: clientId,
      sandbox,
      currency
    },
    updated_at: new Date().toISOString()
  }, { onConflict: 'tenant_id,provider' });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('audit_log') as any).insert({
    actor_user_id: userId,
    tenant_id: tenant.id,
    action: 'integration.connected',
    target_type: 'integration',
    after: { provider: 'paypal', sandbox, email: businessEmail }
  });

  revalidatePath('/owner/integrations');
  return { ok: true };
}
