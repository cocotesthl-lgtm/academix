import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { SITE_TEMPLATES, TEMPLATE_CATEGORIES, type SiteTemplate } from '@/lib/site/templates/catalog';
import { applySiteTemplateAction } from '@/lib/site/templates/actions';
import { MODULE_META, type ModuleKey } from '@/lib/modules/types';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage({
  searchParams
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { tenant } = await requireOwner();
  const { cat } = await searchParams;

  // Para mostrar "actualmente este es tu sitio"
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

  const filtered = cat ? SITE_TEMPLATES.filter((t) => t.category === cat) : SITE_TEMPLATES;

  return (
    <article className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Templates</h1>
        <p className="text-black/55 text-sm mt-1">
          Elegí un punto de partida para tu sitio. Aplicar un template <strong>pisa</strong> tu sitio
          actual (podés volver al editor de páginas y seguir modificando).
        </p>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        ⚠️ Tu sitio actual tiene <strong>{currentSectionsCount}</strong> secciones activas.
        Si aplicás un template, se reemplazan por las del template. Te recomendamos hacer este cambio
        cuando estás empezando.
      </div>

      {/* Filtros por categoría */}
      <div className="flex flex-wrap gap-2">
        <FilterChip label="Todos" href="/templates" active={!cat} count={SITE_TEMPLATES.length} />
        {TEMPLATE_CATEGORIES.map((c) => (
          <FilterChip key={c}
            label={c} href={`/templates?cat=${encodeURIComponent(c)}`} active={cat === c}
            count={SITE_TEMPLATES.filter((t) => t.category === c).length} />
        ))}
      </div>

      {/* Grid de templates */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((tpl) => (
          <TemplateCard key={tpl.id} tpl={tpl} />
        ))}
      </div>

      <p className="text-xs text-black/40 pt-4 border-t border-black/5">
        ¿No encontrás algo similar a tu negocio? Empezá con el más parecido y modificalo desde el{' '}
        <Link href="/site" className="underline">editor de páginas</Link>. Si necesitás un template
        nuevo, pedinos por <Link href="/support" className="underline">soporte</Link>.
      </p>
    </article>
  );
}

function FilterChip({ label, href, active, count }: {
  label: string; href: string; active: boolean; count: number;
}) {
  return (
    <Link href={href}
      className={`text-xs px-3 py-1.5 rounded-full border ${
        active
          ? 'bg-black text-white border-black'
          : 'bg-white text-black/70 border-black/15 hover:border-black/40'
      }`}>
      {label} <span className="opacity-60">({count})</span>
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
