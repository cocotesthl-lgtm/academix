import 'server-only';
import { getServiceClient } from '@/lib/supabase/service';

/**
 * Crea zonas + tarifas de envío default para un tenant que todavía no
 * tiene ninguna configurada. Idempotente: si ya hay zonas, no hace nada.
 *
 * Se llama al entrar a /owner/shipping (defensivo) y al finalizar el
 * primer checkout físico — así el buyer nunca ve "no tenemos envío
 * disponible para tu provincia".
 *
 * Defaults pensados para Argentina (mercado principal). El owner puede
 * editar precios o eliminar zonas cuando quiera desde el ShippingManager.
 */
export async function ensureDefaultShippingZones(tenantId: string): Promise<void> {
  const svc = getServiceClient();

  // ¿Ya tiene alguna zona? → no tocamos nada
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (svc.from('shipping_zones') as any)
    .select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
  if (count && count > 0) return;

  // 3 zonas que cubren todo AR:
  //  1. CABA + GBA — provincias densas, envío más barato
  //  2. Interior (resto del país) — fallback vía ["*"]
  //  3. Retiro en local — gratis, sin dirección
  const zonesToInsert = [
    {
      tenant_id: tenantId,
      name: 'CABA + GBA',
      // AR-C = CABA, AR-B = Buenos Aires. Códigos ISO 3166-2 usados en todo el sistema.
      provinces: ['AR-C', 'AR-B'],
      is_pickup: false,
      is_default: false,
      sort_order: 0
    },
    {
      tenant_id: tenantId,
      name: 'Interior del país',
      // ['*'] = cualquier provincia (AR-M/AR-X/AR-S/…). Sirve de fallback.
      provinces: ['*'],
      is_pickup: false,
      is_default: true,
      sort_order: 1
    },
    {
      tenant_id: tenantId,
      name: 'Retiro en local',
      provinces: ['*'],
      is_pickup: true,
      is_default: false,
      sort_order: 2
    }
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: insertedZones, error: zErr } = await (svc.from('shipping_zones') as any)
    .insert(zonesToInsert).select('id, name, is_pickup');
  if (zErr || !insertedZones) return;

  const zones = insertedZones as Array<{ id: string; name: string; is_pickup: boolean }>;
  const cabaZone = zones.find((z) => z.name === 'CABA + GBA');
  const interiorZone = zones.find((z) => z.name === 'Interior del país');
  const pickupZone = zones.find((z) => z.name === 'Retiro en local');

  // Tarifas por zona. Precios pensados como "razonables 2026" — el owner
  // los ajusta con sus costos reales cuando entra a /owner/shipping.
  const ratesToInsert: Array<Record<string, unknown>> = [];
  if (cabaZone) {
    ratesToInsert.push({
      tenant_id: tenantId, zone_id: cabaZone.id, name: 'Estándar (48hs)',
      price_cents: 2500_00, free_from_cents: 50000_00,
      delivery_days_min: 2, delivery_days_max: 3, sort_order: 0
    });
    ratesToInsert.push({
      tenant_id: tenantId, zone_id: cabaZone.id, name: 'Express (24hs)',
      price_cents: 4500_00, free_from_cents: null,
      delivery_days_min: 1, delivery_days_max: 1, sort_order: 1
    });
  }
  if (interiorZone) {
    ratesToInsert.push({
      tenant_id: tenantId, zone_id: interiorZone.id, name: 'Correo Argentino',
      price_cents: 4500_00, free_from_cents: 80000_00,
      delivery_days_min: 5, delivery_days_max: 10, sort_order: 0
    });
    ratesToInsert.push({
      tenant_id: tenantId, zone_id: interiorZone.id, name: 'OCA / Andreani',
      price_cents: 6500_00, free_from_cents: null,
      delivery_days_min: 3, delivery_days_max: 5, sort_order: 1
    });
  }
  if (pickupZone) {
    ratesToInsert.push({
      tenant_id: tenantId, zone_id: pickupZone.id, name: 'Retiro sin cargo',
      price_cents: 0, free_from_cents: null,
      delivery_days_min: 0, delivery_days_max: 1, sort_order: 0
    });
  }

  if (ratesToInsert.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('shipping_rates') as any).insert(ratesToInsert);
  }
}
