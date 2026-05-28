'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import {
  DEFAULT_SITE_CONFIG,
  mergeConfig,
  type SiteConfig,
  type SectionKey,
  type TestimonialItem,
  type FaqItem,
  type StatItem,
  type LearnItem,
  type FeatureItem,
  type LogoItem,
  type NavLink,
  type SocialLink,
  type HeroLayout,
  type PricingTier,
  type GalleryItem,
  type InstructorItem,
  type InstructorDisplay,
  type CustomImagePos
} from '@/lib/site/types';

async function loadConfig(tenantId: string): Promise<SiteConfig> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('tenants')
    .select('site_config')
    .eq('id', tenantId)
    .single<{ site_config: unknown }>();
  return mergeConfig(data?.site_config);
}

async function saveConfig(tenantId: string, cfg: SiteConfig) {
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (svc.from('tenants') as any)
    .update({ site_config: cfg, updated_at: new Date().toISOString() })
    .eq('id', tenantId);
}

/* ===== Toggle / reorder / bg color ===== */

export async function toggleSectionAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const key = String(formData.get('section') ?? '') as SectionKey;
  if (!(key in DEFAULT_SITE_CONFIG.sections)) return;
  const cfg = await loadConfig(tenant.id);
  cfg.sections[key].enabled = !cfg.sections[key].enabled;
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function moveSectionAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const key = String(formData.get('section') ?? '') as SectionKey;
  const dir = String(formData.get('dir') ?? '');
  if (!(key in DEFAULT_SITE_CONFIG.sections)) return;
  if (dir !== 'up' && dir !== 'down') return;
  const cfg = await loadConfig(tenant.id);
  const idx = cfg.order.indexOf(key);
  if (idx === -1) return;
  const newIdx = dir === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= cfg.order.length) return;
  const next = [...cfg.order];
  [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
  cfg.order = next;
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function setSectionBgColorAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const key = String(formData.get('section') ?? '') as SectionKey;
  const color = String(formData.get('bg_color') ?? '').trim();
  if (!(key in DEFAULT_SITE_CONFIG.sections)) return;
  const cfg = await loadConfig(tenant.id);
  cfg.sections[key].bg_color = color === '' || color.toLowerCase() === 'null' ? null : color;
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

/* ===== Generic fields ===== */

export async function updateSectionFieldsAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const key = String(formData.get('section') ?? '') as SectionKey;
  if (!(key in DEFAULT_SITE_CONFIG.sections)) return;
  const cfg = await loadConfig(tenant.id);
  const section = cfg.sections[key] as Record<string, unknown>;

  for (const f of ['title', 'subtitle', 'body', 'cta_label', 'cta_href', 'name', 'bio', 'credentials', 'ends_at',
                   'before_label', 'after_label', 'before_body', 'after_body', 'video_id',
                   'eyebrow', 'cta_label_2', 'cta_href_2', 'caption']) {
    if (formData.has(f)) section[f] = String(formData.get(f) ?? '');
  }
  if (formData.has('show_filters')) section.show_filters = formData.get('show_filters') === 'on';
  if (formData.has('grayscale')) section.grayscale = formData.get('grayscale') === 'on';
  if (formData.has('marquee')) section.marquee = formData.get('marquee') === 'on';
  if (formData.has('layout')) section.layout = String(formData.get('layout') ?? 'centered');
  if (formData.has('provider')) section.provider = String(formData.get('provider') ?? 'youtube');
  if (formData.has('display_mode')) section.display_mode = String(formData.get('display_mode') ?? 'single');
  if (formData.has('image_pos')) section.image_pos = String(formData.get('image_pos') ?? 'right');
  if (formData.has('email')) section.email = String(formData.get('email') ?? '').trim();
  if (formData.has('whatsapp')) section.whatsapp = String(formData.get('whatsapp') ?? '').trim();
  if (formData.has('name_label')) section.name_label = String(formData.get('name_label') ?? 'Nombre');
  if (formData.has('email_label')) section.email_label = String(formData.get('email_label') ?? 'Email');
  if (formData.has('message_label')) section.message_label = String(formData.get('message_label') ?? 'Mensaje');
  if (formData.has('submit_label')) section.submit_label = String(formData.get('submit_label') ?? 'Enviar');
  if (formData.has('columns')) {
    const c = parseInt(String(formData.get('columns') ?? '3'), 10);
    section.columns = (c === 2 || c === 3 || c === 4) ? c : 3;
  }

  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

/* ===== Image uploads ===== */

async function uploadImage(tenantId: string, prefix: string, file: File): Promise<string | null> {
  if (file.size > 4 * 1024 * 1024) return null;
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) return null;
  const ext = file.type === 'image/png' ? 'png'
    : file.type === 'image/webp' ? 'webp'
    : file.type === 'image/svg+xml' ? 'svg'
    : 'jpg';
  const path = `${tenantId}/${prefix}-${Date.now()}.${ext}`;
  const svc = getServiceClient();
  const buf = new Uint8Array(await file.arrayBuffer());
  const { error } = await svc.storage.from('branding').upload(path, buf, { contentType: file.type, upsert: true });
  if (error) return null;
  return svc.storage.from('branding').getPublicUrl(path).data.publicUrl;
}

export async function uploadAboutImageAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const file = formData.get('image') as File | null;
  if (!file || file.size === 0) return;
  const url = await uploadImage(tenant.id, 'about', file);
  if (!url) return;
  const cfg = await loadConfig(tenant.id);
  cfg.sections.about.image_url = url;
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function uploadInstructorPhotoAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const file = formData.get('image') as File | null;
  if (!file || file.size === 0) return;
  const url = await uploadImage(tenant.id, 'instructor', file);
  if (!url) return;
  const cfg = await loadConfig(tenant.id);
  cfg.sections.instructor.photo_url = url;
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function uploadCustomImageAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const file = formData.get('image') as File | null;
  if (!file || file.size === 0) return;
  const url = await uploadImage(tenant.id, 'custom', file);
  if (!url) return;
  const cfg = await loadConfig(tenant.id);
  cfg.sections.custom.image_url = url;
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

/* ===== Instructor items CRUD ===== */

export async function addInstructorItemAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const name = String(formData.get('name') ?? '').trim();
  const credentials = String(formData.get('credentials') ?? '').trim() || undefined;
  const bio = String(formData.get('bio') ?? '').trim() || undefined;
  if (!name) return;

  let photo_url: string | null = null;
  const photo = formData.get('photo') as File | null;
  if (photo && photo.size > 0) {
    photo_url = await uploadImage(tenant.id, 'instructor-item', photo);
  }

  const cfg = await loadConfig(tenant.id);
  const item: InstructorItem = { id: randomUUID(), name, credentials, bio, photo_url };
  cfg.sections.instructor.items.push(item);
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function deleteInstructorItemAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const cfg = await loadConfig(tenant.id);
  cfg.sections.instructor.items = cfg.sections.instructor.items.filter((i) => i.id !== id);
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function uploadHeroImageAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const file = formData.get('image') as File | null;
  if (!file || file.size === 0) return;
  const url = await uploadImage(tenant.id, 'hero', file);
  if (!url) return;
  const cfg = await loadConfig(tenant.id);
  cfg.sections.hero.image_url = url;
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function uploadBeforeAfterImageAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const which = String(formData.get('which') ?? '');
  if (which !== 'before' && which !== 'after') return;
  const file = formData.get('image') as File | null;
  if (!file || file.size === 0) return;
  const url = await uploadImage(tenant.id, `ba-${which}`, file);
  if (!url) return;
  const cfg = await loadConfig(tenant.id);
  if (which === 'before') cfg.sections.before_after.before_image_url = url;
  else cfg.sections.before_after.after_image_url = url;
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

/* ===== Testimonials CRUD (enhanced) ===== */

export async function addTestimonialAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const name = String(formData.get('name') ?? '').trim();
  const text = String(formData.get('text') ?? '').trim();
  const role = String(formData.get('role') ?? '').trim() || undefined;
  const ratingRaw = String(formData.get('rating') ?? '5');
  const rating = Math.min(5, Math.max(1, parseInt(ratingRaw, 10) || 5));
  if (!name || !text) return;

  // Optional photo
  let photo_url: string | null = null;
  const photo = formData.get('photo') as File | null;
  if (photo && photo.size > 0) {
    photo_url = await uploadImage(tenant.id, 'testimonial', photo);
  }

  const cfg = await loadConfig(tenant.id);
  const item: TestimonialItem = { id: randomUUID(), name, text, role, rating, photo_url };
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
  cfg.sections.faq.items.push({ id: randomUUID(), q, a });
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

/* ===== Stats CRUD ===== */

export async function addStatAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const number = String(formData.get('number') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();
  if (!number || !label) return;
  const cfg = await loadConfig(tenant.id);
  cfg.sections.stats.items.push({ id: randomUUID(), number, label });
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function deleteStatAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const cfg = await loadConfig(tenant.id);
  cfg.sections.stats.items = cfg.sections.stats.items.filter((t) => t.id !== id);
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

/* ===== Learn points CRUD ===== */

export async function addLearnPointAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const text = String(formData.get('text') ?? '').trim();
  if (!text) return;
  const cfg = await loadConfig(tenant.id);
  cfg.sections.learn_points.items.push({ id: randomUUID(), text });
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function deleteLearnPointAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const cfg = await loadConfig(tenant.id);
  cfg.sections.learn_points.items = cfg.sections.learn_points.items.filter((t) => t.id !== id);
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

/* ===== Features (3 cards) CRUD ===== */

export async function addFeatureAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const icon = String(formData.get('icon') ?? '⭐').trim() || '⭐';
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (!title || !body) return;
  const cfg = await loadConfig(tenant.id);
  cfg.sections.features.items.push({ id: randomUUID(), icon, title, body });
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function deleteFeatureAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const cfg = await loadConfig(tenant.id);
  cfg.sections.features.items = cfg.sections.features.items.filter((t) => t.id !== id);
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

/* ===== Trusted-by logos CRUD ===== */

export async function addLogoAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const name = String(formData.get('name') ?? '').trim();
  const href = String(formData.get('href') ?? '').trim() || null;
  if (!name) return;

  let logo_url: string | null = null;
  const file = formData.get('logo') as File | null;
  if (file && file.size > 0) {
    logo_url = await uploadImage(tenant.id, 'logo', file);
  }

  const cfg = await loadConfig(tenant.id);
  cfg.sections.trusted_by.items.push({ id: randomUUID(), name, logo_url, href });
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function deleteLogoAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const cfg = await loadConfig(tenant.id);
  cfg.sections.trusted_by.items = cfg.sections.trusted_by.items.filter((t) => t.id !== id);
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

/* ===== Pricing tiers CRUD ===== */

export async function addPricingTierAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const name = String(formData.get('name') ?? '').trim();
  const price = String(formData.get('price') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || undefined;
  const featuresRaw = String(formData.get('features') ?? '').trim();
  const cta_label = String(formData.get('cta_label') ?? '').trim() || 'Elegir plan';
  const cta_href = String(formData.get('cta_href') ?? '').trim() || '#cursos';
  const highlighted = formData.get('highlighted') === 'on';
  if (!name || !price) return;
  const features = featuresRaw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const cfg = await loadConfig(tenant.id);
  const item: PricingTier = { id: randomUUID(), name, price, description, features, cta_label, cta_href, highlighted };
  cfg.sections.pricing.tiers.push(item);
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function deletePricingTierAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const cfg = await loadConfig(tenant.id);
  cfg.sections.pricing.tiers = cfg.sections.pricing.tiers.filter((t) => t.id !== id);
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

/* ===== Gallery items CRUD ===== */

export async function addGalleryImageAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const file = formData.get('image') as File | null;
  const caption = String(formData.get('caption') ?? '').trim() || undefined;
  if (!file || file.size === 0) return;
  const url = await uploadImage(tenant.id, 'gallery', file);
  if (!url) return;
  const cfg = await loadConfig(tenant.id);
  const item: GalleryItem = { id: randomUUID(), image_url: url, caption };
  cfg.sections.gallery.items.push(item);
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function deleteGalleryImageAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const cfg = await loadConfig(tenant.id);
  cfg.sections.gallery.items = cfg.sections.gallery.items.filter((i) => i.id !== id);
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

/* ===== Section duplication / templates ===== */

export async function duplicateSectionAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const key = String(formData.get('section') ?? '') as SectionKey;
  if (!(key in DEFAULT_SITE_CONFIG.sections)) return;
  // For now "duplicate" toggles enabled true (true clone needs separate keyspace).
  // Real duplicate requires breaking jsonb singleton into array of section instances —
  // post-MVP refactor. We just ensure the section is enabled.
  const cfg = await loadConfig(tenant.id);
  cfg.sections[key].enabled = true;
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export type ThemeKey = 'sample' | 'fitness' | 'tech' | 'business';

export async function applyThemeAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const theme = String(formData.get('theme') ?? '') as ThemeKey;
  if (!['sample', 'fitness', 'tech', 'business'].includes(theme)) return;

  // 'sample' reescribe el config completo con el default rich (descarta cambios)
  if (theme === 'sample') {
    const fresh = JSON.parse(JSON.stringify(DEFAULT_SITE_CONFIG));
    await saveConfig(tenant.id, fresh);
    revalidatePath('/site');
    return;
  }

  const cfg = await loadConfig(tenant.id);

  // Reset to a known good baseline per theme
  if (theme === 'fitness') {
    cfg.sections.hero.layout = 'split';
    cfg.sections.hero.subtitle = 'Transformá tu cuerpo y tu mente.';
    cfg.sections.hero.cta_label = 'Empezá hoy';
    cfg.sections.about.enabled = true;
    cfg.sections.about.title = 'Sobre la academia';
    cfg.sections.instructor.enabled = true;
    cfg.sections.instructor.title = 'Tu coach';
    cfg.sections.stats.enabled = true;
    cfg.sections.learn_points.enabled = true;
    cfg.sections.testimonials.enabled = true;
    cfg.sections.before_after.enabled = true;
    cfg.sections.faq.enabled = true;
    cfg.sections.cta_final.enabled = true;
    cfg.sections.cta_final.title = '¿Te animás al cambio?';
  } else if (theme === 'tech') {
    cfg.sections.hero.layout = 'centered';
    cfg.sections.hero.subtitle = 'Aprendé las skills que pide el mercado.';
    cfg.sections.hero.cta_label = 'Ver cursos';
    cfg.sections.trusted_by.enabled = true;
    cfg.sections.features.enabled = true;
    cfg.sections.features.title = 'Por qué elegirnos';
    cfg.sections.learn_points.enabled = true;
    cfg.sections.instructor.enabled = true;
    cfg.sections.testimonials.enabled = true;
    cfg.sections.faq.enabled = true;
    cfg.sections.cta_final.enabled = true;
  } else {
    // business
    cfg.sections.hero.layout = 'gallery';
    cfg.sections.hero.subtitle = 'Capacitate para escalar tu negocio.';
    cfg.sections.trusted_by.enabled = true;
    cfg.sections.about.enabled = true;
    cfg.sections.stats.enabled = true;
    cfg.sections.features.enabled = true;
    cfg.sections.pricing.enabled = true;
    cfg.sections.testimonials.enabled = true;
    cfg.sections.faq.enabled = true;
    cfg.sections.cta_final.enabled = true;
  }

  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

/* ===== Nav ===== */

export async function addNavLinkAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const label = String(formData.get('label') ?? '').trim();
  const href = String(formData.get('href') ?? '').trim();
  if (!label || !href) return;
  const cfg = await loadConfig(tenant.id);
  cfg.nav.links.push({ id: randomUUID(), label, href });
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function deleteNavLinkAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const cfg = await loadConfig(tenant.id);
  cfg.nav.links = cfg.nav.links.filter((l) => l.id !== id);
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function toggleNavLoginAction(): Promise<void> {
  const { tenant } = await requireOwner();
  const cfg = await loadConfig(tenant.id);
  cfg.nav.show_login = !cfg.nav.show_login;
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

/* ===== Footer ===== */

export async function updateFooterTextAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const text = String(formData.get('text') ?? '').trim();
  const cfg = await loadConfig(tenant.id);
  cfg.footer.text = text;
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function addFooterLinkAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const label = String(formData.get('label') ?? '').trim();
  const href = String(formData.get('href') ?? '').trim();
  if (!label || !href) return;
  const cfg = await loadConfig(tenant.id);
  cfg.footer.links.push({ id: randomUUID(), label, href });
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function deleteFooterLinkAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const cfg = await loadConfig(tenant.id);
  cfg.footer.links = cfg.footer.links.filter((l) => l.id !== id);
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function addSocialLinkAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const network = String(formData.get('network') ?? '') as SocialLink['network'];
  const href = String(formData.get('href') ?? '').trim();
  const valid = ['instagram','youtube','linkedin','twitter','tiktok','facebook','web'];
  if (!valid.includes(network) || !href) return;
  const cfg = await loadConfig(tenant.id);
  cfg.footer.socials.push({ id: randomUUID(), network, href });
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function deleteSocialLinkAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const cfg = await loadConfig(tenant.id);
  cfg.footer.socials = cfg.footer.socials.filter((l) => l.id !== id);
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

