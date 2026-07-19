import { getServiceClient } from '@/lib/supabase/service';

/**
 * Capa demo-pool: unifica lecturas de tenant + demo pool global.
 *
 * Cada helper devuelve la UNION de:
 *   1. Rows reales del tenant (tabla X)
 *   2. Rows del pool global (demo_X) que no están:
 *      - Escondidas por este tenant (tenant_demo_hidden)
 *      - Customizadas por este tenant (X.demo_ref = demo.slug)
 *
 * Los demos se identifican por prefijo "demo:" en el id devuelto,
 * para que las UIs puedan distinguir "esto es del pool global" de
 * "esto es real del tenant" sin cambiar tipos.
 *
 * Fallback: si alguna migration del pool no corrió (demo_articles no
 * existe, columna demo_ref no existe), catcheamos y devolvemos solo
 * lo real del tenant — el sitio sigue funcionando con lo que haya.
 */

export type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  author_name: string | null;
  published_at: string;
  category_id: string | null;
  category_slug?: string | null;
  category_name?: string | null;
  /** YouTube video ID opcional que reemplaza la cover en posiciones featured. */
  youtube_video_id?: string | null;
  /** Tags libres — usados por featured_event para agrupar notas de un evento. */
  tags?: string[] | null;
  /** True cuando la row viene del pool global (no del tenant). */
  is_demo?: boolean;
  /** El slug del demo original (para tracking / copy-on-edit). */
  demo_slug?: string | null;
};

export type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  parent_slug?: string | null;
  accent_color?: string | null;
  is_demo?: boolean;
};

export type VideoRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  youtube_id: string;
  category_slug?: string | null;
  category_name?: string | null;
  position: number;
  is_featured?: boolean;
  is_demo?: boolean;
};

export type PhysicalProductRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  stock_qty: number;
  currency: string;
  status: string;
  category_id?: string | null;
  is_demo?: boolean;
};

/**
 * Fetch categorías efectivas del tenant: reales + demos visibles.
 * Los demos vienen con id sintético "demo:{slug}" para no colisionar.
 */
export async function fetchCategoriesForTenant(tenantId: string): Promise<CategoryRow[]> {
  const svc = getServiceClient();
  const out: CategoryRow[] = [];

  // 1. Reales del tenant
  const realDemoRefs = new Set<string>();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('course_categories') as any)
      .select('id, slug, name, parent_id, demo_ref')
      .eq('tenant_id', tenantId)
      .order('position', { ascending: true });
    for (const c of ((data ?? []) as Array<{ id: string; slug: string; name: string; parent_id: string | null; demo_ref: string | null }>)) {
      out.push({ id: c.id, slug: c.slug, name: c.name, parent_id: c.parent_id, is_demo: false });
      if (c.demo_ref) realDemoRefs.add(c.demo_ref);
    }
  } catch { /* migration 0054 tal vez pendiente; sin demos igual */ }

  // 2. Demos globales (menos hidden + menos customizados)
  try {
    const hiddenSet = await getHiddenSet(tenantId, 'course_category');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: demos } = await (svc.from('demo_course_categories') as any)
      .select('id, slug, name, parent_slug, accent_color, position')
      .order('position', { ascending: true });
    // Resolvemos parent_id de demos usando otros demos ya cargados.
    // Como parent_slug apunta a otro demo, el parent_id sintético es "demo:{parent_slug}".
    for (const d of ((demos ?? []) as Array<{ id: string; slug: string; name: string; parent_slug: string | null; accent_color: string | null }>)) {
      if (hiddenSet.has(d.slug)) continue;
      if (realDemoRefs.has(d.slug)) continue;  // ya customizada por el tenant
      out.push({
        id: `demo:${d.slug}`,
        slug: d.slug,
        name: d.name,
        parent_id: d.parent_slug ? `demo:${d.parent_slug}` : null,
        parent_slug: d.parent_slug,
        accent_color: d.accent_color,
        is_demo: true
      });
    }
  } catch { /* migration 0067 pendiente; sin pool */ }

  return out;
}

/**
 * Fetch artículos del tenant + demos visibles. `filters` permite acotar
 * por category_slug (busca en real y en demo). El límite es aproximado
 * (se aplica DESPUÉS del merge para respetar prioridad real > demo).
 */
export async function fetchArticlesForTenant(
  tenantId: string,
  opts: { limit?: number; categorySlug?: string | null } = {}
): Promise<ArticleRow[]> {
  const svc = getServiceClient();
  const limit = Math.max(1, Math.min(100, opts.limit ?? 50));
  const out: ArticleRow[] = [];

  // Cargar categorías del tenant para poder resolver category_slug/name
  // sin hacer una query extra por artículo.
  const cats = await fetchCategoriesForTenant(tenantId);
  const catBySlug = new Map(cats.map((c) => [c.slug, c]));
  const catById = new Map(cats.map((c) => [c.id, c]));
  const targetCat = opts.categorySlug ? catBySlug.get(opts.categorySlug) : null;

  // 1. Reales del tenant — query defensiva por columnas youtube_video_id
  //    y tags (migrations 0074 / 0069 pueden no estar corridas todavía).
  //    Prueba en cascada: (all cols) → (sin tags) → (sin ambos).
  const realDemoRefs = new Set<string>();
  async function selectRealArticles(): Promise<Array<{ id: string; slug: string; title: string; excerpt: string | null; cover_url: string | null; author_name: string | null; published_at: string; category_id: string | null; demo_ref: string | null; youtube_video_id?: string | null; tags?: string[] | null }>> {
    const baseCols = 'id, slug, title, excerpt, cover_url, author_name, published_at, category_id, demo_ref';
    for (const cols of [`${baseCols}, youtube_video_id, tags`, `${baseCols}, youtube_video_id`, `${baseCols}, tags`, baseCols]) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q: any = (svc.from('articles') as any).select(cols)
          .eq('tenant_id', tenantId).eq('status', 'published')
          .order('published_at', { ascending: false }).limit(limit);
        if (targetCat && !targetCat.is_demo) q = q.eq('category_id', targetCat.id);
        const r = await q;
        if (!r.error) return (r.data ?? []) as never;
      } catch { /* fallthrough */ }
    }
    return [];
  }
  for (const a of await selectRealArticles()) {
    const cat = a.category_id ? catById.get(a.category_id) : null;
    out.push({
      id: a.id, slug: a.slug, title: a.title, excerpt: a.excerpt,
      cover_url: a.cover_url, author_name: a.author_name,
      published_at: a.published_at, category_id: a.category_id,
      category_slug: cat?.slug ?? null, category_name: cat?.name ?? null,
      youtube_video_id: a.youtube_video_id ?? null,
      tags: Array.isArray(a.tags) ? a.tags : null,
      is_demo: false
    });
    if (a.demo_ref) realDemoRefs.add(a.demo_ref);
  }

  // 2. Demos globales — misma query defensiva por youtube_video_id + tags
  try {
    const hiddenSet = await getHiddenSet(tenantId, 'article');
    const baseColsDemo = 'id, slug, title, excerpt, cover_url, author_name, published_at, category_slug';
    let demos: Array<{ id: string; slug: string; title: string; excerpt: string | null; cover_url: string | null; author_name: string | null; published_at: string; category_slug: string | null; youtube_video_id?: string | null; tags?: string[] | null }> = [];
    for (const cols of [`${baseColsDemo}, youtube_video_id, tags`, `${baseColsDemo}, youtube_video_id`, `${baseColsDemo}, tags`, baseColsDemo]) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q: any = (svc.from('demo_articles') as any).select(cols)
          .eq('status', 'published').order('published_at', { ascending: false }).limit(limit);
        if (targetCat && targetCat.is_demo) q = q.eq('category_slug', targetCat.slug);
        else if (targetCat && !targetCat.is_demo) q = q.eq('category_slug', '_never_match_');
        const r = await q;
        if (!r.error) { demos = (r.data ?? []) as never; break; }
      } catch { /* fallthrough */ }
    }
    for (const d of demos) {
      if (hiddenSet.has(d.slug)) continue;
      if (realDemoRefs.has(d.slug)) continue;
      const cat = d.category_slug ? catBySlug.get(d.category_slug) : null;
      out.push({
        id: `demo:${d.slug}`,
        slug: d.slug, title: d.title, excerpt: d.excerpt,
        cover_url: d.cover_url, author_name: d.author_name,
        published_at: d.published_at,
        category_id: cat?.id ?? null,
        category_slug: d.category_slug,
        category_name: cat?.name ?? null,
        youtube_video_id: d.youtube_video_id ?? null,
        tags: Array.isArray(d.tags) ? d.tags : null,
        is_demo: true,
        demo_slug: d.slug
      });
    }
  } catch { /* ignore */ }

  // Merge sort por published_at DESC + cap al limit
  out.sort((a, b) => b.published_at.localeCompare(a.published_at));
  return out.slice(0, limit);
}

/**
 * Fetch videos del tenant + demos visibles (pool global). Devuelve
 * ordenados por position ASC. Cada demo viene con id sintético
 * "demo:{slug}" para materialize-on-edit.
 */
export async function fetchVideosForTenant(
  tenantId: string,
  opts: { limit?: number } = {}
): Promise<VideoRow[]> {
  const svc = getServiceClient();
  const limit = Math.max(1, Math.min(50, opts.limit ?? 20));
  const out: VideoRow[] = [];

  const realDemoRefs = new Set<string>();
  // Query defensiva — is_featured requiere migration 0073, retry sin él
  async function selectVideosWithFallback(tbl: string, tenantFilter: boolean): Promise<VideoRow[]> {
    const baseCols = 'id, slug, title, description, youtube_id, position';
    const extraCols = tenantFilter ? ', demo_ref, is_featured' : ', category_slug, is_featured';
    // Primer intento con is_featured
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = (svc.from(tbl) as any).select(baseCols + extraCols);
      if (tenantFilter) q = q.eq('tenant_id', tenantId);
      const r = await q.order('is_featured', { ascending: false }).order('position', { ascending: true }).limit(limit);
      if (!r.error) return (r.data ?? []) as VideoRow[];
    } catch { /* fallthrough */ }
    // Retry sin is_featured
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = (svc.from(tbl) as any).select(baseCols + (tenantFilter ? ', demo_ref' : ', category_slug'));
      if (tenantFilter) q = q.eq('tenant_id', tenantId);
      const r = await q.order('position', { ascending: true }).limit(limit);
      return (r.data ?? []) as VideoRow[];
    } catch { return []; }
  }

  const realVideos = await selectVideosWithFallback('videos', true);
  for (const v of realVideos as Array<VideoRow & { demo_ref: string | null }>) {
    out.push({ ...v, is_demo: false });
    if (v.demo_ref) realDemoRefs.add(v.demo_ref);
  }

  try {
    const hiddenSet = await getHiddenSet(tenantId, 'video');
    const demos = await selectVideosWithFallback('demo_videos', false);
    for (const d of demos) {
      if (hiddenSet.has(d.slug)) continue;
      if (realDemoRefs.has(d.slug)) continue;
      out.push({
        ...d,
        id: `demo:${d.slug}`,
        is_demo: true
      });
    }
  } catch { /* pool no existe todavía */ }

  return out.slice(0, limit);
}

/**
 * Fetch UN video por slug (para el reels player) — busca en real +
 * customización + pool en ese orden, igual que findArticleBySlug.
 */
export async function findVideoBySlug(tenantId: string, slug: string): Promise<VideoRow | null> {
  const svc = getServiceClient();
  // 1. Real por slug
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('videos') as any)
      .select('id, slug, title, description, youtube_id, position')
      .eq('tenant_id', tenantId).eq('slug', slug).maybeSingle();
    if (data) return { ...(data as VideoRow), is_demo: false };
  } catch { /* ignore */ }
  // 2. Real por demo_ref
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('videos') as any)
      .select('id, slug, title, description, youtube_id, position')
      .eq('tenant_id', tenantId).eq('demo_ref', slug).maybeSingle();
    if (data) return { ...(data as VideoRow), is_demo: false };
  } catch { /* ignore */ }
  // 3. Pool
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: hidden } = await (svc.from('tenant_demo_hidden') as any)
      .select('id').eq('tenant_id', tenantId).eq('resource_type', 'video').eq('demo_slug', slug)
      .maybeSingle();
    if (hidden) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: demo } = await (svc.from('demo_videos') as any)
      .select('slug, title, description, youtube_id, category_slug, position')
      .eq('slug', slug).maybeSingle();
    if (!demo) return null;
    const d = demo as VideoRow;
    return { ...d, id: `demo:${d.slug}`, is_demo: true };
  } catch { /* ignore */ }
  return null;
}

/**
 * Fetch productos físicos del tenant + demos visibles.
 */
export async function fetchPhysicalProductsForTenant(
  tenantId: string,
  opts: { limit?: number } = {}
): Promise<PhysicalProductRow[]> {
  const svc = getServiceClient();
  const limit = Math.max(1, Math.min(100, opts.limit ?? 50));
  const out: PhysicalProductRow[] = [];

  const realDemoRefs = new Set<string>();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('physical_products') as any)
      .select('id, slug, title, description, cover_url, price_cents, compare_at_price_cents, stock_qty, currency, status, demo_ref')
      .eq('tenant_id', tenantId)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(limit);
    for (const p of ((data ?? []) as Array<PhysicalProductRow & { demo_ref: string | null }>)) {
      out.push({ ...p, is_demo: false });
      if (p.demo_ref) realDemoRefs.add(p.demo_ref);
    }
  } catch { /* ignore */ }

  try {
    const hiddenSet = await getHiddenSet(tenantId, 'physical_product');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: demos } = await (svc.from('demo_physical_products') as any)
      .select('id, slug, title, description, cover_url, price_cents, compare_at_price_cents, stock_qty, status')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(limit);
    for (const d of ((demos ?? []) as Array<PhysicalProductRow>)) {
      if (hiddenSet.has(d.slug)) continue;
      if (realDemoRefs.has(d.slug)) continue;
      out.push({
        ...d,
        id: `demo:${d.slug}`,
        currency: d.currency ?? 'ARS',
        is_demo: true
      });
    }
  } catch { /* ignore */ }

  return out.slice(0, limit);
}

/** Set de slugs escondidos por el tenant para un tipo de recurso. */
async function getHiddenSet(tenantId: string, resourceType: string): Promise<Set<string>> {
  try {
    const svc = getServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('tenant_demo_hidden') as any)
      .select('demo_slug')
      .eq('tenant_id', tenantId).eq('resource_type', resourceType);
    return new Set(((data ?? []) as Array<{ demo_slug: string }>).map((r) => r.demo_slug));
  } catch {
    return new Set();
  }
}

/**
 * Chequea si un id es de un demo (empieza con "demo:").
 */
export function isDemoId(id: string): boolean {
  return typeof id === 'string' && id.startsWith('demo:');
}

/**
 * Extrae el slug de un id demo. Retorna null si no es demo.
 */
export function demoSlugFromId(id: string): string | null {
  return isDemoId(id) ? id.slice('demo:'.length) : null;
}
