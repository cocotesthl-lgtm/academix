import 'server-only';
import { getServiceClient } from '@/lib/supabase/service';

export type FunnelStage = 'page_view' | 'product_view' | 'add_to_cart' | 'checkout_start' | 'purchase';
export type ContentKind = 'physical' | 'course' | 'event' | 'vip' | 'article' | 'paylink';

export type FunnelCounts = Record<FunnelStage, number>;

/** Cards top: sesiones únicas + page views totales (crudos, no distinct). */
export type TrafficOverview = {
  sessions: number;       // distinct session_id
  page_views: number;     // raw page_view rows
  unique_visitors_delta_pct?: number; // opcional, comparación vs período anterior
};

export type ProductFunnel = {
  product_id: string;
  product_title: string;
  cover_url: string | null;
  views: number;
  add_to_carts: number;
  purchases: number;
  revenue_cents: number;
  add_to_cart_rate: number;   // 0..1
  purchase_rate: number;      // 0..1 (relative to views)
};

/**
 * Cuenta eventos por tipo en la ventana [since, now]. Distinct por session_id
 * en page_view / product_view / checkout_start (evita inflado por refresh);
 * purchase se cuenta bruto porque cada compra es un evento único.
 */
export async function getFunnelCounts(tenantId: string, sinceDays = 30): Promise<FunnelCounts> {
  const svc = getServiceClient();
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('analytics_events') as any)
    .select('event_type, session_id')
    .eq('tenant_id', tenantId)
    .gte('created_at', since);

  const rows = (data ?? []) as Array<{ event_type: FunnelStage; session_id: string | null }>;

  const uniqueBy: Record<FunnelStage, Set<string>> = {
    page_view: new Set(),
    product_view: new Set(),
    add_to_cart: new Set(),
    checkout_start: new Set(),
    purchase: new Set()
  };
  const raw: Record<FunnelStage, number> = {
    page_view: 0, product_view: 0, add_to_cart: 0, checkout_start: 0, purchase: 0
  };
  for (const r of rows) {
    if (r.session_id) uniqueBy[r.event_type].add(r.session_id);
    raw[r.event_type]++;
  }
  return {
    page_view: uniqueBy.page_view.size,
    product_view: uniqueBy.product_view.size,
    add_to_cart: uniqueBy.add_to_cart.size,
    checkout_start: uniqueBy.checkout_start.size,
    purchase: raw.purchase  // sin distinct — cada compra vale
  };
}

/**
 * Funnel por producto — top 10 por vistas en la ventana [since, now].
 * Incluye conversion rate (add_to_cart / views) y (purchases / views).
 */
export async function getTopProductFunnels(tenantId: string, sinceDays = 30, limit = 10): Promise<ProductFunnel[]> {
  const svc = getServiceClient();
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: events } = await (svc.from('analytics_events') as any)
    .select('event_type, product_id, amount_cents, session_id')
    .eq('tenant_id', tenantId)
    .gte('created_at', since)
    .not('product_id', 'is', null);
  const rows = (events ?? []) as Array<{
    event_type: FunnelStage; product_id: string;
    amount_cents: number | null; session_id: string | null;
  }>;

  const byProduct = new Map<string, {
    views: Set<string>; addToCarts: Set<string>;
    purchases: number; revenue: number;
  }>();
  for (const r of rows) {
    const key = r.product_id;
    if (!byProduct.has(key)) byProduct.set(key, {
      views: new Set(), addToCarts: new Set(), purchases: 0, revenue: 0
    });
    const b = byProduct.get(key)!;
    if (r.event_type === 'product_view' && r.session_id) b.views.add(r.session_id);
    if (r.event_type === 'add_to_cart' && r.session_id) b.addToCarts.add(r.session_id);
    if (r.event_type === 'purchase') {
      b.purchases++;
      b.revenue += r.amount_cents ?? 0;
    }
  }

  const productIds = Array.from(byProduct.keys());
  if (productIds.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: products } = await (svc.from('physical_products') as any)
    .select('id, title, cover_url').in('id', productIds);
  const productById = new Map(
    ((products ?? []) as Array<{ id: string; title: string; cover_url: string | null }>)
      .map((p) => [p.id, p])
  );

  const results: ProductFunnel[] = productIds.map((pid) => {
    const b = byProduct.get(pid)!;
    const info = productById.get(pid);
    const views = b.views.size;
    const addToCarts = b.addToCarts.size;
    return {
      product_id: pid,
      product_title: info?.title ?? '(producto borrado)',
      cover_url: info?.cover_url ?? null,
      views,
      add_to_carts: addToCarts,
      purchases: b.purchases,
      revenue_cents: b.revenue,
      add_to_cart_rate: views > 0 ? addToCarts / views : 0,
      purchase_rate: views > 0 ? b.purchases / views : 0
    };
  });

  return results.sort((a, b) => b.views - a.views).slice(0, limit);
}

/**
 * Serie temporal diaria de un evento (para sparklines / grafiquito).
 * Devuelve arreglo de N días (sinceDays) con {date, count}.
 */
export async function getDailyCounts(
  tenantId: string,
  eventType: FunnelStage,
  sinceDays = 30
): Promise<Array<{ date: string; count: number }>> {
  const svc = getServiceClient();
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('analytics_events') as any)
    .select('created_at')
    .eq('tenant_id', tenantId)
    .eq('event_type', eventType)
    .gte('created_at', since.toISOString());

  const rows = (data ?? []) as Array<{ created_at: string }>;

  const bucket: Record<string, number> = {};
  for (let i = 0; i < sinceDays; i++) {
    const d = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
    bucket[d.toISOString().slice(0, 10)] = 0;
  }
  for (const r of rows) {
    const key = r.created_at.slice(0, 10);
    if (bucket[key] !== undefined) bucket[key]++;
  }
  return Object.entries(bucket).map(([date, count]) => ({ date, count }));
}

/**
 * Overview de tráfico: sesiones únicas + total de page_views crudos.
 * Card "gruesa" arriba del funnel para tener números totales inmediatos.
 */
export async function getTrafficOverview(tenantId: string, sinceDays = 30): Promise<TrafficOverview> {
  const svc = getServiceClient();
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('analytics_events') as any)
    .select('session_id, event_type')
    .eq('tenant_id', tenantId)
    .gte('created_at', since);
  const rows = (data ?? []) as Array<{ session_id: string | null; event_type: string }>;

  const sessions = new Set<string>();
  let pageViews = 0;
  for (const r of rows) {
    if (r.session_id) sessions.add(r.session_id);
    if (r.event_type === 'page_view') pageViews++;
  }
  return { sessions: sessions.size, page_views: pageViews };
}

/**
 * Fuentes de tráfico: agrupa por utm_source. Si no hay utm, usa el referer.
 * Devuelve top N con sesiones únicas por fuente.
 */
export async function getTrafficSources(
  tenantId: string, sinceDays = 30, limit = 8
): Promise<Array<{ source: string; sessions: number; kind: 'utm' | 'referer' | 'direct' }>> {
  const svc = getServiceClient();
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('analytics_events') as any)
    .select('session_id, utm_source, referer')
    .eq('tenant_id', tenantId)
    .gte('created_at', since);
  const rows = (data ?? []) as Array<{ session_id: string | null; utm_source: string | null; referer: string | null }>;

  // Agrupamos por sesión y determinamos la fuente de esa sesión (primera vista).
  const bySession = new Map<string, { source: string; kind: 'utm' | 'referer' | 'direct' }>();
  for (const r of rows) {
    if (!r.session_id) continue;
    if (bySession.has(r.session_id)) continue;
    if (r.utm_source) bySession.set(r.session_id, { source: r.utm_source, kind: 'utm' });
    else if (r.referer) bySession.set(r.session_id, { source: r.referer, kind: 'referer' });
    else bySession.set(r.session_id, { source: 'Directo', kind: 'direct' });
  }

  const bucket = new Map<string, { sessions: number; kind: 'utm' | 'referer' | 'direct' }>();
  for (const s of bySession.values()) {
    const ex = bucket.get(s.source);
    if (ex) ex.sessions++;
    else bucket.set(s.source, { sessions: 1, kind: s.kind });
  }
  return Array.from(bucket.entries())
    .map(([source, v]) => ({ source, sessions: v.sessions, kind: v.kind }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, limit);
}

/**
 * Top clicks agrupados por label — top N con conteo bruto y sesiones únicas.
 * Solo eventos `click` (los del `add_to_cart` / `checkout_start` no cuentan
 * acá; siguen en el funnel).
 */
export async function getTopClicks(
  tenantId: string, sinceDays = 30, limit = 15
): Promise<Array<{ label: string; clicks: number; sessions: number }>> {
  const svc = getServiceClient();
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc.from('analytics_events') as any)
    .select('label, session_id')
    .eq('tenant_id', tenantId)
    .eq('event_type', 'click')
    .gte('created_at', since);
  if (error) return []; // migration 0089 pendiente

  const rows = (data ?? []) as Array<{ label: string | null; session_id: string | null }>;
  const bucket = new Map<string, { clicks: number; sessions: Set<string> }>();
  for (const r of rows) {
    const label = (r.label ?? '(sin label)').trim();
    if (!label) continue;
    const b = bucket.get(label) ?? { clicks: 0, sessions: new Set() };
    b.clicks++;
    if (r.session_id) b.sessions.add(r.session_id);
    bucket.set(label, b);
  }
  return Array.from(bucket.entries())
    .map(([label, v]) => ({ label, clicks: v.clicks, sessions: v.sessions.size }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, limit);
}

/**
 * Distribución de vistas de contenido por tipo (course/vip/event/etc).
 * Usa content_kind — si migration 0089 no corrió, devuelve vacío.
 */
export async function getContentKindBreakdown(
  tenantId: string, sinceDays = 30
): Promise<Array<{ kind: ContentKind; views: number; sessions: number }>> {
  const svc = getServiceClient();
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc.from('analytics_events') as any)
    .select('content_kind, session_id, event_type')
    .eq('tenant_id', tenantId)
    .gte('created_at', since)
    .not('content_kind', 'is', null)
    .in('event_type', ['product_view', 'course_view', 'event_view', 'vip_view', 'article_view', 'paylink_view']);
  if (error) return [];

  const rows = (data ?? []) as Array<{ content_kind: ContentKind | null; session_id: string | null }>;
  const bucket = new Map<ContentKind, { views: number; sessions: Set<string> }>();
  for (const r of rows) {
    if (!r.content_kind) continue;
    const b = bucket.get(r.content_kind) ?? { views: 0, sessions: new Set() };
    b.views++;
    if (r.session_id) b.sessions.add(r.session_id);
    bucket.set(r.content_kind, b);
  }
  return Array.from(bucket.entries())
    .map(([kind, v]) => ({ kind, views: v.views, sessions: v.sessions.size }))
    .sort((a, b) => b.views - a.views);
}
