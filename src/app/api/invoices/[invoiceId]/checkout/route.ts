/**
 * POST /api/invoices/[invoiceId]/checkout
 * Crea una preference MP para pagar una factura puntual. Webhook con
 * external_reference="invoice:<id>" marca la factura como pagada.
 *
 * Acepta datos del comprador via form (los del checkout_config del tenant).
 */
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getServiceClient } from '@/lib/supabase/service';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createPreference } from '@/lib/payments/mercadopago';
import { mergeCheckoutConfig } from '@/lib/checkout/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> }
) {
  const { invoiceId } = await params;

  // Usuario debe estar logueado (solo el dueño de la factura puede pagarla)
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/login?next=/mi-cuenta', req.url), { status: 303 });

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoice } = await (svc.from('customer_invoices') as any)
    .select('id, tenant_id, plan_id, user_id, concept, amount_cents, currency, status')
    .eq('id', invoiceId).maybeSingle();
  if (!invoice) return NextResponse.json({ error: 'invoice_not_found' }, { status: 404 });
  if (invoice.user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (invoice.status !== 'pending') return NextResponse.json({ error: 'invoice_not_payable' }, { status: 400 });
  if (invoice.amount_cents <= 0) return NextResponse.json({ error: 'invoice_amount_invalid' }, { status: 400 });

  // Datos del comprador del form (mismo checkout_config del tenant)
  const form = await req.formData().catch(() => null);
  const buyerInfo = {
    name:     String(form?.get('buyer_name') ?? '').trim().slice(0, 120) || null,
    dni:      String(form?.get('buyer_dni') ?? '').trim().slice(0, 30) || null,
    phone:    String(form?.get('buyer_phone') ?? '').trim().slice(0, 30) || null,
    location: String(form?.get('buyer_location') ?? '').trim().slice(0, 200) || null,
    email:    String(form?.get('buyer_email') ?? user.email ?? '').trim().toLowerCase().slice(0, 200) || null
  };
  // Extras custom (extra_<key>) — los copiamos a metadata como buyer_extra
  const buyerExtra: Record<string, unknown> = {};
  if (form) {
    for (const [k, v] of form.entries()) {
      if (k.startsWith('extra_')) buyerExtra[k.slice(6)] = v;
    }
  }

  // Resolver MP del tenant
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: integ } = await (svc.from('integrations') as any)
    .select('access_token_enc').eq('tenant_id', invoice.tenant_id)
    .eq('provider', 'mercadopago').eq('status', 'connected').maybeSingle();
  if (!integ?.access_token_enc) {
    return NextResponse.redirect(new URL(`/mi-cuenta?error=mp_not_connected`, req.url), { status: 303 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenant } = await (svc.from('tenants') as any)
    .select('slug').eq('id', invoice.tenant_id).maybeSingle();

  try {
    const h = await headers();
    const proto = (h.get('x-forwarded-proto') ?? 'http').split(',')[0];
    const host = h.get('host') ?? `${tenant?.slug ?? 'app'}.localhost:3000`;
    const origin = `${proto}://${host}`;
    const pref = await createPreference({
      accessToken: integ.access_token_enc,
      title: `Factura · ${invoice.concept}`.slice(0, 180),
      unitPriceCents: invoice.amount_cents,
      currency: invoice.currency || 'ARS',
      buyerEmail: buyerInfo.email ?? undefined,
      externalReference: `invoice:${invoice.id}`,
      notificationUrl: `${origin}/api/webhooks/mercadopago/${invoice.tenant_id}`,
      successUrl: `${origin}/mi-cuenta?invoice=ok`,
      failureUrl: `${origin}/mi-cuenta?invoice=err`,
      pendingUrl: `${origin}/mi-cuenta?invoice=pending`,
      metadata: {
        invoice_id: invoice.id,
        plan_id: invoice.plan_id,
        tenant_id: invoice.tenant_id,
        user_id: user.id,
        kind: 'invoice',
        buyer_name: buyerInfo.name,
        buyer_dni: buyerInfo.dni,
        buyer_phone: buyerInfo.phone,
        buyer_location: buyerInfo.location,
        buyer_email: buyerInfo.email,
        buyer_extra: buyerExtra
      }
    });
    // mergeCheckoutConfig unused here but consumed by ts noUnused — silenciamos
    void mergeCheckoutConfig;
    return NextResponse.redirect(pref.init_point, { status: 303 });
  } catch (e) {
    return NextResponse.redirect(new URL(`/mi-cuenta?error=mp_failed&detail=${encodeURIComponent(String(e))}`, req.url), { status: 303 });
  }
}
