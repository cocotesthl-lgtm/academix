'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

/**
 * Acciones genéricas sobre items de "Mis publicaciones" (courses,
 * bundles, articles, paylinks, physical). Sirven al bulk-action bar del
 * AppSectionList — un solo lugar centralizando duplicate + bulk delete
 * en vez de importar 5 acciones distintas del client.
 *
 * kind válidos:
 *   courses   → tabla `courses`
 *   bundles   → tabla `bundles`
 *   articles  → tabla `articles`
 *   paylinks  → tabla `pay_links`
 *   physical  → tabla `physical_products`
 */

const TABLE_BY_KIND: Record<string, string> = {
  courses: 'courses',
  bundles: 'bundles',
  articles: 'articles',
  paylinks: 'pay_links',
  physical: 'physical_products'
};

const REVALIDATE_PATHS: Record<string, string[]> = {
  courses: ['/owner/courses'],
  bundles: ['/owner/courses', '/owner/bundles'],
  articles: ['/owner/courses', '/owner/blog'],
  paylinks: ['/owner/courses', '/owner/pay-links'],
  physical: ['/owner/courses', '/owner/products']
};

function refreshFor(kind: string): void {
  const paths = REVALIDATE_PATHS[kind] ?? ['/owner/courses'];
  for (const p of paths) revalidatePath(p);
}

/** Base62 code para pay_links.code duplicado */
function genPayLinkCode(len = 8): string {
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/**
 * Elimina N items del mismo kind. Formato: kind + ids (comma-separated).
 * Físicos con variantes/stock: cascada la resuelve la DB via FK on delete.
 */
export async function bulkDeleteItemsAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const kind = String(formData.get('kind') ?? '');
  const idsRaw = String(formData.get('ids') ?? '');
  const ids = idsRaw.split(',').map((s) => s.trim()).filter(Boolean);
  const table = TABLE_BY_KIND[kind];
  if (!table || ids.length === 0) return;

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from(table) as any).delete().in('id', ids).eq('tenant_id', tenant.id);
  refreshFor(kind);
}

/**
 * Duplica UN item. Copia todos los campos excepto id/created_at/updated_at.
 * Tweaks:
 *   - slug/code: sufijo aleatorio para no violar UNIQUE
 *   - title/name: sufijo " (copia)"
 *   - status: pasa a 'draft' (o 'paused' para paylinks) — evita publicar
 *     inadvertidamente el clon
 */
export async function duplicateItemAction(formData: FormData): Promise<void> {
  const { tenant, userId } = await requireOwner();
  const kind = String(formData.get('kind') ?? '');
  const id = String(formData.get('id') ?? '');
  const table = TABLE_BY_KIND[kind];
  if (!table || !id) return;

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: original } = await (svc.from(table) as any)
    .select('*').eq('id', id).eq('tenant_id', tenant.id).maybeSingle();
  if (!original) return;

  // Cleanup común
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _oldId, created_at: _c, updated_at: _u, ...rest } = original as Record<string, unknown>;

  const patch: Record<string, unknown> = { ...rest, tenant_id: tenant.id };

  // Slug: agregarle un sufijo aleatorio corto para evitar duplicados
  if (typeof patch.slug === 'string') {
    const rand = Math.random().toString(36).slice(2, 6);
    patch.slug = `${patch.slug}-copia-${rand}`.slice(0, 80);
  }
  // Título / nombre
  if (typeof patch.title === 'string') patch.title = `${patch.title} (copia)`;
  if (typeof patch.name === 'string' && !('title' in patch)) {
    patch.name = `${patch.name} (copia)`;
  }
  // Status: siempre draft para no autopublicar
  if ('status' in patch) {
    patch.status = kind === 'paylinks' ? 'paused' : 'draft';
  }

  // Kind-specific tweaks
  if (kind === 'paylinks') {
    patch.code = genPayLinkCode();
    patch.uses_count = 0;
    patch.views_count = 0;
    patch.clicks_count = 0;
    patch.revenue_cents = 0;
    patch.created_by = userId;
    patch.affiliate_user_id = null;
    patch.parent_link_id = null;
  }
  if (kind === 'articles') {
    patch.published_at = null;
  }
  if (kind === 'physical') {
    // SKU es unique — regenerar
    if (typeof patch.sku === 'string' && patch.sku) {
      patch.sku = `${patch.sku}-COPIA-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from(table) as any).insert(patch);
  refreshFor(kind);
}
