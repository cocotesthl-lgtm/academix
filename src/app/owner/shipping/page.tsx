import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/owner/PageHeader';
import { ShippingManager } from '@/components/owner/products/ShippingManager';
import type { ShippingZone, ShippingRate } from '@/lib/shipping/types';

export const dynamic = 'force-dynamic';

export default async function ShippingPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: zonesRaw } = await (svc.from('shipping_zones') as any)
    .select('*').eq('tenant_id', tenant.id).order('sort_order', { ascending: true });
  const zones = (zonesRaw ?? []) as ShippingZone[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ratesRaw } = await (svc.from('shipping_rates') as any)
    .select('*').eq('tenant_id', tenant.id).order('sort_order', { ascending: true });
  const rates = (ratesRaw ?? []) as ShippingRate[];

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Envíos"
        description="Definí zonas por provincia y tarifas de envío. Los compradores verán solo las opciones disponibles para su provincia."
      />

      <ShippingManager zones={zones} rates={rates} />
    </div>
  );
}
