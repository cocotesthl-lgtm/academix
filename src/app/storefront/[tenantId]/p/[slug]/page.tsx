import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';
import { storefrontOrigin, truncate } from '@/lib/seo/meta';
import { ProductBuyBox } from '@/components/storefront/products/ProductBuyBox';
import type { PhysicalProduct, ProductVariant } from '@/lib/products/actions';

export const dynamic = 'force-dynamic';

async function loadProduct(tenantId: string, slug: string): Promise<PhysicalProduct | null> {
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('physical_products') as any)
    .select('*')
    .eq('tenant_id', tenantId).eq('slug', slug).eq('status', 'published')
    .maybeSingle();
  return (data as PhysicalProduct | null) ?? null;
}

async function loadVariants(productId: string): Promise<ProductVariant[]> {
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('product_variants') as any)
    .select('*').eq('product_id', productId).order('sort_order', { ascending: true });
  return (data ?? []) as ProductVariant[];
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ tenantId: string; slug: string }>;
}): Promise<Metadata> {
  const { tenantId, slug } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) return {};
  const product = await loadProduct(tenantId, slug);
  if (!product) return {};
  const origin = storefrontOrigin(tenant.slug);
  const url = `${origin}/p/${slug}`;
  const description = truncate(product.seo_description || product.description, 160);
  return {
    title: product.seo_title || product.title,
    description,
    openGraph: {
      type: 'website',
      title: product.title,
      description,
      url,
      siteName: tenant.name,
      images: product.cover_url ? [{ url: product.cover_url }] : undefined
    },
    twitter: {
      card: product.cover_url ? 'summary_large_image' : 'summary',
      title: product.title,
      description,
      images: product.cover_url ? [product.cover_url] : undefined
    },
    alternates: { canonical: url }
  };
}

export default async function ProductPublicPage({
  params
}: {
  params: Promise<{ tenantId: string; slug: string }>;
}) {
  const { tenantId, slug } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();
  const product = await loadProduct(tenantId, slug);
  if (!product) notFound();
  const variants = await loadVariants(product.id);

  const hasVariants = variants.length > 0;
  const totalStock = hasVariants
    ? variants.reduce((s, v) => s + v.stock_qty, 0)
    : product.stock_qty;
  const inStock = !product.track_stock || totalStock > 0;

  return (
    <article className="max-w-6xl mx-auto px-6 py-10">
      <Link href="/" className="text-sm text-black/55 hover:text-black">← Volver al inicio</Link>

      <div className="mt-6 grid md:grid-cols-2 gap-10">
        {/* Galería izquierda */}
        <div className="space-y-3">
          <div className="aspect-square rounded-2xl bg-zinc-100 overflow-hidden">
            {product.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.cover_url} alt={product.title}
                className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-black/25 text-6xl">📦</div>
            )}
          </div>
          {product.gallery.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {product.gallery.slice(0, 8).map((url, i) => (
                <div key={i} className="aspect-square rounded-lg bg-zinc-100 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Buy box derecha */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-2">{product.title}</h1>

          {!inStock && (
            <div className="inline-block bg-rose-100 text-rose-700 text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded mb-3">
              Sin stock
            </div>
          )}

          <ProductBuyBox
            tenantId={tenantId}
            product={product}
            variants={variants}
          />

          {product.description && (
            <div className="mt-8 pt-6 border-t border-black/10">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-black/55 mb-2">
                Descripción
              </h2>
              <p className="text-sm text-black/75 whitespace-pre-wrap leading-relaxed">
                {product.description}
              </p>
            </div>
          )}

          {product.sku && (
            <div className="mt-6 text-xs text-black/40">
              SKU: <span className="font-mono">{product.sku}</span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
