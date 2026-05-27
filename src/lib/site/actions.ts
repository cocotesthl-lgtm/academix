'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { DEFAULT_SITE_CONFIG, type SiteConfig, type SectionKey, type TestimonialItem, type FaqItem } from '@/lib/site/types';

export type SiteResult = { ok: true } | { ok: false; error: string };

async function loadConfig(tenantId: string): Promise<SiteConfig> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('tenants')
    .select('site_config')
    .eq('id', tenantId)
    .single<{ site_config: SiteConfig | null }>();
  return data?.site_config ?? DEFAULT_SITE_CONFIG;
}

async function saveConfig(tenantId: string, cfg: SiteConfig) {
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (svc.from('tenants') as any)
    .update({ site_config: cfg, updated_at: new Date().toISOString() })
    .eq('id', tenantId);
}

/* ===== Toggle section enabled ===== */

export async function toggleSectionAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const key = String(formData.get('section') ?? '') as SectionKey;
  if (!(key in DEFAULT_SITE_CONFIG.sections)) return;
  const cfg = await loadConfig(tenant.id);
  cfg.sections[key].enabled = !cfg.sections[key].enabled;
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

/* ===== Edit section text fields (generic) ===== */

export async function updateSectionFieldsAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const key = String(formData.get('section') ?? '') as SectionKey;
  if (!(key in DEFAULT_SITE_CONFIG.sections)) return;
  const cfg = await loadConfig(tenant.id);
  const section = cfg.sections[key] as Record<string, unknown>;

  for (const f of ['title', 'subtitle', 'body', 'cta_label', 'cta_href']) {
    if (formData.has(f)) {
      section[f] = String(formData.get(f) ?? '');
    }
  }
  if (formData.has('show_filters')) {
    section.show_filters = formData.get('show_filters') === 'on';
  }

  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

/* ===== About image upload ===== */

export async function uploadAboutImageAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const file = formData.get('image') as File | null;
  if (!file || file.size === 0) return;
  if (file.size > 4 * 1024 * 1024) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return;
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${tenant.id}/about-${Date.now()}.${ext}`;
  const svc = getServiceClient();
  const buf = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await svc.storage.from('branding').upload(path, buf, { contentType: file.type, upsert: true });
  if (upErr) return;
  const url = svc.storage.from('branding').getPublicUrl(path).data.publicUrl;

  const cfg = await loadConfig(tenant.id);
  cfg.sections.about.image_url = url;
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

/* ===== Testimonials CRUD ===== */

export async function addTestimonialAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const name = String(formData.get('name') ?? '').trim();
  const text = String(formData.get('text') ?? '').trim();
  const role = String(formData.get('role') ?? '').trim() || undefined;
  if (!name || !text) return;
  const cfg = await loadConfig(tenant.id);
  const item: TestimonialItem = { id: randomUUID(), name, text, role };
  cfg.sections.testimonials.items.push(item);
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function deleteTestimonialAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const cfg = await loadConfig(tenant.id);
  cfg.sections.testimonials.items = cfg.sections.testimonials.items.filter((t) => t.id !== id);
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

/* ===== FAQ CRUD ===== */

export async function addFaqAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const q = String(formData.get('q') ?? '').trim();
  const a = String(formData.get('a') ?? '').trim();
  if (!q || !a) return;
  const cfg = await loadConfig(tenant.id);
  const item: FaqItem = { id: randomUUID(), q, a };
  cfg.sections.faq.items.push(item);
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function deleteFaqAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const cfg = await loadConfig(tenant.id);
  cfg.sections.faq.items = cfg.sections.faq.items.filter((t) => t.id !== id);
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}
