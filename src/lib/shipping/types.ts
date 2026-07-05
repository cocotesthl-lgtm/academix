/**
 * Constantes y tipos de shipping. Sin 'use server' — se importan desde
 * server components, client components y route handlers indistintamente.
 * Las mutaciones (createZoneAction, etc.) viven en ./actions.
 */

export type ShippingZone = {
  id: string;
  tenant_id: string;
  name: string;
  provinces: string[];
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
  per_kg_cents: number | null;
  included_grams: number | null;
  sort_order: number;
};

export type RateOption = {
  rate_id: string;
  zone_id: string;
  zone_name: string;
  name: string;
  price_cents: number;
  is_free: boolean;
  is_pickup: boolean;
  delivery_label: string | null;
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
