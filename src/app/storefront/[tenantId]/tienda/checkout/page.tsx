import { notFound } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';
import { PhysicalCheckout } from '@/components/storefront/products/PhysicalCheckout';
import { PayPalCartCheckout } from '@/components/storefront/products/PayPalCartCheckout';
import { mergeCheckoutConfig } from '@/lib/checkout/types';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  // Cargamos la checkout_config para pasar el design overrides al component.
  // Defensivo: si la columna no existe o el JSON está vacío, cae al default
  // y el checkout se pinta con el primary del tenant.
  const svc = getServiceClient();
  let designOverride: { cta_color?: string | null; accent_color?: string | null; card_style?: 'rounded' | 'square' | null } | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('tenants') as any)
      .select('checkout_config').eq('id', tenantId).maybeSingle();
    const cfg = mergeCheckoutConfig((data as { checkout_config?: unknown } | null)?.checkout_config);
    designOverride = cfg.design ? {
      cta_color: cfg.design.cta_color ?? null,
      accent_color: cfg.design.accent_color ?? null,
      card_style: cfg.design.card_style ?? null
    } : undefined;
  } catch { /* checkout_config col puede no existir; ok */ }

  const brand = tenant.brand ?? {};
  const primary = brand.primary_color ?? '#111827';

  // Detectamos MP + PayPal server-side. Prioridad:
  //   1. Si MP está conectado → PhysicalCheckout completo (con promos,
  //      gift cards, shipping rate calc, etc)
  //   2. Si solo PayPal → PayPalCartCheckout (scope reducido)
  //   3. Si ninguno → aviso "Checkout no disponible"
  let mpConnected = false;
  let paypalConfig: { clientId: string; sandbox: boolean; currency: string } | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mp } = await (svc.from('integrations') as any)
      .select('id').eq('tenant_id', tenantId)
      .eq('provider', 'mercadopago').eq('status', 'connected').maybeSingle();
    mpConnected = !!mp;
  } catch { /* tabla no existe */ }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pp } = await (svc.from('integrations') as any)
      .select('metadata').eq('tenant_id', tenantId)
      .eq('provider', 'paypal').eq('status', 'connected').maybeSingle();
    const meta = pp?.metadata as { client_id?: string; sandbox?: boolean; currency?: string } | undefined;
    if (meta?.client_id) {
      paypalConfig = {
        clientId: meta.client_id,
        sandbox: !!meta.sandbox,
        currency: (meta.currency || 'USD').toUpperCase()
      };
    }
  } catch { /* migration */ }

  if (mpConnected) {
    return (
      <article className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-6">Finalizar compra</h1>
        <PhysicalCheckout
          tenantId={tenantId}
          tenantPrimary={primary}
          design={designOverride}
        />
      </article>
    );
  }

  if (paypalConfig) {
    return (
      <article className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-bold mb-6">Finalizar compra</h1>
        <PayPalCartCheckout
          tenantId={tenantId}
          primary={primary}
          paypalClientId={paypalConfig.clientId}
          paypalSandbox={paypalConfig.sandbox}
          paypalCurrency={paypalConfig.currency}
        />
      </article>
    );
  }

  return (
    <article className="max-w-2xl mx-auto px-6 py-16 text-center">
      <div className="text-5xl mb-4">🚧</div>
      <h1 className="text-2xl font-bold mb-3">Checkout no disponible</h1>
      <p className="text-black/70 mb-6 leading-relaxed">
        Este sitio todavía no configuró un método de pago. Contactá al vendedor para completar tu compra.
      </p>
      <a href="/" className="inline-block rounded-md px-6 py-3 text-white font-semibold"
        style={{ background: primary }}>
        Volver al catálogo
      </a>
    </article>
  );
}
