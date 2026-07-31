'use server';

import { getServiceClient } from '@/lib/supabase/service';

/**
 * Mutaciones que interactúan con el pool demo. Implementan:
 *   - materialize*: copy-on-edit. Toma un demo y crea una row real del
 *     tenant con demo_ref = slug del demo. La row real hereda todos los
 *     campos del demo y a partir de acá el tenant edita esa copia.
 *   - hideDemo*: soft-hide. Inserta en tenant_demo_hidden. El demo global
 *     queda intacto pero deja de aparecer para ese tenant.
 *
 * Convención: los ids sintéticos "demo:{slug}" deben ser detectados por
 * el caller usando isDemoId() de queries.ts antes de llamar acá.
 */

// ── ARTICLES ─────────────────────────────────────────────────────────

/** Materializa un demo article a una row real del tenant. Idempotente:
 * si ya existe una row con demo_ref = slug, devuelve el id existente. */
export async function materializeDemoArticle(tenantId: string, demoSlug: string): Promise<string | null> {
  const svc = getServiceClient();

  // Idempotencia: ya existe versión real?
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (svc.from('articles') as any)
    .select('id').eq('tenant_id', tenantId).eq('demo_ref', demoSlug).maybeSingle();
  if (existing) return (existing as { id: string }).id;

  // Cargar el demo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: demo } = await (svc.from('demo_articles') as any)
    .select('slug, title, excerpt, cover_url, body_html, author_name, category_slug, published_at')
    .eq('slug', demoSlug).maybeSingle();
  if (!demo) return null;
  const d = demo as {
    slug: string; title: string; excerpt: string | null; cover_url: string | null;
    body_html: string; author_name: string | null; category_slug: string | null;
    published_at: string;
  };

  // Resolver category_id: buscamos en course_categories del tenant una con
  // demo_ref = d.category_slug, o slug = d.category_slug directo.
  let categoryId: string | null = null;
  if (d.category_slug) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: cat } = await (svc.from('course_categories') as any)
      .select('id').eq('tenant_id', tenantId)
      .or(`slug.eq.${d.category_slug},demo_ref.eq.${d.category_slug}`)
      .maybeSingle();
    categoryId = (cat as { id?: string } | null)?.id ?? null;
    // Si no existe, primero materializamos la categoría demo.
    if (!categoryId) {
      categoryId = await materializeDemoCategory(tenantId, d.category_slug);
    }
  }

  // Insertar la copia real. slug se prefija con "custom-" si ya existe uno
  // igual para evitar violar UNIQUE (tenant_id, slug).
  let slug = d.slug;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dup } = await (svc.from('articles') as any)
    .select('id').eq('tenant_id', tenantId).eq('slug', slug).maybeSingle();
  if (dup) slug = `${d.slug}-custom-${Date.now().toString(36).slice(-6)}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (svc.from('articles') as any).insert({
    tenant_id: tenantId,
    slug,
    title: d.title,
    excerpt: d.excerpt,
    cover_url: d.cover_url,
    body_html: d.body_html,
    author_name: d.author_name,
    category_id: categoryId,
    status: 'published',
    published_at: d.published_at,
    demo_ref: d.slug
  }).select('id').single();
  if (error) {
    console.warn('[materializeDemoArticle] insert falló:', error.message);
    return null;
  }
  return (inserted as { id: string }).id;
}

/** Esconder un demo article. */
export async function hideDemoArticle(tenantId: string, demoSlug: string): Promise<void> {
  await hideDemo(tenantId, 'article', demoSlug);
}

// ── CATEGORIES ───────────────────────────────────────────────────────

/** Materializa una demo category. Recursivo: si tiene parent_slug demo,
 * primero materializa el padre. */
export async function materializeDemoCategory(tenantId: string, demoSlug: string): Promise<string | null> {
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (svc.from('course_categories') as any)
    .select('id').eq('tenant_id', tenantId).eq('demo_ref', demoSlug).maybeSingle();
  if (existing) return (existing as { id: string }).id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: demo } = await (svc.from('demo_course_categories') as any)
    .select('slug, name, parent_slug, position, is_featured, accent_color')
    .eq('slug', demoSlug).maybeSingle();
  if (!demo) return null;
  const d = demo as {
    slug: string; name: string; parent_slug: string | null;
    position: number; is_featured: boolean; accent_color: string | null;
  };

  // Materializar padre si existe
  let parentId: string | null = null;
  if (d.parent_slug) {
    parentId = await materializeDemoCategory(tenantId, d.parent_slug);
  }

  // Slug único
  let slug = d.slug;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dup } = await (svc.from('course_categories') as any)
    .select('id').eq('tenant_id', tenantId).eq('slug', slug).maybeSingle();
  if (dup) slug = `${d.slug}-custom-${Date.now().toString(36).slice(-6)}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (svc.from('course_categories') as any).insert({
    tenant_id: tenantId, slug, name: d.name,
    parent_id: parentId, position: d.position,
    is_featured: d.is_featured, demo_ref: d.slug
  }).select('id').single();
  if (error) {
    console.warn('[materializeDemoCategory] insert falló:', error.message);
    return null;
  }
  return (inserted as { id: string }).id;
}

/** Esconder una demo category. */
export async function hideDemoCategory(tenantId: string, demoSlug: string): Promise<void> {
  await hideDemo(tenantId, 'course_category', demoSlug);
}

// ── PHYSICAL PRODUCTS ────────────────────────────────────────────────

export async function materializeDemoPhysicalProduct(tenantId: string, demoSlug: string): Promise<string | null> {
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (svc.from('physical_products') as any)
    .select('id').eq('tenant_id', tenantId).eq('demo_ref', demoSlug).maybeSingle();
  if (existing) return (existing as { id: string }).id;

  // Traemos también los campos "ricos" (migration 0090). Si no existen en
  // este entorno, el select falla y reintentamos con el subset básico.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: demo } = await (svc.from('demo_physical_products') as any)
    .select('slug, title, description, cover_url, gallery, price_cents, compare_at_price_cents, stock_qty, category_slug, condition, installments_max, installments_interest_free, reviews_breakdown, qty_selector_enabled, specs')
    .eq('slug', demoSlug).maybeSingle();
  if (!demo) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const retry = await (svc.from('demo_physical_products') as any)
      .select('slug, title, description, cover_url, gallery, price_cents, compare_at_price_cents, stock_qty, category_slug')
      .eq('slug', demoSlug).maybeSingle();
    demo = retry.data;
  }
  if (!demo) return null;
  const d = demo as {
    slug: string; title: string; description: string | null;
    cover_url: string | null; gallery: unknown;
    price_cents: number; compare_at_price_cents: number | null;
    stock_qty: number; category_slug: string | null;
    condition?: string | null;
    installments_max?: number | null;
    installments_interest_free?: number | null;
    reviews_breakdown?: number[] | null;
    qty_selector_enabled?: boolean | null;
    specs?: Array<{ label: string; value: string }> | null;
  };

  let slug = d.slug;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dup } = await (svc.from('physical_products') as any)
    .select('id').eq('tenant_id', tenantId).eq('slug', slug).maybeSingle();
  if (dup) slug = `${d.slug}-custom-${Date.now().toString(36).slice(-6)}`;

  const base: Record<string, unknown> = {
    tenant_id: tenantId, slug, title: d.title,
    description: d.description, cover_url: d.cover_url,
    gallery: d.gallery ?? [],
    price_cents: d.price_cents,
    compare_at_price_cents: d.compare_at_price_cents,
    stock_qty: d.stock_qty,
    status: 'published',
    demo_ref: d.slug
  };
  const withRich: Record<string, unknown> = { ...base };
  if (d.condition) withRich.condition = d.condition;
  if (d.installments_max != null) withRich.installments_max = d.installments_max;
  if (d.installments_interest_free != null) withRich.installments_interest_free = d.installments_interest_free;
  if (Array.isArray(d.reviews_breakdown) && d.reviews_breakdown.length > 0) withRich.reviews_breakdown = d.reviews_breakdown;
  if (typeof d.qty_selector_enabled === 'boolean') withRich.qty_selector_enabled = d.qty_selector_enabled;
  if (Array.isArray(d.specs) && d.specs.length > 0) withRich.specs = d.specs;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: inserted, error } = await (svc.from('physical_products') as any)
    .insert(withRich).select('id').single();
  if (error && /condition|installments|reviews_breakdown|qty_selector_enabled|specs/.test(error.message ?? '')) {
    // Migration 0090 no corrió en physical_products → retry con base
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const retry = await (svc.from('physical_products') as any)
      .insert(base).select('id').single();
    inserted = retry.data;
    error = retry.error;
  }
  if (error) {
    console.warn('[materializeDemoPhysicalProduct] insert falló:', error.message);
    return null;
  }
  return (inserted as { id: string }).id;
}

export async function hideDemoPhysicalProduct(tenantId: string, demoSlug: string): Promise<void> {
  await hideDemo(tenantId, 'physical_product', demoSlug);
}

// ── HELPER: hide genérico ────────────────────────────────────────────

async function hideDemo(tenantId: string, resourceType: string, demoSlug: string): Promise<void> {
  const svc = getServiceClient();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('tenant_demo_hidden') as any).upsert({
      tenant_id: tenantId, resource_type: resourceType, demo_slug: demoSlug
    }, { onConflict: 'tenant_id,resource_type,demo_slug', ignoreDuplicates: true });
  } catch (e) {
    console.warn('[hideDemo] insert falló:', e);
  }
}
