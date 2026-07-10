import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';
import { ProductToolbar } from '@/components/owner/products/ProductToolbar';
import { ProductEditorForm } from '@/components/owner/products/ProductEditorForm';
import type { PhysicalProduct, ProductVariant } from '@/lib/products/actions';
import { getTenantPlan } from '@/lib/plans/queries';

export const dynamic = 'force-dynamic';

export default async function ProductEditPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('physical_products') as any)
    .select('*').eq('id', id).eq('tenant_id', tenant.id).maybeSingle();
  const product = data as PhysicalProduct | null;
  if (!product) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: vraw } = await (svc.from('product_variants') as any)
    .select('*').eq('product_id', product.id).order('sort_order', { ascending: true });
  const variants = (vraw ?? []) as ProductVariant[];

  const { data: catsRaw } = await svc.from('course_categories')
    .select('id, name').eq('tenant_id', tenant.id).order('position', { ascending: true });
  const categories = (catsRaw ?? []) as Array<{ id: string; name: string }>;

  // Plan del tenant: si features.uploads_enabled=true, el editor muestra
  // el uploader de videos MP4. Sino muestra card "🔒 feature premium".
  const tenantPlan = await getTenantPlan(tenant.id);
  const uploadsEnabled = tenantPlan.plan?.features?.uploads_enabled === true;
  const planName = tenantPlan.plan?.name ?? null;

  const u = new URL(env.appUrl);
  const isLocal = u.hostname === 'localhost' || u.hostname.endsWith('.localhost');
  const host = isLocal
    ? `${tenant.slug}.localhost${u.port ? ':' + u.port : ''}`
    : `${tenant.slug}.${env.rootDomain}`;
  const publicUrl = `${u.protocol}//${host}/p/${product.slug}`;

  return (
    <div className="space-y-6">
      <ProductToolbar
        productId={product.id}
        productTitle={product.title}
        productStatus={product.status}
        publicUrl={publicUrl}
      />

      {product.status !== 'published' && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/80">
          📝 En borrador — el producto no aparece en tu tienda. Tocá <strong>Publicar</strong> arriba cuando esté listo.
        </div>
      )}

      <div className="max-w-4xl">
        <ProductEditorForm
          product={product}
          variants={variants}
          categories={categories}
          uploadsEnabled={uploadsEnabled}
          planName={planName}
        />
      </div>
    </div>
  );
}
