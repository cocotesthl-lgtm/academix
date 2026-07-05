import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/inventory/lookup/[tenantId]?sku=REM-M-RED
 *
 * Busca por SKU en variantes primero (más específico), después en productos.
 * Devuelve toda la info necesaria para mostrar en el scanner UI.
 * Solo owner del tenant puede llamarlo.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const url = new URL(req.url);
  const rawSku = (url.searchParams.get('sku') ?? '').trim();
  if (!rawSku) return NextResponse.json({ found: false, error: 'sku_required' }, { status: 400 });

  // Auth: solo owner del tenant
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ found: false, error: 'unauth' }, { status: 401 });
  const svc = getServiceClient();
  const { data: membership } = await svc.from('memberships')
    .select('tenant_id').eq('user_id', user.id).eq('tenant_id', tenantId)
    .eq('role', 'owner').eq('status', 'active').maybeSingle<{ tenant_id: string }>();
  if (!membership) return NextResponse.json({ found: false, error: 'forbidden' }, { status: 403 });

  // Case-insensitive: los códigos de barra a veces vienen normalizados en mayús.
  const sku = rawSku;

  // 1) Buscar en variantes (con join al producto para chequear tenant + info)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: variantRow } = await (svc.from('product_variants') as any)
    .select('id, name, sku, stock_qty, product_id, physical_products!inner(id, tenant_id, title, cover_url)')
    .ilike('sku', sku)
    .maybeSingle();
  const variant = variantRow as {
    id: string; name: string; sku: string; stock_qty: number; product_id: string;
    physical_products: { id: string; tenant_id: string; title: string; cover_url: string | null };
  } | null;
  if (variant && variant.physical_products.tenant_id === tenantId) {
    return NextResponse.json({
      found: true,
      kind: 'variant',
      product_id: variant.product_id,
      variant_id: variant.id,
      title: variant.physical_products.title,
      variant_label: variant.name,
      sku: variant.sku,
      stock_qty: variant.stock_qty,
      cover_url: variant.physical_products.cover_url
    });
  }

  // 2) Buscar en productos por SKU directo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prodRow } = await (svc.from('physical_products') as any)
    .select('id, title, sku, stock_qty, cover_url, tenant_id')
    .eq('tenant_id', tenantId).ilike('sku', sku).maybeSingle();
  const product = prodRow as {
    id: string; title: string; sku: string; stock_qty: number; cover_url: string | null;
  } | null;
  if (product) {
    return NextResponse.json({
      found: true,
      kind: 'product',
      product_id: product.id,
      variant_id: null,
      title: product.title,
      variant_label: null,
      sku: product.sku,
      stock_qty: product.stock_qty,
      cover_url: product.cover_url
    });
  }

  return NextResponse.json({ found: false, sku });
}
