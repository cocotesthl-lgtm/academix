'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

export type Article = {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  body_html: string;
  author_name: string | null;
  category_id: string | null;
  status: 'draft' | 'published';
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Slug URL-safe. Vacío o solo símbolos → null (obliga a regenerar). */
function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function uniqueSlug(tenantId: string, base: string, excludeId?: string): Promise<string> {
  const svc = getServiceClient();
  let candidate = base;
  let i = 2;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (svc.from('articles') as any).select('id').eq('tenant_id', tenantId).eq('slug', candidate).maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await q;
    const row = data as { id: string } | null;
    if (!row || row.id === excludeId) return candidate;
    candidate = `${base}-${i}`;
    i++;
  }
}

export async function createArticleAction(): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const baseSlug = 'nuevo-articulo';
  const slug = await uniqueSlug(tenant.id, baseSlug);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc.from('articles') as any).insert({
    tenant_id: tenant.id,
    slug,
    title: 'Nuevo artículo',
    body_html: '',
    status: 'draft'
  }).select('id').single();
  if (error) throw new Error(error.message);
  revalidatePath('/blog');
  redirect(`/blog/${(data as { id: string }).id}`);
}

export async function updateArticleAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  let id = String(formData.get('id') ?? '');
  if (!id) return;

  // Copy-on-edit: si el id es sintético "demo:{slug}", materializamos el
  // demo a una row real del tenant antes de aplicar el update. Esto pasa
  // cuando el owner edita un artículo del pool global por primera vez.
  const { isDemoId, demoSlugFromId } = await import('@/lib/demo-pool/queries');
  if (isDemoId(id)) {
    const slug = demoSlugFromId(id);
    if (!slug) return;
    const { materializeDemoArticle } = await import('@/lib/demo-pool/mutations');
    const realId = await materializeDemoArticle(tenant.id, slug);
    if (!realId) return;
    id = realId;
  }

  const rawTitle = String(formData.get('title') ?? '').trim() || 'Sin título';
  const rawSlug = String(formData.get('slug') ?? '').trim();
  const excerpt = String(formData.get('excerpt') ?? '').trim().slice(0, 400) || null;
  const cover_url = String(formData.get('cover_url') ?? '').trim() || null;
  const body_html = String(formData.get('body_html') ?? '');
  const author_name = String(formData.get('author_name') ?? '').trim() || null;
  const category_id = String(formData.get('category_id') ?? '').trim() || null;

  const svc = getServiceClient();
  const desiredSlug = rawSlug ? slugify(rawSlug) : slugify(rawTitle);
  const finalSlug = await uniqueSlug(tenant.id, desiredSlug || 'articulo', id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('articles') as any).update({
    title: rawTitle,
    slug: finalSlug,
    excerpt,
    cover_url,
    body_html,
    author_name,
    category_id,
    updated_at: new Date().toISOString()
  }).eq('id', id).eq('tenant_id', tenant.id);

  revalidatePath('/blog');
  revalidatePath(`/blog/${id}`);
  revalidatePath('/', 'layout'); // storefront blog listing
}

export async function setArticleStatusAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? 'draft');
  if (!id || !['draft', 'published'].includes(status)) return;

  const svc = getServiceClient();
  const updates: { status: string; published_at?: string; updated_at: string } = {
    status,
    updated_at: new Date().toISOString()
  };
  if (status === 'published') {
    // Solo setea published_at si nunca se publicó (para preservar el 1er publish).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('articles') as any)
      .select('published_at').eq('id', id).eq('tenant_id', tenant.id).maybeSingle();
    const row = data as { published_at: string | null } | null;
    if (!row?.published_at) updates.published_at = new Date().toISOString();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('articles') as any).update(updates).eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/blog');
  revalidatePath(`/blog/${id}`);
  revalidatePath('/', 'layout');
}

export async function deleteArticleAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  // Si es un demo (no existe en articles reales), hacemos soft-hide en
  // tenant_demo_hidden en vez de tocar el pool global.
  const { isDemoId, demoSlugFromId } = await import('@/lib/demo-pool/queries');
  if (isDemoId(id)) {
    const slug = demoSlugFromId(id);
    if (slug) {
      const { hideDemoArticle } = await import('@/lib/demo-pool/mutations');
      await hideDemoArticle(tenant.id, slug);
    }
    revalidatePath('/blog');
    revalidatePath('/', 'layout');
    redirect('/blog');
  }

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('articles') as any).delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/blog');
  revalidatePath('/', 'layout');
  redirect('/blog');
}
