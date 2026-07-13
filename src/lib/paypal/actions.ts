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
  try {
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
    // Upsert por (tenant_id, provider) — existe unique. Chequeamos el error
    // explícitamente: la versión anterior tragaba silenciosamente errores
    // de RLS o de check constraint (migration 0064 pendiente).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upsertErr } = await (svc.from('integrations') as any).upsert({
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

    if (upsertErr) {
      console.error('[paypal.connect] upsert failed:', upsertErr);
      // Mensaje amigable si el motivo es el check constraint (0064 pendiente)
      if (upsertErr.message?.includes('integrations_provider_check')) {
        return {
          ok: false,
          error: 'Falta correr la migration 0064_paypal_provider. Pegala en Supabase SQL Editor desde src/db/migrations/RUN_THIS_NOW.sql.'
        };
      }
      return { ok: false, error: `No se pudo guardar la conexión: ${upsertErr.message}` };
    }

    // Audit log — nunca rompe la conexión aunque falle
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('audit_log') as any).insert({
        actor_user_id: userId,
        tenant_id: tenant.id,
        action: 'integration.connected',
        target_type: 'integration',
        after: { provider: 'paypal', sandbox, email: businessEmail }
      });
    } catch (e) {
      console.warn('[paypal.connect] audit_log insert failed (non-critical):', e);
    }

    revalidatePath('/owner/integrations');
    return { ok: true };
  } catch (e) {
    console.error('[paypal.connect] unexpected error:', e);
    const msg = e instanceof Error ? e.message : 'error inesperado';
    return { ok: false, error: `Error interno: ${msg}` };
  }
}

/**
 * Actualiza la config de conversión automática de precios locales →
 * PayPal (patrón alternativo al override por producto Hotmart-style).
 *
 * Form fields:
 *   auto_convert: 'on' | otherwise → activa/desactiva
 *   rate: número (cuántas unidades del precio local = 1 unidad PayPal)
 *   round_cents: 'on' | otherwise → si redondea al entero
 */
export async function updatePaypalAutoConvertAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const enabled = formData.get('auto_convert') === 'on' || formData.get('auto_convert') === 'true';
  const roundCents = formData.get('round_cents') === 'on' || formData.get('round_cents') === 'true';
  const rawRate = String(formData.get('rate') ?? '').replace(/[^0-9.]/g, '').trim();
  const rate = rawRate && parseFloat(rawRate) > 0 ? parseFloat(rawRate) : null;

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (svc.from('tenants') as any).update({
    paypal_auto_convert: enabled,
    paypal_conversion_rate: rate,
    paypal_round_cents: roundCents,
    updated_at: new Date().toISOString()
  }).eq('id', tenant.id);
  if (error) console.error('[paypal.autoConvert] update failed:', error);
  revalidatePath('/owner/integrations');
}
