'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
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
  type CustomImagePos,
  type ManualCard
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

/**
 * Sanea una URL de imagen pegada por el usuario:
 * - vacía → null (limpia el campo)
 * - http(s) válido → la URL trim
 * - cualquier otro esquema (javascript:, data:, file:, …) → null (anti-XSS)
 * Las urls relativas (sin esquema) también se rechazan: queremos hotlinks
 * a CDNs/Drive/Unsplash, no rutas locales que no van a resolver.
 */
function safeImageUrl(raw: string): string | null {
  const v = raw.trim();
  if (v === '') return null;
  if (v.length > 2048) return null;
  try {
    const u = new URL(v);
    if (u.protocol === 'http:' || u.protocol === 'https:') return v;
    return null;
  } catch {
    return null;
  }
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

export async function setSectionTextColorAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const key = String(formData.get('section') ?? '') as SectionKey;
  const color = String(formData.get('text_color') ?? '').trim();
  if (!(key in DEFAULT_SITE_CONFIG.sections)) return;
  const cfg = await loadConfig(tenant.id);
  cfg.sections[key].text_color = color === '' || color.toLowerCase() === 'null' ? null : color;
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

/**
 * Setter genérico para cualquier campo de estilo opcional por sección
 * (title_color, body_color, accent_color, card_bg_color, card_border_color,
 * font_family, title_weight). String vacío = null (limpia override).
 */
const STYLE_FIELDS = new Set([
  'title_color', 'body_color', 'accent_color',
  'card_bg_color', 'card_border_color',
  'font_family', 'title_weight',
  // Background image + opacity
  'bg_image_url', 'bg_image_opacity', 'bg_image_position',
  // Text effects
  'text_effect',
  // Buttons
  'button_bg_color', 'button_text_color', 'button_border_color',
  'button_glow', 'button_hidden'
]);

// Campos boolean (almacenan true/false, no string)
const STYLE_BOOL_FIELDS = new Set(['button_glow', 'button_hidden']);
// Campos numericos (almacenan number 0..1)
const STYLE_NUMBER_FIELDS = new Set(['bg_image_opacity']);

export async function setSectionStyleFieldAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const key = String(formData.get('section') ?? '') as SectionKey;
  const field = String(formData.get('field') ?? '');
  const raw = String(formData.get('value') ?? '').trim();
  if (!(key in DEFAULT_SITE_CONFIG.sections)) return;
  if (!STYLE_FIELDS.has(field)) return;
  const cfg = await loadConfig(tenant.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const target = cfg.sections[key] as any;
  if (raw === '' || raw.toLowerCase() === 'null') {
    target[field] = null;
  } else if (STYLE_BOOL_FIELDS.has(field)) {
    target[field] = raw === 'true' || raw === 'on' || raw === '1';
  } else if (STYLE_NUMBER_FIELDS.has(field)) {
    const n = parseFloat(raw);
    target[field] = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : null;
  } else {
    // String — sanitize URLs (text_effect, colors, position)
    if (field === 'bg_image_url') {
      // URL validation básica — solo http/https
      try {
        const u = new URL(raw);
        target[field] = (u.protocol === 'http:' || u.protocol === 'https:') ? raw.slice(0, 2048) : null;
      } catch { target[field] = null; }
    } else {
      target[field] = raw.slice(0, 80);
    }
  }
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
  if (formData.has('max_visible')) {
    const n = parseInt(String(formData.get('max_visible') ?? '3'), 10);
    section.max_visible = Math.min(48, Math.max(1, Number.isFinite(n) ? n : 3));
  }
  if (formData.has('pagination_mode')) {
    const v = String(formData.get('pagination_mode') ?? 'show_more');
    section.pagination_mode = v === 'paginated' ? 'paginated' : 'show_more';
  }
  if (formData.has('cta_mode')) {
    const v = String(formData.get('cta_mode') ?? 'course_link');
    section.cta_mode = ['course_link', 'no_button', 'custom_url'].includes(v) ? v : 'course_link';
  }
  if (formData.has('cta_custom_href')) {
    section.cta_custom_href = String(formData.get('cta_custom_href') ?? '').slice(0, 500);
  }
  if (formData.has('manual_cards_position')) {
    const v = String(formData.get('manual_cards_position') ?? 'before');
    section.manual_cards_position = v === 'after' ? 'after' : 'before';
  }
  if (formData.has('show_auto_courses')) {
    section.show_auto_courses = formData.get('show_auto_courses') === 'on';
  }
  if (formData.has('card_style')) {
    const v = String(formData.get('card_style') ?? 'classic');
    section.card_style = v === 'compact' ? 'compact' : 'classic';
  }
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

/* ===== URL-based image setter ===== */

/**
 * Setea una URL de imagen para un campo de una sección.
 * field debe terminar en _url (image_url, photo_url, before_image_url, etc).
 * urlRaw vacío = setear null (limpia el campo).
 */
export async function setSectionImageUrlAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const key = String(formData.get('section') ?? '') as SectionKey;
  const field = String(formData.get('field') ?? '');
  const urlRaw = String(formData.get('url') ?? '');
  if (!(key in DEFAULT_SITE_CONFIG.sections)) return;
  if (!field.endsWith('_url')) return;

  const cfg = await loadConfig(tenant.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (cfg.sections[key] as any)[field] = safeImageUrl(urlRaw);
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

/* ===== Instructor items CRUD ===== */

export async function addInstructorItemAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const name = String(formData.get('name') ?? '').trim();
  const credentials = String(formData.get('credentials') ?? '').trim() || undefined;
  const bio = String(formData.get('bio') ?? '').trim() || undefined;
  const photoUrlRaw = String(formData.get('photo_url') ?? '');
  if (!name) return;
  const photo_url = safeImageUrl(photoUrlRaw);

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

/* ===== Testimonials CRUD (enhanced) ===== */

export async function addTestimonialAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const name = String(formData.get('name') ?? '').trim();
  const text = String(formData.get('text') ?? '').trim();
  const role = String(formData.get('role') ?? '').trim() || undefined;
  const ratingRaw = String(formData.get('rating') ?? '5');
  const rating = Math.min(5, Math.max(1, parseInt(ratingRaw, 10) || 5));
  if (!name || !text) return;

  const photoUrlRaw = String(formData.get('photo_url') ?? '');
  const photo_url = safeImageUrl(photoUrlRaw);

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
  const logoUrlRaw = String(formData.get('logo_url') ?? '');
  if (!name) return;
  const logo_url = safeImageUrl(logoUrlRaw);

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
  const imageUrlRaw = String(formData.get('image_url') ?? '');
  const caption = String(formData.get('caption') ?? '').trim() || undefined;
  const image_url = safeImageUrl(imageUrlRaw);
  if (!image_url) return; // si la url no es http(s) válida, no agregamos
  const cfg = await loadConfig(tenant.id);
  const item: GalleryItem = { id: randomUUID(), image_url, caption };
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

/* ===== Catalog: manual cards CRUD ===== */

const VALID_RIBBON_TONES = new Set(['featured', 'sale', 'urgent', 'new', 'info']);

function parseManualCardForm(formData: FormData): Omit<ManualCard, 'id'> | null {
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return null;
  const subtitle = String(formData.get('subtitle') ?? '').trim() || undefined;
  const body = String(formData.get('body') ?? '').trim() || undefined;
  const image_url = safeImageUrl(String(formData.get('image_url') ?? ''));
  const price = String(formData.get('price') ?? '').trim() || undefined;
  const old_price = String(formData.get('old_price') ?? '').trim() || undefined;
  const stock_label = String(formData.get('stock_label') ?? '').trim() || undefined;
  const ribbon_text = String(formData.get('ribbon_text') ?? '').trim().slice(0, 30) || undefined;
  const toneRaw = String(formData.get('ribbon_tone') ?? '').trim();
  const ribbon_tone = (VALID_RIBBON_TONES.has(toneRaw) ? toneRaw : 'featured') as ManualCard['ribbon_tone'];
  const cta_text = String(formData.get('cta_text') ?? '').trim().slice(0, 40) || undefined;
  const cta_href = String(formData.get('cta_href') ?? '').trim().slice(0, 500) || undefined;
  return { title: title.slice(0, 120), subtitle, body, image_url, price, old_price, stock_label, ribbon_text, ribbon_tone, cta_text, cta_href };
}

export async function addManualCardAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const data = parseManualCardForm(formData);
  if (!data) return;
  const cfg = await loadConfig(tenant.id);
  if (!Array.isArray(cfg.sections.catalog.manual_cards)) cfg.sections.catalog.manual_cards = [];
  cfg.sections.catalog.manual_cards.push({ id: randomUUID(), ...data });
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function updateManualCardAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const data = parseManualCardForm(formData);
  if (!data) return;
  const cfg = await loadConfig(tenant.id);
  const arr = cfg.sections.catalog.manual_cards ?? [];
  const idx = arr.findIndex((c) => c.id === id);
  if (idx === -1) return;
  arr[idx] = { id, ...data };
  cfg.sections.catalog.manual_cards = arr;
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function deleteManualCardAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const cfg = await loadConfig(tenant.id);
  cfg.sections.catalog.manual_cards = (cfg.sections.catalog.manual_cards ?? []).filter((c) => c.id !== id);
  await saveConfig(tenant.id, cfg);
  revalidatePath('/site');
}

export async function moveManualCardAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const dir = String(formData.get('dir') ?? '');
  if (dir !== 'up' && dir !== 'down') return;
  const cfg = await loadConfig(tenant.id);
  const arr = [...(cfg.sections.catalog.manual_cards ?? [])];
  const idx = arr.findIndex((c) => c.id === id);
  if (idx === -1) return;
  const newIdx = dir === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= arr.length) return;
  [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
  cfg.sections.catalog.manual_cards = arr;
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
  redirect('/site');
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
    revalidatePath('/dashboard');
    revalidatePath('/', 'layout');
    redirect('/site');
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
  } else if (theme === 'business') {
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
  // Las plantillas Hotmart y Funnel ya NO están acá — ahora son per-curso
  // en /owner/courses/[id] → sección "Landing page". El código histórico
  // está en git history si se necesitan recuperar.

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

