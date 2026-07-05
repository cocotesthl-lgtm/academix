'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import type { RateOption } from './types';

// ═══════════════════════════════════════════════════════════════
// Zonas
// ═══════════════════════════════════════════════════════════════

export async function createZoneAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  const name = String(formData.get('name') ?? '').trim().slice(0, 80) || 'Zona';
  const isPickup = formData.get('is_pickup') === 'on';
  const provincesRaw = formData.getAll('provinces').map((v) => String(v));
  const provinces = provincesRaw.length > 0 ? provincesRaw : ['*'];

  const { count } = await svc.from('shipping_zones')
    .select('id', { count: 'exact', head: true }).eq('tenant_id', tenant.id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('shipping_zones') as any).insert({
    tenant_id: tenant.id, name, provinces, is_pickup: isPickup,
    sort_order: count ?? 0
  });
  revalidatePath('/shipping');
}

export async function updateZoneAction(id: string, formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  const name = String(formData.get('name') ?? '').trim().slice(0, 80) || 'Zona';
  const isPickup = formData.get('is_pickup') === 'on';
  const provincesRaw = formData.getAll('provinces').map((v) => String(v));
  const provinces = provincesRaw.length > 0 ? provincesRaw : ['*'];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('shipping_zones') as any).update({
    name, provinces, is_pickup: isPickup
  }).eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/shipping');
}

export async function deleteZoneAction(id: string): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  await svc.from('shipping_zones').delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/shipping');
}

// ═══════════════════════════════════════════════════════════════
// Tarifas
// ═══════════════════════════════════════════════════════════════

function parseRateFields(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim().slice(0, 60) || 'Estándar';
  const price = Math.max(0, Math.round(Number(formData.get('price_cents') ?? 0)));
  const freeFromRaw = Number(formData.get('free_from_cents') ?? 0);
  const freeFrom = freeFromRaw > 0 ? Math.round(freeFromRaw) : null;
  const dMin = Number(formData.get('delivery_days_min') ?? 0);
  const dMax = Number(formData.get('delivery_days_max') ?? 0);
  const perKgRaw = Number(formData.get('per_kg_cents') ?? 0);
  const perKg = perKgRaw > 0 ? Math.round(perKgRaw) : null;
  const includedGramsRaw = Number(formData.get('included_grams') ?? 0);
  const includedGrams = includedGramsRaw > 0 ? Math.round(includedGramsRaw) : (perKg ? 1000 : null);
  return {
    name, price_cents: price, free_from_cents: freeFrom,
    delivery_days_min: dMin > 0 ? Math.round(dMin) : null,
    delivery_days_max: dMax > 0 ? Math.round(dMax) : null,
    per_kg_cents: perKg, included_grams: includedGrams
  };
}

export async function createRateAction(zoneId: string, formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  const { data: z } = await svc.from('shipping_zones')
    .select('id').eq('id', zoneId).eq('tenant_id', tenant.id).maybeSingle<{ id: string }>();
  if (!z) throw new Error('zona no encontrada');

  const fields = parseRateFields(formData);

  const { count } = await svc.from('shipping_rates')
    .select('id', { count: 'exact', head: true }).eq('zone_id', zoneId);

  // Defensivo: si migration 0053 no corrió, dropeamos per_kg_cents/included_grams.
  const payload: Record<string, unknown> = {
    tenant_id: tenant.id, zone_id: zoneId,
    ...fields,
    sort_order: count ?? 0
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('shipping_rates') as any).insert(payload);
    if (error && error.message.includes('per_kg_cents')) {
      delete payload.per_kg_cents; delete payload.included_grams;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('shipping_rates') as any).insert(payload);
    } else if (error) {
      throw error;
    }
  } catch (e) {
    if (String(e).includes('per_kg_cents')) {
      delete payload.per_kg_cents; delete payload.included_grams;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('shipping_rates') as any).insert(payload);
    } else {
      throw e;
    }
  }
  revalidatePath('/shipping');
}

export async function updateRateAction(id: string, formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const fields = parseRateFields(formData);
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (svc.from('shipping_rates') as any).update(fields)
      .eq('id', id).eq('tenant_id', tenant.id);
    if (error && error.message.includes('per_kg_cents')) {
      const legacy: Record<string, unknown> = { ...fields };
      delete legacy.per_kg_cents; delete legacy.included_grams;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('shipping_rates') as any).update(legacy)
        .eq('id', id).eq('tenant_id', tenant.id);
    } else if (error) {
      throw error;
    }
  } catch (e) {
    if (String(e).includes('per_kg_cents')) {
      const legacy: Record<string, unknown> = { ...fields };
      delete legacy.per_kg_cents; delete legacy.included_grams;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('shipping_rates') as any).update(legacy)
        .eq('id', id).eq('tenant_id', tenant.id);
    } else {
      throw e;
    }
  }
  revalidatePath('/shipping');
}

export async function deleteRateAction(id: string): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  await svc.from('shipping_rates').delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/shipping');
}

// ═══════════════════════════════════════════════════════════════
// Cálculo de tarifas (público — usado en checkout)
// ═══════════════════════════════════════════════════════════════

/**
 * Calcula opciones de envío para un tenant + provincia + subtotal + peso total.
 * Retorna todas las rates de zonas que matchean la provincia (o "*" wildcard).
 *
 * Precio final por rate:
 *   costo = price_cents + max(0, weight_g - included_grams) * per_kg_cents / 1000
 * (si per_kg_cents no está seteado, costo = price_cents)
 *
 * is_free se aplica DESPUÉS del cálculo de peso: si el subtotal supera
 * free_from_cents, el envío es gratis independientemente del peso.
 */
export async function calculateShippingOptions(
  tenantId: string,
  provinceCode: string,
  subtotalCents: number,
  totalWeightG = 0
): Promise<RateOption[]> {
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: zones } = await (svc.from('shipping_zones') as any)
    .select('id, name, provinces, is_pickup, sort_order')
    .eq('tenant_id', tenantId).order('sort_order', { ascending: true });
  const allZones = (zones ?? []) as Array<{
    id: string; name: string; provinces: string[];
    is_pickup: boolean; sort_order: number;
  }>;
  const matching = allZones.filter((z) =>
    z.is_pickup ||
    z.provinces.includes('*') ||
    z.provinces.includes(provinceCode)
  );
  if (matching.length === 0) return [];

  const zoneIds = matching.map((z) => z.id);
  // Defensivo: si migration 0053 no corrió, per_kg_cents/included_grams no existen.
  // Intentamos con el set completo y caemos al legacy si falla.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rates: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (svc.from('shipping_rates') as any)
      .select('id, zone_id, name, price_cents, free_from_cents, delivery_days_min, delivery_days_max, per_kg_cents, included_grams, sort_order')
      .in('zone_id', zoneIds).order('sort_order', { ascending: true });
    if (res.error) throw res.error;
    rates = res.data;
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (svc.from('shipping_rates') as any)
      .select('id, zone_id, name, price_cents, free_from_cents, delivery_days_min, delivery_days_max, sort_order')
      .in('zone_id', zoneIds).order('sort_order', { ascending: true });
    rates = res.data;
  }
  const allRates = (rates ?? []) as Array<{
    id: string; zone_id: string; name: string; price_cents: number;
    free_from_cents: number | null;
    delivery_days_min: number | null; delivery_days_max: number | null;
    per_kg_cents?: number | null; included_grams?: number | null;
    sort_order: number;
  }>;

  return allRates.map((r) => {
    const zone = matching.find((z) => z.id === r.zone_id)!;
    // Cálculo con peso: sumamos (kg extra sobre included) * per_kg_cents.
    let price = r.price_cents;
    if (r.per_kg_cents && r.per_kg_cents > 0 && totalWeightG > 0) {
      const included = r.included_grams ?? 1000;
      const extraG = Math.max(0, totalWeightG - included);
      const extraCost = Math.round(extraG * r.per_kg_cents / 1000);
      price += extraCost;
    }
    const isFree = r.free_from_cents != null && subtotalCents >= r.free_from_cents;
    let deliveryLabel: string | null = null;
    if (zone.is_pickup) {
      deliveryLabel = 'Retiro en local';
    } else if (r.delivery_days_min && r.delivery_days_max) {
      deliveryLabel = `${r.delivery_days_min}-${r.delivery_days_max} días hábiles`;
    } else if (r.delivery_days_max) {
      deliveryLabel = `hasta ${r.delivery_days_max} días hábiles`;
    }
    return {
      rate_id: r.id,
      zone_id: r.zone_id,
      zone_name: zone.name,
      name: r.name,
      price_cents: isFree ? 0 : price,
      is_free: isFree,
      is_pickup: zone.is_pickup,
      delivery_label: deliveryLabel
    };
  });
}
