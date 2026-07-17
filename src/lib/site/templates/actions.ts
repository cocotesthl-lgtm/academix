'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { SITE_TEMPLATES } from './catalog';
import { seedEcommerceDemoData } from './seed-ecommerce';
import { seedNewsDemoData } from './seed-news';
import { normalizeModules, type Modules, type ModuleKey } from '@/lib/modules/types';

/**
 * Macros estructurales que siempre quedan prendidos, incluso cuando el
 * template no los declara. No son "apps" sino funcionalidad de panel
 * (Personas, Ventas, Mi sitio) — apagarlos rompería la navegación.
 */
const BASELINE_MACROS: ModuleKey[] = ['team', 'sales', 'site'];

/**
 * Construye el set de módulos final: arranca de todo apagado, prende los
 * declarados por el template y siempre garantiza los macros baseline.
 */
function computeTemplateModules(declared: ModuleKey[]): Modules {
  const out = {} as Modules;
  // Arrancar todo en false
  const allKeys = Object.keys(normalizeModules({})) as ModuleKey[];
  for (const k of allKeys) out[k] = false;
  // Prender los del template
  for (const k of declared) out[k] = true;
  // Baseline siempre on
  for (const k of BASELINE_MACROS) out[k] = true;
  return out;
}

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
  }

  // Módulos: si el template declara qué apps necesita, se aplica ese set
  // exacto (apagando todo lo demás excepto los macros baseline). Sin esto
  // los tenants nuevos arrancaban con todas las apps prendidas aunque el
  // template fuera de un rubro que solo usa una o dos.
  if (Array.isArray(tpl.modules)) {
    patch.modules = computeTemplateModules(tpl.modules);
  }
  // Silenciar el aviso de "tRow no se usa" cuando ninguno de los checks
  // arriba lo referencia (por ejemplo si no es ecommerce y no tocamos
  // brand). Ya lo leímos porque necesitamos el brand actual.
  void tRow;

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

  // ── Ya no seedeamos data per-tenant ────────────────────────────────
  // Migration 0067 introdujo el pool demo global (demo_articles,
  // demo_course_categories, demo_physical_products). Los templates
  // ahora solo modifican site_config; el contenido demo vive UNA VEZ
  // en el pool global y los queries de storefront hacen UNION real +
  // pool visible (queries en src/lib/demo-pool/queries.ts).
  //
  // Ventaja: 1000 tenants con template Noticias = ~40 rows GLOBALES
  // en vez de 40.000 duplicadas. Cuando el owner edita un demo, se
  // materializa (copy-on-edit) via helpers en demo-pool/mutations.ts.
  //
  // Los seed-*.ts viejos quedan como referencia pero ya no se ejecutan
  // desde el flow de aplicar template. Sirven para poblar el pool
  // demo (una sola vez, via migration 0068_populate_demo_pool.sql).
  void seedEcommerceDemoData; void seedNewsDemoData;

  revalidatePath('/owner/site');
  revalidatePath('/owner/templates');
  revalidatePath('/owner/products');
  revalidatePath('/owner/categories');
  revalidatePath('/owner/blog');
  revalidatePath('/owner/categorias');
  // Invalidar el storefront público — los artículos seeded se ven en /
  // (portada newspaper) y en /blog. Sin esto quedan cacheados los "0 artículos".
  revalidatePath('/', 'layout');
  redirect('/owner/site?templateApplied=' + encodeURIComponent(tpl.name));
}
