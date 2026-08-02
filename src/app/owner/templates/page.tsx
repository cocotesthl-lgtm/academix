import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { type SiteTemplate } from '@/lib/site/templates/catalog';
import { loadSiteTemplates } from '@/lib/site/templates/loader';
import { applySiteTemplateAction } from '@/lib/site/templates/actions';
import { MODULE_META, type ModuleKey } from '@/lib/modules/types';

export const dynamic = 'force-dynamic';

/**
 * Flow de 2 pasos:
 *   1. Sin `?cat=`  → grid de CATEGORÍAS (con emoji + count + preview del color).
 *   2. Con `?cat=X` → grid de THEMES/templates de esa categoría.
 *
 * Es más manejable que la lista plana cuando hay muchos templates y
 * cognitivamente más claro: primero el rubro, después el look.
 */
export default async function TemplatesPage({
  searchParams
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { tenant } = await requireOwner();
  const { cat } = await searchParams;
  // Templates desde DB (con auto-seed en primera lectura, fallback a hardcoded).
  const SITE_TEMPLATES = await loadSiteTemplates();
  const TEMPLATE_CATEGORIES = Array.from(new Set(SITE_TEMPLATES.map((t) => t.category)));

  // Snapshot del sitio actual — se muestra en el warning al aplicar
  let currentSectionsCount = 0;
  try {
    const svc = getServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('tenants') as any)
      .select('site_config').eq('id', tenant.id).maybeSingle();
    const order = (data?.site_config?.order ?? []) as string[];
    const sections = data?.site_config?.sections ?? {};
    currentSectionsCount = order.filter((k) => sections?.[k]?.enabled).length;
  } catch { /* */ }

  // Vista de themes dentro de una categoría específica
  if (cat) {
    const themes = SITE_TEMPLATES.filter((t) => t.category === cat);
    // Categoría inválida → volver al step 1
    if (themes.length === 0) {
      return (
        <article className="max-w-7xl mx-auto px-6 py-8 space-y-6">
          <p className="text-sm text-black/60">La categoría no existe.</p>
          <Link href="/templates" className="text-sm underline">← Ver todas las categorías</Link>
        </article>
      );
    }
    return (
      <article className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div>
          <Link href="/templates" className="text-xs text-black/50 hover:text-black">
            ← Categorías
          </Link>
          <h1 className="text-3xl font-bold mt-2">Themes de {cat}</h1>
          <p className="text-black/55 text-sm mt-1">
            Elegí un look de partida. Aplicar un theme <strong>pisa</strong> tu sitio actual — podés seguir modificándolo desde el editor.
          </p>
        </div>

        {currentSectionsCount > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            ⚠️ Tu sitio actual tiene <strong>{currentSectionsCount}</strong> secciones activas. Si aplicás un theme, se reemplazan.
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {themes.map((tpl) => <TemplateCard key={tpl.id} tpl={tpl} />)}
        </div>
      </article>
    );
  }

  // Step 1: categorías
  const categoriesWithMeta = TEMPLATE_CATEGORIES.map((c) => {
    const templates = SITE_TEMPLATES.filter((t) => t.category === c);
    const primary = templates[0]?.suggestedPrimary ?? '#0a0a0a';
    // Emojis pegados a cada categoría — no son parte del type, los inferimos
    // del primer template. Si querés custom, mapealo abajo por categoría.
    const emoji = CATEGORY_EMOJIS[c] ?? templates[0]?.emoji ?? '📄';
    return { name: c, count: templates.length, primary, emoji, templates };
  });

  return (
    <article className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Templates</h1>
        <p className="text-black/55 text-sm mt-1">
          Elegí primero el rubro de tu negocio. Después vas a ver los themes/looks disponibles para ese rubro.
        </p>
      </div>

      {currentSectionsCount > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          ⚠️ Tu sitio actual tiene <strong>{currentSectionsCount}</strong> secciones activas. Aplicar un template las reemplaza.
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {categoriesWithMeta.map((cat) => (
          <CategoryCard key={cat.name} cat={cat} />
        ))}
      </div>

      <p className="text-xs text-black/40 pt-4 border-t border-black/5">
        ¿No encontrás tu rubro? Empezá con el más parecido y modificalo desde el{' '}
        <Link href="/site" className="underline">editor de páginas</Link>.
      </p>
    </article>
  );
}

/** Emoji por categoría — si no está mapeada, usa el emoji del primer template. */
const CATEGORY_EMOJIS: Record<string, string> = {
  Gastronomía: '🍽️',
  Servicios: '💼',
  Comercio: '🛒',
  Educación: '🎓',
  Experiencias: '🎯',
  Editorial: '📰'
};

function CategoryCard({ cat }: {
  cat: { name: string; count: number; primary: string; emoji: string; templates: SiteTemplate[] };
}) {
  const themeNames = cat.templates.slice(0, 3).map((t) => t.name).join(' · ');
  const moreCount = cat.templates.length - 3;

  return (
    <Link href={`/templates?cat=${encodeURIComponent(cat.name)}`}
      className="rounded-2xl border border-black/10 bg-white p-6 hover:shadow-md hover:border-black/20 transition group">
      <div className="flex items-start justify-between mb-4">
        <div className="w-14 h-14 rounded-xl grid place-items-center text-3xl"
          style={{ background: `${cat.primary}15`, color: cat.primary }}>
          {cat.emoji}
        </div>
        <span className="text-[10px] uppercase tracking-widest text-black/40 font-semibold">
          {cat.count} {cat.count === 1 ? 'theme' : 'themes'}
        </span>
      </div>
      <h2 className="text-xl font-bold mb-1">{cat.name}</h2>
      <p className="text-xs text-black/55 leading-relaxed line-clamp-2">
        {themeNames}
        {moreCount > 0 && <span className="text-black/40"> + {moreCount} más</span>}
      </p>
      <div className="mt-4 pt-4 border-t border-black/5 flex items-center justify-between">
        <div className="flex -space-x-1">
          {cat.templates.slice(0, 4).map((t) => (
            <span key={t.id}
              className="w-4 h-4 rounded-full border-2 border-white shrink-0"
              style={{ background: t.suggestedPrimary }}
              title={t.name} />
          ))}
        </div>
        <span className="text-xs text-black/50 group-hover:text-black transition font-medium">
          Ver themes →
        </span>
      </div>
    </Link>
  );
}

function TemplateCard({ tpl }: { tpl: SiteTemplate }) {
  return (
    <div className="rounded-2xl border border-black/10 overflow-hidden bg-white hover:shadow-md transition-shadow">
      <div className="aspect-[4/3] bg-gradient-to-br relative overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(135deg, ${tpl.suggestedPrimary}15, ${tpl.suggestedPrimary}03)`
        }}>
        <TemplateThumb tpl={tpl} />
      </div>
      <div className="p-4 space-y-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-black/45 mb-1">
            <span>{tpl.emoji}</span>
            <span>{tpl.category}</span>
          </div>
          <h3 className="text-lg font-bold">{tpl.name}</h3>
          <p className="text-xs text-black/60 leading-relaxed mt-1 line-clamp-3">
            {tpl.shortDesc}
          </p>
        </div>

        {tpl.modules !== undefined && (
          <div className="pt-2 border-t border-black/5">
            <div className="text-[10px] uppercase tracking-widest text-black/45 mb-1.5">
              Apps que activa
            </div>
            {tpl.modules.length === 0 ? (
              <p className="text-[11px] text-black/50 italic">
                Ninguna — sitio institucional puro (podés activar apps después).
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {tpl.modules
                  .filter((k): k is ModuleKey => !!MODULE_META[k])
                  .map((k) => (
                    <span key={k}
                      className="inline-flex items-center gap-0.5 rounded-full bg-black/5 px-2 py-0.5 text-[10px] text-black/70">
                      <span>{MODULE_META[k]?.emoji ?? '🧩'}</span>
                      <span>{MODULE_META[k]?.label ?? k}</span>
                    </span>
                  ))}
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/5">
          <div className="flex items-center gap-1.5 text-[10px] text-black/45">
            <span className="inline-block w-3 h-3 rounded-full border border-black/10"
              style={{ background: tpl.suggestedPrimary }} />
            color sugerido
          </div>
          <form action={applySiteTemplateAction}>
            <input type="hidden" name="template_id" value={tpl.id} />
            <button type="submit"
              className="text-xs px-3 py-1.5 rounded-md font-semibold text-white hover:opacity-90"
              style={{ background: tpl.suggestedPrimary }}>
              Usar este template →
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/** Mockup SVG estilizado del template (header + hero + sections). */
function TemplateThumb({ tpl }: { tpl: SiteTemplate }) {
  const c = tpl.suggestedPrimary;
  const sections = (tpl.config.order ?? []).slice(0, 5);

  return (
    <svg viewBox="0 0 200 150" className="w-full h-full block" preserveAspectRatio="xMidYMid slice">
      {/* Background */}
      <rect x="0" y="0" width="200" height="150" fill="#fafafa" />

      {/* Top nav bar */}
      <rect x="0" y="0" width="200" height="12" fill="white" stroke="#0001" strokeWidth="0.5" />
      <circle cx="8" cy="6" r="2.5" fill={c} />
      <rect x="14" y="4.5" width="20" height="3" rx="1" fill="#0003" />
      <rect x="160" y="3.5" width="30" height="5" rx="2.5" fill={c} />

      {/* Hero */}
      <rect x="0" y="12" width="200" height="42" fill={c} opacity="0.08" />
      <rect x="14" y="22" width="60" height="3" rx="1" fill={c} opacity="0.6" />
      <rect x="14" y="28" width="100" height="6" rx="1.5" fill="#000" opacity="0.8" />
      <rect x="14" y="37" width="80" height="3" rx="1" fill="#0006" />
      <rect x="14" y="44" width="28" height="6" rx="2" fill={c} />

      {/* Hero illustration zone */}
      <rect x="130" y="20" width="55" height="28" rx="3" fill={c} opacity="0.18" />
      <text x="157.5" y="38" textAnchor="middle" fontSize="14" fill={c} opacity="0.6">{tpl.emoji}</text>

      {/* Section blocks abajo */}
      {sections.slice(1).map((_, i) => {
        const y = 60 + i * 22;
        return (
          <g key={i}>
            <rect x="14" y={y} width="40" height="2.5" rx="0.5" fill={c} opacity="0.5" />
            <rect x="14" y={y + 5} width="172" height="14" rx="2" fill="white" stroke="#0001" strokeWidth="0.5" />
            <rect x="20" y={y + 9} width="60" height="2" rx="0.5" fill="#0003" />
            <rect x="20" y={y + 13} width="100" height="2" rx="0.5" fill="#0002" />
          </g>
        );
      })}
    </svg>
  );
}
