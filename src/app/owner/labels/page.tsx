import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { PageHeader } from '@/components/owner/PageHeader';
import { LabelsBuilder } from '@/components/owner/products/LabelsBuilder';

export const dynamic = 'force-dynamic';

type ProductRow = {
  id: string;
  title: string;
  sku: string | null;
  price_cents: number;
  currency: string;
  cover_url: string | null;
  status: string;
};

type VariantRow = {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  price_cents: number | null;
  image_url: string | null;
};

export default async function LabelsPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: products } = await (svc.from('physical_products') as any)
    .select('id, title, sku, price_cents, currency, cover_url, status')
    .eq('tenant_id', tenant.id)
    .order('title', { ascending: true });
  const rows = (products ?? []) as ProductRow[];

  const productIds = rows.map((p) => p.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: variants } = productIds.length > 0
    ? await (svc.from('product_variants') as any)
        .select('id, product_id, name, sku, price_cents, image_url')
        .in('product_id', productIds).order('sort_order', { ascending: true })
    : { data: [] };
  const vrows = (variants ?? []) as VariantRow[];

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Etiquetas imprimibles"
        description="Elegí cuántas etiquetas de cada producto/variante querés imprimir. Se genera una hoja A4 lista para imprimir con el código de barras del SKU."
      />
      <LabelsBuilder
        products={rows}
        variants={vrows}
      />
    </div>
  );
}
