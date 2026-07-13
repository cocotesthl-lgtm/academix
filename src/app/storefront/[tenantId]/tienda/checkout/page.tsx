import { notFound } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';
import { PhysicalCheckout } from '@/components/storefront/products/PhysicalCheckout';
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

  // ¿MP está conectado? Sin esto el buyer completa la dirección, apreta
  // "Pagar" y ve "mp_not_connected" en rojo. Detectamos server-side
  // y avisamos antes de que llene nada.
  let mpConnected = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: mp } = await (svc.from('integrations') as any)
      .select('id').eq('tenant_id', tenantId)
      .eq('provider', 'mercadopago').eq('status', 'connected').maybeSingle();
    mpConnected = !!mp;
  } catch { /* tabla no existe → mpConnected false */ }

  // Si MP no está, mostramos página bloqueada con instrucciones claras.
  // El checkout físico completo (con envío, dirección, etc) NO soporta
  // PayPal todavía — ese wire quedó como sprint dedicado. El buyer
  // vuelve al catálogo y prueba comprar el producto individual (que
  // puede usar PayPal si está conectado).
  if (!mpConnected) {
    return (
      <article className="max-w-2xl mx-auto px-6 py-16 text-center">
        <div className="text-5xl mb-4">🚧</div>
        <h1 className="text-2xl font-bold mb-3">Checkout no disponible</h1>
        <p className="text-black/70 mb-6 leading-relaxed">
          Este sitio todavía no configuró MercadoPago para cobrar productos físicos con envío.
          Contactá al vendedor para completar tu compra.
        </p>
        <a href="/" className="inline-block rounded-md px-6 py-3 text-white font-semibold"
          style={{ background: primary }}>
          Volver al catálogo
        </a>
      </article>
    );
  }

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
