import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';
import { storefrontOrigin, truncate } from '@/lib/seo/meta';
import { ProductBuyBox } from '@/components/storefront/products/ProductBuyBox';
import { ProductGallery } from '@/components/storefront/products/ProductGallery';
import { TrackPageView } from '@/components/storefront/TrackPageView';
import type { PhysicalProduct, ProductVariant } from '@/lib/products/actions';

/** Devuelve un array de 5 slots con full/half/empty según rating (0..5). */
function starGlyphs(rating: number): Array<'full' | 'half' | 'empty'> {
  const out: Array<'full' | 'half' | 'empty'> = [];
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) out.push('full');
    else if (rating >= i - 0.5) out.push('half');
    else out.push('empty');
  }
  return out;
}

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

  // Wallet bonus del producto físico + moneda default del tenant.
  // Todo defensivo: si migration 0061/0063 no corrió, walletBonus queda null.
  let walletBonus: { cents: number; symbol: string; label: string; logoUrl?: string | null } | null = null;
  try {
    const svc = getServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pwb } = await (svc.from('physical_products') as any)
      .select('wallet_bonus_cents').eq('id', product.id).maybeSingle();
    const bonusCents = (pwb as { wallet_bonus_cents?: number | null } | null)?.wallet_bonus_cents ?? 0;
    if (bonusCents > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cur } = await (svc.from('wallet_currencies') as any)
        .select('label, symbol, logo_url')
        .eq('tenant_id', tenantId).eq('is_default', true).maybeSingle();
      walletBonus = {
        cents: bonusCents,
        symbol: cur?.symbol ?? '$',
        label: cur?.label ?? 'ARS',
        logoUrl: cur?.logo_url ?? null
      };
    }
  } catch { /* migration pendiente */ }

  return (
    <article className="max-w-6xl mx-auto px-6 py-10">
      <TrackPageView tenantId={tenantId} eventType="product_view" productId={product.id} />
      <Link href="/" className="text-sm text-black/55 hover:text-black">← Volver al inicio</Link>

      <div className="mt-6 grid md:grid-cols-2 gap-10">
        {/* Galería (client): mini vertical + zoom en hover */}
        <ProductGallery
          cover={product.cover_url}
          gallery={product.gallery ?? []}
          title={product.title}
        />

        {/* Buy box derecha */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-2">{product.title}</h1>

          {/* Rating manual (si el owner lo cargó desde el editor). Estilo ML:
              estrellas amarillas + puntuación numérica + (cantidad reseñas). */}
          {typeof product.rating === 'number' && product.rating > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-0.5" aria-label={`Rating ${product.rating} de 5`}>
                {starGlyphs(product.rating).map((g, i) => (
                  <svg key={i} width="16" height="16" viewBox="0 0 24 24"
                    className={g === 'empty' ? 'text-black/15' : 'text-amber-400'}
                    fill="currentColor" aria-hidden="true">
                    {g === 'half' ? (
                      <>
                        <defs>
                          <linearGradient id={`half-${i}`}>
                            <stop offset="50%" stopColor="currentColor" />
                            <stop offset="50%" stopColor="rgba(0,0,0,0.15)" />
                          </linearGradient>
                        </defs>
                        <polygon fill={`url(#half-${i})`}
                          points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </>
                    ) : (
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    )}
                  </svg>
                ))}
              </div>
              <span className="text-sm font-semibold text-black">{product.rating.toFixed(1)}</span>
              {product.reviews_count > 0 && (
                <span className="text-sm text-black/50">
                  ({product.reviews_count.toLocaleString('es-AR')})
                </span>
              )}
            </div>
          )}

          {!inStock && (
            <div className="inline-block bg-rose-100 text-rose-700 text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded mb-3">
              Sin stock
            </div>
          )}

          <ProductBuyBox
            tenantId={tenantId}
            product={product}
            variants={variants}
            walletBonus={walletBonus}
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
