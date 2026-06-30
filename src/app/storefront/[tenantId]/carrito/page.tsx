import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTenantById } from '@/lib/tenant/resolve';
import { CartFullPage } from '@/components/storefront/cart/CartFullPage';

export const dynamic = 'force-dynamic';

/**
 * Página dedicada del carrito (modo MercadoLibre).
 * Solo accesible si el owner eligió cart_display='page'. Si está en
 * 'dropdown' igual queda accesible vía URL directa.
 */
export default async function CarritoPage({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();
  const primary = tenant.brand?.primary_color ?? '#0a0a0a';

  return (
    <article className="max-w-3xl mx-auto px-6 py-10">
      <Link href="/" className="text-xs text-black/55 hover:text-black">← Volver al sitio</Link>
      <h1 className="text-3xl font-bold mt-2 mb-1">Tu carrito</h1>
      <p className="text-sm text-black/55 mb-6">
        Revisá lo que vas a comprar y pasá al pago cuando estés listo.
      </p>
      <CartFullPage tenantId={tenantId} primary={primary} />
    </article>
  );
}
