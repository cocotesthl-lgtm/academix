'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { SITE_TEMPLATES } from './catalog';
import { seedEcommerceDemoData } from './seed-ecommerce';
import { normalizeModules } from '@/lib/modules/types';

/** Aplica un template completo al sitio del tenant. Pisa todo el site_config. */
export async function applySiteTemplateAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const templateId = String(formData.get('template_id') ?? '');
  const tpl = SITE_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) return;

  const svc = getServiceClient();
  const patch: Record<string, unknown> = {
    site_config: tpl.config,
    updated_at: new Date().toISOString()
  };
  // Si el tenant no tiene un primary color custom (o es el default), aplicamos
  // el sugerido del template — ayuda a que el sitio se vea distinto al toque.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tRow } = await (svc.from('tenants') as any)
    .select('brand').eq('id', tenant.id).maybeSingle();
  const currentPrimary = tRow?.brand?.primary_color;
  // Si el tenant nunca tocó el color (default OfferNow o uno de los legacy)
  // aplicamos el sugerido del template — sino respetamos su elección.
  // Naranja (brand actual) + morado (legacy) + negro (sin elegir) = "no eligió"
  const defaults = ['#f97316', '#a855f7', '#0a0a0a', ''];
  if (!currentPrimary || defaults.includes(currentPrimary)) {
    patch.brand = { ...(tRow?.brand ?? {}), primary_color: tpl.suggestedPrimary };
  }

  // Ecommerce template → habilitar carrito automáticamente (sin cart no hay
  // tienda). El owner puede seguir apagándolo desde /owner/checkout si
  // realmente no lo quiere. Defensivo por si la migration 0034 está pendiente.
  if (tpl.id === 'ecommerce') {
    patch.cart_enabled = true;
    patch.cart_position = 'header';
    patch.cart_display = 'dropdown';
    // También activar el módulo 'ecommerce' + su macro 'catalog' para que
    // aparezca en el sidebar. Preservamos lo que el owner tenía prendido
    // en el resto de módulos. Sin esto, aplicar el template deja 'Productos
    // físicos' escondido del sidebar si el tenant tenía ese sub apagado.
    const currentModules = normalizeModules((tRow as { modules?: unknown } | null)?.modules);
    patch.modules = { ...currentModules, catalog: true, ecommerce: true, promotions: true, bundles: true };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updErr } = await (svc.from('tenants') as any).update(patch).eq('id', tenant.id);
  if (updErr && tpl.id === 'ecommerce') {
    // Reintento sin las columnas de carrito por si la migration 0034 está
    // pendiente en el tenant — no queremos que se rompa el apply del template.
    delete patch.cart_enabled;
    delete patch.cart_position;
    delete patch.cart_display;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const retry2 = await (svc.from('tenants') as any).update(patch).eq('id', tenant.id);
    if (retry2.error) {
      // Segundo reintento sin modules por si la migration 0045 está pendiente.
      delete patch.modules;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (svc.from('tenants') as any).update(patch).eq('id', tenant.id);
    }
  }

  // Ecommerce → sembrar categorías y productos reales en la DB si el tenant
  // está limpio. Aparecen en /owner/products y /owner/categorias listos para
  // que el owner solo cambie textos/precios/fotos (no arrancar de cero).
  // Si el tenant ya tiene productos o categorías, no tocamos nada.
  if (tpl.id === 'ecommerce') {
    try {
      await seedEcommerceDemoData(tenant.id);
    } catch (e) {
      // migration 0051 pendiente o error de RLS — no queremos que se rompa el
      // apply del template por eso. El owner puede crear los productos manual.
      console.error('[applySiteTemplate] seed ecommerce fallo (no critico):', e);
    }
  }

  revalidatePath('/owner/site');
  revalidatePath('/owner/templates');
  revalidatePath('/owner/products');
  revalidatePath('/owner/categories');
  redirect('/owner/site?templateApplied=' + encodeURIComponent(tpl.name));
}
