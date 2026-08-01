'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { isGradient } from '@/lib/theme/presets';

export type BrandSwatch = {
  id: string;
  value: string;
  kind: 'solid' | 'gradient';
  created_at: string;
};

/** Fetch de swatches del tenant. Silencioso si migration 0091 no corrió. */
export async function getBrandSwatches(tenantId: string): Promise<BrandSwatch[]> {
  const svc = getServiceClient();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('tenants') as any)
      .select('brand_swatches').eq('id', tenantId).maybeSingle();
    if (error) return [];
    const raw = ((data ?? {}) as { brand_swatches?: unknown }).brand_swatches;
    if (!Array.isArray(raw)) return [];
    return (raw as BrandSwatch[]).filter((s) => s && typeof s.value === 'string');
  } catch {
    return [];
  }
}

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Agregar un swatch al brand. Si ya existe (mismo value), no duplica.
 * Máx 24 swatches (rotamos el más viejo).
 */
export async function pinBrandSwatchAction(value: string): Promise<void> {
  const { tenant } = await requireOwner();
  const clean = (value ?? '').trim();
  if (!clean) return;
  const kind: 'solid' | 'gradient' = isGradient(clean) ? 'gradient' : 'solid';

  const existing = await getBrandSwatches(tenant.id);
  if (existing.some((s) => s.value === clean)) return;

  const next: BrandSwatch[] = [
    { id: generateId(), value: clean, kind, created_at: new Date().toISOString() },
    ...existing
  ].slice(0, 24);

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any)
    .update({ brand_swatches: next }).eq('id', tenant.id);
  revalidatePath('/site');
  revalidatePath('/branding');
}

/** Auto-add sin cache invalidation (para llamar desde otras actions). */
export async function autoPinBrandSwatch(tenantId: string, value: string): Promise<void> {
  const clean = (value ?? '').trim();
  if (!clean) return;
  const kind: 'solid' | 'gradient' = isGradient(clean) ? 'gradient' : 'solid';
  const existing = await getBrandSwatches(tenantId);
  if (existing.some((s) => s.value === clean)) return;
  const next: BrandSwatch[] = [
    { id: generateId(), value: clean, kind, created_at: new Date().toISOString() },
    ...existing
  ].slice(0, 24);
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any)
    .update({ brand_swatches: next }).eq('id', tenantId);
}

/** Quitar un swatch por id. */
export async function unpinBrandSwatchAction(id: string): Promise<void> {
  const { tenant } = await requireOwner();
  const existing = await getBrandSwatches(tenant.id);
  const next = existing.filter((s) => s.id !== id);
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any)
    .update({ brand_swatches: next }).eq('id', tenant.id);
  revalidatePath('/site');
  revalidatePath('/branding');
}
