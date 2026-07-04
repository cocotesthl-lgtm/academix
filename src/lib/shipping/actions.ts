'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

export type ShippingZone = {
  id: string;
  tenant_id: string;
  name: string;
  provinces: string[];  // códigos ISO como "AR-C", "AR-B". ["*"] = todas.
  is_pickup: boolean;
  is_default: boolean;
  sort_order: number;
};

export type ShippingRate = {
  id: string;
  tenant_id: string;
  zone_id: string;
  name: string;
  price_cents: number;
  free_from_cents: number | null;
  delivery_days_min: number | null;
  delivery_days_max: number | null;
  sort_order: number;
};

// Provincias AR con código ISO 3166-2
export const AR_PROVINCES: Array<{ code: string; name: string }> = [
  { code: 'AR-C', name: 'CABA' },
  { code: 'AR-B', name: 'Buenos Aires' },
  { code: 'AR-K', name: 'Catamarca' },
  { code: 'AR-H', name: 'Chaco' },
  { code: 'AR-U', name: 'Chubut' },
  { code: 'AR-X', name: 'Córdoba' },
  { code: 'AR-W', name: 'Corrientes' },
  { code: 'AR-E', name: 'Entre Ríos' },
  { code: 'AR-P', name: 'Formosa' },
  { code: 'AR-Y', name: 'Jujuy' },
  { code: 'AR-L', name: 'La Pampa' },
  { code: 'AR-F', name: 'La Rioja' },
  { code: 'AR-M', name: 'Mendoza' },
  { code: 'AR-N', name: 'Misiones' },
  { code: 'AR-Q', name: 'Neuquén' },
  { code: 'AR-R', name: 'Río Negro' },
  { code: 'AR-A', name: 'Salta' },
  { code: 'AR-J', name: 'San Juan' },
  { code: 'AR-D', name: 'San Luis' },
  { code: 'AR-Z', name: 'Santa Cruz' },
  { code: 'AR-S', name: 'Santa Fe' },
  { code: 'AR-G', name: 'Santiago del Estero' },
  { code: 'AR-V', name: 'Tierra del Fuego' },
  { code: 'AR-T', name: 'Tucumán' }
];

export function provinceName(code: string): string {
  const p = AR_PROVINCES.find((x) => x.code === code);
  return p?.name ?? code;
}

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

export async function createRateAction(zoneId: string, formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // Verificamos ownership
  const { data: z } = await svc.from('shipping_zones')
    .select('id').eq('id', zoneId).eq('tenant_id', tenant.id).maybeSingle<{ id: string }>();
  if (!z) throw new Error('zona no encontrada');

  const name = String(formData.get('name') ?? '').trim().slice(0, 60) || 'Estándar';
  const price = Math.max(0, Math.round(Number(formData.get('price_cents') ?? 0)));
  const freeFromRaw = Number(formData.get('free_from_cents') ?? 0);
  const freeFrom = freeFromRaw > 0 ? Math.round(freeFromRaw) : null;
  const dMin = Number(formData.get('delivery_days_min') ?? 0);
  const dMax = Number(formData.get('delivery_days_max') ?? 0);

  const { count } = await svc.from('shipping_rates')
    .select('id', { count: 'exact', head: true }).eq('zone_id', zoneId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('shipping_rates') as any).insert({
    tenant_id: tenant.id, zone_id: zoneId, name,
    price_cents: price, free_from_cents: freeFrom,
    delivery_days_min: dMin > 0 ? Math.round(dMin) : null,
    delivery_days_max: dMax > 0 ? Math.round(dMax) : null,
    sort_order: count ?? 0
  });
  revalidatePath('/shipping');
}

export async function updateRateAction(id: string, formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const name = String(formData.get('name') ?? '').trim().slice(0, 60) || 'Estándar';
  const price = Math.max(0, Math.round(Number(formData.get('price_cents') ?? 0)));
  const freeFromRaw = Number(formData.get('free_from_cents') ?? 0);
  const freeFrom = freeFromRaw > 0 ? Math.round(freeFromRaw) : null;
  const dMin = Number(formData.get('delivery_days_min') ?? 0);
  const dMax = Number(formData.get('delivery_days_max') ?? 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('shipping_rates') as any).update({
    name, price_cents: price, free_from_cents: freeFrom,
    delivery_days_min: dMin > 0 ? Math.round(dMin) : null,
    delivery_days_max: dMax > 0 ? Math.round(dMax) : null
  }).eq('id', id).eq('tenant_id', tenant.id);
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

export type RateOption = {
  rate_id: string;
  zone_id: string;
  zone_name: string;
  name: string;
  price_cents: number;
  is_free: boolean;
  delivery_label: string | null;  // "3-5 días hábiles"
};

/**
 * Calcula opciones de envío para un tenant + provincia + subtotal.
 * Retorna todas las rates de zonas que matchean la provincia (o "*" wildcard).
 * Marca como is_free si el subtotal supera el free_from_cents.
 */
export async function calculateShippingOptions(
  tenantId: string,
  provinceCode: string,
  subtotalCents: number
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rates } = await (svc.from('shipping_rates') as any)
    .select('id, zone_id, name, price_cents, free_from_cents, delivery_days_min, delivery_days_max, sort_order')
    .in('zone_id', zoneIds).order('sort_order', { ascending: true });
  const allRates = (rates ?? []) as Array<{
    id: string; zone_id: string; name: string; price_cents: number;
    free_from_cents: number | null;
    delivery_days_min: number | null; delivery_days_max: number | null;
    sort_order: number;
  }>;

  return allRates.map((r) => {
    const zone = matching.find((z) => z.id === r.zone_id)!;
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
      price_cents: isFree ? 0 : r.price_cents,
      is_free: isFree,
      delivery_label: deliveryLabel
    };
  });
}
