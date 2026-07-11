import { requireOwner } from '@/lib/auth/guards';
import { getTenantModules } from '@/lib/modules/queries';
import { MODULE_KEYS, MODULE_META, MODULE_LEVEL, type ModuleKey } from '@/lib/modules/types';
import { PageHeader } from '@/components/owner/PageHeader';
import { AppMarket, type AppCard } from '@/components/owner/apps/AppMarket';

export const dynamic = 'force-dynamic';

/**
 * /owner/modulos — App Market estilo Wix.
 *
 * Cada submódulo es una "app" con card en un grid. Click en card abre modal
 * con descripción larga + features + botón Instalar/Desinstalar.
 *
 * Los macros (Catálogo/Agenda/CRM/etc.) actúan como categorías del store,
 * no se instalan sueltos — se prenden automáticamente al instalar cualquier
 * app de su categoría (o quedan visibles como filtro).
 */
export default async function ModulosPage() {
  const { tenant } = await requireOwner();
  const modules = await getTenantModules(tenant.id);

  // Sólo mostramos apps (submódulos). Los macros son categorías, no apps.
  const subKeys = MODULE_KEYS.filter((k) => MODULE_LEVEL[k] === 'sub');

  const apps: AppCard[] = subKeys.map((key) => {
    const meta = MODULE_META[key];
    // Rating fake pero estable por key para que se vea creíble
    const seed = hashSeed(key);
    const rating = 4.2 + (seed % 8) / 10; // 4.2 – 4.9
    const reviews = 120 + (seed % 900);
    return {
      key,
      label: meta.label,
      emoji: meta.emoji ?? '🧩',
      category: meta.sidebarGroup,
      categoryKey: findMacro(key),
      description: meta.description,
      longDescription: meta.longDescription ?? meta.description,
      features: meta.features ?? [],
      installed: modules[key] !== false,
      rating: Math.round(rating * 10) / 10,
      reviews
    };
  });

  // Categorías = macros que tienen submódulos
  const macroKeys = MODULE_KEYS.filter((k) => MODULE_LEVEL[k] === 'macro');
  const categories = macroKeys
    .filter((m) => subKeys.some((s) => findMacro(s) === m))
    .map((m) => ({
      key: m,
      label: MODULE_META[m].label,
      emoji: iconForMacro(m)
    }));

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader
        title="App Market"
        description="Descubrí y activá funcionalidades para tu negocio. Cada app suma features a tu panel sin tener que configurar nada."
      />

      {/* Marketplace */}
      <AppMarket apps={apps} categories={categories} />

      <p className="text-[11px] text-white/40">
        Inicio y Configuración siempre están visibles — no se pueden apagar.
      </p>
    </div>
  );
}

/** Devuelve la categoría (macro) a la que pertenece un submódulo. */
function findMacro(sub: ModuleKey): ModuleKey {
  // Mapeo directo: usa sidebarGroup como pista pero para mayor precisión
  // hardcode manual acorde a MODULE_TREE
  if (['courses', 'ecommerce', 'vip', 'bundles', 'promotions', 'dropshipping', 'plans'].includes(sub)) return 'catalog';
  if (['events', 'reservations'].includes(sub)) return 'calendar';
  if (['blog', 'forms', 'affiliates'].includes(sub)) return 'crm';
  return 'catalog';
}

function iconForMacro(m: ModuleKey): string {
  switch (m) {
    case 'catalog': return '🛍️';
    case 'calendar': return '📅';
    case 'crm': return '📈';
    case 'team': return '👥';
    case 'sales': return '💰';
    case 'site': return '🌐';
    default: return '🧩';
  }
}

/** Hash simple determinístico para ratings estables por app-key. */
function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
