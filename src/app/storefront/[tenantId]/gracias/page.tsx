import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';
import { ClearCartOnMount } from '@/components/storefront/products/ClearCartOnMount';

export const dynamic = 'force-dynamic';

type OrderRow = {
  id: string;
  status: string;
  total_cents: number;
  currency: string;
  buyer_email: string;
  buyer_name: string | null;
  shipping_method_label: string | null;
  shipping_address: Record<string, string> | null;
  tracking_number: string | null;
};

export default async function ThanksPage({
  params, searchParams
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ order?: string; status?: string }>;
}) {
  const { tenantId } = await params;
  const sp = await searchParams;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  let order: OrderRow | null = null;
  if (sp.order) {
    const svc = getServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('physical_orders') as any)
      .select('id, status, total_cents, currency, buyer_email, buyer_name, shipping_method_label, shipping_address, tracking_number')
      .eq('id', sp.order).eq('tenant_id', tenantId).maybeSingle();
    order = data as OrderRow | null;
  }

  const pending = sp.status === 'pending' || order?.status === 'pending';
  const paid = order?.status === 'paid';

  return (
    <article className="max-w-2xl mx-auto px-6 py-16 text-center">
      <ClearCartOnMount tenantId={tenantId} />

      <div className="text-6xl mb-4">{pending ? '⏳' : paid ? '✅' : '🎉'}</div>
      <h1 className="text-3xl font-bold mb-3">
        {pending ? 'Pago pendiente' : paid ? '¡Gracias por tu compra!' : 'Compra en proceso'}
      </h1>
      <p className="text-black/60 mb-6">
        {pending
          ? 'Estamos esperando la confirmación del pago. Vas a recibir un email cuando se acredite.'
          : 'Recibimos tu orden. Vas a recibir el detalle por email a la brevedad.'}
      </p>

      {order && (
        <div className="rounded-xl border border-black/10 bg-white p-6 text-left space-y-3 mb-8">
          <div className="text-xs uppercase tracking-wider text-black/45 font-semibold">Detalles</div>
          <div className="flex justify-between text-sm">
            <span className="text-black/55">Orden</span>
            <span className="font-mono">#{order.id.slice(0, 8)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-black/55">Email</span>
            <span>{order.buyer_email}</span>
          </div>
          {order.shipping_method_label && (
            <div className="flex justify-between text-sm">
              <span className="text-black/55">Envío</span>
              <span>{order.shipping_method_label}</span>
            </div>
          )}
          {order.shipping_address && (
            <div className="text-sm">
              <div className="text-black/55 mb-1">Dirección</div>
              <div>
                {order.shipping_address.street} {order.shipping_address.number}
                {order.shipping_address.apt && `, ${order.shipping_address.apt}`}<br />
                {order.shipping_address.city}, CP {order.shipping_address.postal_code}
              </div>
            </div>
          )}
          <div className="flex justify-between text-sm pt-3 border-t border-black/5">
            <span className="text-black/55">Total</span>
            <span className="font-bold text-base">
              {new Intl.NumberFormat('es-AR', {
                style: 'currency', currency: order.currency, maximumFractionDigits: 0
              }).format(order.total_cents / 100)}
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-3 justify-center">
        <Link href="/tienda"
          className="rounded-md border border-black/15 px-5 py-2.5 text-sm hover:bg-black/[0.03]">
          Seguir comprando
        </Link>
        <Link href="/"
          className="rounded-md bg-black text-white px-5 py-2.5 text-sm font-semibold hover:bg-black/85">
          Volver al inicio
        </Link>
      </div>
    </article>
  );
}
