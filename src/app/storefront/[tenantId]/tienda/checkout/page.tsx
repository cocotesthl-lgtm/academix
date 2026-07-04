import { notFound } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { PhysicalCheckout } from '@/components/storefront/products/PhysicalCheckout';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  return (
    <article className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-6">Finalizar compra</h1>
      <PhysicalCheckout tenantId={tenantId} />
    </article>
  );
}
