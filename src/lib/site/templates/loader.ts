import 'server-only';
import { getServiceClient } from '@/lib/supabase/service';
import { SITE_TEMPLATES as HARDCODED, type SiteTemplate } from './catalog';
import type { SiteConfig } from '@/lib/site/types';
import type { ModuleKey } from '@/lib/modules/types';

export type SiteTemplateRow = {
  id: string;           // uuid de DB (distinto de `slug`)
  slug: string;
  name: string;
  category: string;
  emoji: string | null;
  short_desc: string | null;
  long_desc: string | null;
  suggested_primary: string | null;
  config: SiteConfig;
  modules: string[];
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

function rowToTemplate(r: SiteTemplateRow): SiteTemplate {
  return {
    id: r.slug,
    name: r.name,
    category: r.category,
    emoji: r.emoji ?? '',
    shortDesc: r.short_desc ?? '',
    longDesc: r.long_desc ?? undefined,
    suggestedPrimary: r.suggested_primary ?? '#f97316',
    config: r.config,
    modules: (r.modules ?? []) as ModuleKey[]
  };
}

/**
 * Auto-seed: si la tabla está vacía, inserta todos los hardcoded como
 * templates de sistema. Idempotente (chequea count primero).
 */
async function autoSeed(): Promise<void> {
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (svc.from('site_templates') as any)
    .select('id', { count: 'exact', head: true });
  if ((count ?? 0) > 0) return;

  const rows = HARDCODED.map((t, i) => ({
    slug: t.id,
    name: t.name,
    category: t.category,
    emoji: t.emoji || null,
    short_desc: t.shortDesc || null,
    long_desc: t.longDesc ?? null,
    suggested_primary: t.suggestedPrimary || null,
    config: t.config,
    modules: (t.modules ?? []) as string[],
    is_active: true,
    is_system: true,
    sort_order: i * 10
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('site_templates') as any).insert(rows);
}

/**
 * Lee todos los templates de DB (auto-seeda si está vacía).
 * Si `includeInactive=false` (default) filtra a los is_active=true.
 * Si la DB no responde por lo que sea, cae al catálogo hardcoded.
 */
export async function loadSiteTemplates(includeInactive = false): Promise<SiteTemplate[]> {
  try {
    const svc = getServiceClient();
    await autoSeed();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = (svc.from('site_templates') as any)
      .select('*').order('sort_order', { ascending: true }).order('name');
    if (!includeInactive) q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as SiteTemplateRow[];
    return rows.map(rowToTemplate);
  } catch (e) {
    console.warn('[loadSiteTemplates] fallback a hardcoded:', e);
    return HARDCODED;
  }
}

/** Fetch para el panel del founder — incluye inactivos + rows crudos con ids DB. */
export async function loadSiteTemplateRows(): Promise<{
  rows: SiteTemplateRow[];
  missingMigration: boolean;
  error?: string;
}> {
  try {
    const svc = getServiceClient();
    await autoSeed();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('site_templates') as any)
      .select('*').order('sort_order', { ascending: true }).order('name');
    if (error) throw error;
    return { rows: (data ?? []) as SiteTemplateRow[], missingMigration: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Signature típica cuando la tabla no existe: "relation ... does not exist"
    const isMissing = /site_templates|does not exist|schema cache/i.test(msg);
    return { rows: [], missingMigration: isMissing, error: msg };
  }
}
