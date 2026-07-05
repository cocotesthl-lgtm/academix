import 'server-only';
import { getServiceClient } from '@/lib/supabase/service';

export type PublicCategory = {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
  is_featured: boolean;
};

/**
 * Carga todas las categorías del tenant. Defensivo: si migration 0054
 * no corrió, retorna con parent_id=null y is_featured=false.
 */
export async function loadTenantCategories(tenantId: string): Promise<PublicCategory[]> {
  const svc = getServiceClient();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('course_categories') as any)
      .select('id, slug, name, parent_id, is_featured')
      .eq('tenant_id', tenantId)
      .order('position', { ascending: true });
    if (error) throw error;
    return (data ?? []) as PublicCategory[];
  } catch {
    const { data } = await svc.from('course_categories')
      .select('id, slug, name').eq('tenant_id', tenantId).order('position', { ascending: true });
    return ((data ?? []) as Array<{ id: string; slug: string; name: string }>)
      .map((c) => ({ ...c, parent_id: null, is_featured: false }));
  }
}

/**
 * Dado un slug de categoría, devuelve el conjunto de IDs de esa categoría
 * + toda su descendencia. Usado para filtrar la tienda por padre e incluir
 * productos de los hijos.
 */
export function collectCategoryAndDescendants(
  categories: PublicCategory[],
  targetSlug: string
): Set<string> {
  const target = categories.find((c) => c.slug === targetSlug);
  if (!target) return new Set();
  const ids = new Set<string>([target.id]);
  const queue = [target.id];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const c of categories) {
      if (c.parent_id === cur && !ids.has(c.id)) {
        ids.add(c.id);
        queue.push(c.id);
      }
    }
  }
  return ids;
}
