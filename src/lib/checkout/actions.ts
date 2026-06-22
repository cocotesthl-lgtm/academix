'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import {
  mergeCheckoutConfig,
  sanitizeFieldKey,
  type CheckoutConfig,
  type CheckoutField,
  type CheckoutFieldType,
  type BaseFieldKey
} from './types';

const FIELD_TYPES: CheckoutFieldType[] = ['text', 'email', 'tel', 'textarea', 'select', 'radio', 'multi', 'checkbox', 'date', 'number', 'heading'];

/** ───── Helpers de carga/guardado ───── */

async function loadTenantConfig(tenantId: string): Promise<CheckoutConfig> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('tenants')
    .select('checkout_config')
    .eq('id', tenantId)
    .single<{ checkout_config: unknown }>();
  return mergeCheckoutConfig(data?.checkout_config);
}

async function saveTenantConfig(tenantId: string, cfg: CheckoutConfig): Promise<void> {
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any)
    .update({ checkout_config: cfg, updated_at: new Date().toISOString() })
    .eq('id', tenantId);
}

async function loadCourseConfigRaw(courseId: string, tenantId: string): Promise<unknown> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('courses')
    .select('checkout_config')
    .eq('id', courseId).eq('tenant_id', tenantId)
    .maybeSingle<{ checkout_config: unknown }>();
  return data?.checkout_config ?? null;
}

async function saveCourseConfig(courseId: string, tenantId: string, cfg: CheckoutConfig | null): Promise<void> {
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('courses') as any)
    .update({ checkout_config: cfg, updated_at: new Date().toISOString() })
    .eq('id', courseId).eq('tenant_id', tenantId);
}

/** ───── Presets de checkout (reducen fricción al configurar) ─────
 *  El owner elige un preset y aplica un set predefinido de campos en 1 click,
 *  en vez de tildar checkbox por checkbox. Puede afinar después.
 *  Definiciones en ./presets.ts (no se pueden exportar consts desde 'use server'). */

import { PRESETS, type CheckoutPresetId } from './presets';

export async function applyTenantCheckoutPresetAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const preset = String(formData.get('preset') ?? '') as CheckoutPresetId;
  if (!(preset in PRESETS)) return;
  // deep clone para evitar mutar el preset
  const cfg = JSON.parse(JSON.stringify(PRESETS[preset])) as CheckoutConfig;
  await saveTenantConfig(tenant.id, cfg);
  revalidatePath('/owner/checkout');
}

export async function applyCourseCheckoutPresetAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const courseId = String(formData.get('course_id') ?? '');
  const preset = String(formData.get('preset') ?? '') as CheckoutPresetId;
  if (!courseId || !(preset in PRESETS)) return;
  const cfg = JSON.parse(JSON.stringify(PRESETS[preset])) as CheckoutConfig;
  await saveCourseConfig(courseId, tenant.id, cfg);
  revalidatePath(`/owner/courses/${courseId}`);
}

/** ───── Acciones a nivel TENANT (default global) ───── */

/** Toggle global del modo carrito (tenants.cart_enabled boolean) */
export async function setCartEnabledAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const enabled = formData.get('cart_enabled') === 'on' || formData.get('cart_enabled') === 'true';
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any)
    .update({ cart_enabled: enabled, updated_at: new Date().toISOString() })
    .eq('id', tenant.id);
  revalidatePath('/owner/checkout');
}

export async function setTenantBaseFieldAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const key = String(formData.get('field') ?? '') as BaseFieldKey;
  if (!['name', 'dni', 'phone', 'location'].includes(key)) return;
  const prop = String(formData.get('prop') ?? '');
  if (prop !== 'enabled' && prop !== 'required') return;
  const value = formData.get('value') === 'true';

  const cfg = await loadTenantConfig(tenant.id);
  cfg.base_fields[key][prop] = value;
  // Si lo desactivamos, también dejar de exigirlo.
  if (prop === 'enabled' && !value) cfg.base_fields[key].required = false;
  await saveTenantConfig(tenant.id, cfg);
  revalidatePath('/checkout');
}

export async function addTenantExtraFieldAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const label = String(formData.get('label') ?? '').trim().slice(0, 80);
  const typeRaw = String(formData.get('type') ?? 'text') as CheckoutFieldType;
  const type: CheckoutFieldType = FIELD_TYPES.includes(typeRaw) ? typeRaw : 'text';
  if (!label) return;

  const cfg = await loadTenantConfig(tenant.id);
  cfg.extra_fields.push({
    id: randomUUID(),
    key: sanitizeFieldKey(label),
    label,
    type,
    required: false,
    position: cfg.extra_fields.length
  });
  await saveTenantConfig(tenant.id, cfg);
  revalidatePath('/checkout');
}

export async function updateTenantExtraFieldAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const cfg = await loadTenantConfig(tenant.id);
  const field = cfg.extra_fields.find((f) => f.id === id);
  if (!field) return;

  // Cualquier prop modificable se pasa como key=value en el form.
  const label = formData.get('label');
  if (label !== null) field.label = String(label).trim().slice(0, 80) || field.label;
  const placeholder = formData.get('placeholder');
  if (placeholder !== null) field.placeholder = String(placeholder).slice(0, 120) || undefined;
  const helper = formData.get('helper');
  if (helper !== null) field.helper = String(helper).slice(0, 200) || undefined;
  const required = formData.get('required');
  if (required !== null) field.required = required === 'true' || required === 'on';
  const optionsCsv = formData.get('options');
  if (optionsCsv !== null) {
    field.options = String(optionsCsv).split(',').map((o) => o.trim()).filter(Boolean).slice(0, 30);
  }
  const typeRaw = formData.get('type');
  if (typeRaw !== null) {
    const t = String(typeRaw) as CheckoutFieldType;
    if (FIELD_TYPES.includes(t)) field.type = t;
  }
  // Checkbox: default_checked + price_delta_cents
  const defaultChecked = formData.get('default_checked');
  if (defaultChecked !== null) {
    field.default_checked = defaultChecked === 'true' || defaultChecked === 'on';
  }
  const priceDeltaRaw = formData.get('price_delta');
  if (priceDeltaRaw !== null) {
    const cents = Math.round(parseFloat(String(priceDeltaRaw).replace(/[^0-9.-]/g, '') || '0') * 100);
    field.price_delta_cents = Number.isNaN(cents) ? 0 : cents;
  }
  await saveTenantConfig(tenant.id, cfg);
  revalidatePath('/checkout');
}

export async function deleteTenantExtraFieldAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  if (!id) return;
  const cfg = await loadTenantConfig(tenant.id);
  cfg.extra_fields = cfg.extra_fields.filter((f) => f.id !== id);
  cfg.extra_fields.forEach((f, idx) => { f.position = idx; });
  await saveTenantConfig(tenant.id, cfg);
  revalidatePath('/checkout');
}

export async function moveTenantExtraFieldAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const id = String(formData.get('id') ?? '');
  const dir = String(formData.get('dir') ?? '');
  if (!id || (dir !== 'up' && dir !== 'down')) return;

  const cfg = await loadTenantConfig(tenant.id);
  const idx = cfg.extra_fields.findIndex((f) => f.id === id);
  if (idx === -1) return;
  const j = dir === 'up' ? idx - 1 : idx + 1;
  if (j < 0 || j >= cfg.extra_fields.length) return;
  [cfg.extra_fields[idx], cfg.extra_fields[j]] = [cfg.extra_fields[j], cfg.extra_fields[idx]];
  cfg.extra_fields.forEach((f, i) => { f.position = i; });
  await saveTenantConfig(tenant.id, cfg);
  revalidatePath('/checkout');
}

/** ───── Override por CURSO ───── */

/**
 * Cuando el owner pone "usar default del tenant" para este curso, guardamos
 * null. Cuando dice "tener config propia", clonamos la del tenant como punto
 * de partida y la persistimos en el curso.
 */
export async function setCourseUseDefaultAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const courseId = String(formData.get('course_id') ?? '');
  const useDefault = formData.get('use_default') === 'true';
  if (!courseId) return;

  if (useDefault) {
    await saveCourseConfig(courseId, tenant.id, null);
  } else {
    // Bootstrap clonando el default del tenant
    const tenantCfg = await loadTenantConfig(tenant.id);
    await saveCourseConfig(courseId, tenant.id, tenantCfg);
  }
  revalidatePath(`/courses/${courseId}`);
}

async function withCourseConfig(
  courseId: string,
  tenantId: string,
  mutate: (cfg: CheckoutConfig) => void
): Promise<void> {
  const raw = await loadCourseConfigRaw(courseId, tenantId);
  if (!raw) return; // curso usa default del tenant, no se edita acá
  const cfg = mergeCheckoutConfig(raw);
  mutate(cfg);
  await saveCourseConfig(courseId, tenantId, cfg);
  revalidatePath(`/courses/${courseId}`);
}

export async function setCourseBaseFieldAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const courseId = String(formData.get('course_id') ?? '');
  const key = String(formData.get('field') ?? '') as BaseFieldKey;
  const prop = String(formData.get('prop') ?? '');
  if (!courseId || !['name', 'dni', 'phone', 'location'].includes(key)) return;
  if (prop !== 'enabled' && prop !== 'required') return;
  const value = formData.get('value') === 'true';
  await withCourseConfig(courseId, tenant.id, (cfg) => {
    cfg.base_fields[key][prop] = value;
    if (prop === 'enabled' && !value) cfg.base_fields[key].required = false;
  });
}

export async function addCourseExtraFieldAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const courseId = String(formData.get('course_id') ?? '');
  const label = String(formData.get('label') ?? '').trim().slice(0, 80);
  const typeRaw = String(formData.get('type') ?? 'text') as CheckoutFieldType;
  const type: CheckoutFieldType = FIELD_TYPES.includes(typeRaw) ? typeRaw : 'text';
  if (!courseId || !label) return;

  await withCourseConfig(courseId, tenant.id, (cfg) => {
    cfg.extra_fields.push({
      id: randomUUID(),
      key: sanitizeFieldKey(label),
      label, type, required: false,
      position: cfg.extra_fields.length
    });
  });
}

export async function updateCourseExtraFieldAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const courseId = String(formData.get('course_id') ?? '');
  const id = String(formData.get('id') ?? '');
  if (!courseId || !id) return;

  await withCourseConfig(courseId, tenant.id, (cfg) => {
    const field = cfg.extra_fields.find((f) => f.id === id);
    if (!field) return;
    const label = formData.get('label');
    if (label !== null) field.label = String(label).trim().slice(0, 80) || field.label;
    const placeholder = formData.get('placeholder');
    if (placeholder !== null) field.placeholder = String(placeholder).slice(0, 120) || undefined;
    const helper = formData.get('helper');
    if (helper !== null) field.helper = String(helper).slice(0, 200) || undefined;
    const required = formData.get('required');
    if (required !== null) field.required = required === 'true' || required === 'on';
    const optionsCsv = formData.get('options');
    if (optionsCsv !== null) {
      field.options = String(optionsCsv).split(',').map((o) => o.trim()).filter(Boolean).slice(0, 30);
    }
    const typeRaw = formData.get('type');
    if (typeRaw !== null) {
      const t = String(typeRaw) as CheckoutFieldType;
      if (FIELD_TYPES.includes(t)) field.type = t;
    }
    const defaultChecked = formData.get('default_checked');
    if (defaultChecked !== null) {
      field.default_checked = defaultChecked === 'true' || defaultChecked === 'on';
    }
    const priceDeltaRaw = formData.get('price_delta');
    if (priceDeltaRaw !== null) {
      const cents = Math.round(parseFloat(String(priceDeltaRaw).replace(/[^0-9.-]/g, '') || '0') * 100);
      field.price_delta_cents = Number.isNaN(cents) ? 0 : cents;
    }
  });
}

export async function deleteCourseExtraFieldAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const courseId = String(formData.get('course_id') ?? '');
  const id = String(formData.get('id') ?? '');
  if (!courseId || !id) return;
  await withCourseConfig(courseId, tenant.id, (cfg) => {
    cfg.extra_fields = cfg.extra_fields.filter((f) => f.id !== id);
    cfg.extra_fields.forEach((f, idx) => { f.position = idx; });
  });
}

export async function moveCourseExtraFieldAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const courseId = String(formData.get('course_id') ?? '');
  const id = String(formData.get('id') ?? '');
  const dir = String(formData.get('dir') ?? '');
  if (!courseId || !id || (dir !== 'up' && dir !== 'down')) return;
  await withCourseConfig(courseId, tenant.id, (cfg) => {
    const idx = cfg.extra_fields.findIndex((f) => f.id === id);
    if (idx === -1) return;
    const j = dir === 'up' ? idx - 1 : idx + 1;
    if (j < 0 || j >= cfg.extra_fields.length) return;
    [cfg.extra_fields[idx], cfg.extra_fields[j]] = [cfg.extra_fields[j], cfg.extra_fields[idx]];
    cfg.extra_fields.forEach((f, i) => { f.position = i; });
  });
}
