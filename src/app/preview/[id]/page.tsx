import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SITE_TEMPLATES } from '@/lib/site/templates/catalog';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

const SECTION_NAMES: Record<string, string> = {
  hero: 'Hero',
  trusted_by: 'Confían en nosotros',
  about: 'Sobre nosotros',
  instructor: 'Instructor',
  stats: 'Estadísticas',
  learn_points: 'Qué vas a aprender',
  features: 'Features',
  featured: 'Publicaciones destacadas',
  catalog: 'Catálogo',
  cards: 'Tarjetas',
  testimonials: 'Testimonios',
  before_after: 'Antes / Después',
  faq: 'FAQ',
  offer: 'Oferta',
  pricing: 'Pricing',
  video: 'Video',
  gallery: 'Galería',
  newsletter: 'Newsletter',
  custom: 'Bloque custom',
  contact: 'Contacto',
  map: 'Mapa',
  workwithus: 'Trabajá con nosotros',
  blog_preview: 'Últimas del blog',
  products: 'Tienda',
  cta_final: 'CTA final'
};

export async function generateMetadata({
  params
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = SITE_TEMPLATES.find((x) => x.id === id);
  if (!t) return { title: 'Preview no encontrada' };
  return {
    title: `Preview · ${t.name}`,
    description: t.shortDesc
  };
}

export default async function TemplatePreviewPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = SITE_TEMPLATES.find((x) => x.id === id);
  if (!t) notFound();

  const cfg = t.config;
  const primary = t.suggestedPrimary;
  const enabledSections = cfg.order.filter((k) => cfg.sections[k]?.enabled);

  return (
    <div className="min-h-screen bg-neutral-100">
      {/* Barra superior — "Estás viendo un preview" */}
      <div className="sticky top-0 z-50 bg-neutral-900 text-white px-6 py-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-white/70 hover:text-white">← Volver a OfferNow</Link>
          <span className="text-white/30">|</span>
          <span>
            Preview del template <strong className="text-white">{t.emoji} {t.name}</strong>
          </span>
        </div>
        <Link
          href={`/signup?type=owner&template=${t.id}`}
          className="rounded-full bg-orange-500 text-white px-5 py-1.5 font-semibold hover:bg-orange-600 transition text-xs"
        >
          Empezar con este template →
        </Link>
      </div>

      {/* Mock browser frame */}
      <div className="max-w-6xl mx-auto p-6">
        <div className="rounded-2xl bg-white shadow-xl overflow-hidden border border-neutral-200">
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-3 bg-neutral-100 border-b border-neutral-200">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
            </div>
            <div className="flex-1 mx-3 rounded-md bg-white border border-neutral-200 px-3 py-1 text-xs text-neutral-500 truncate">
              🔒 tu-sitio.bzseguridad.store
            </div>
          </div>

          {/* Hero mock */}
          {cfg.sections.hero?.enabled && (
            <div className="px-8 py-16 text-center" style={{ background: `linear-gradient(135deg, ${primary}12, ${primary}05)` }}>
              {cfg.sections.hero.eyebrow && (
                <p className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: primary }}>
                  {cfg.sections.hero.eyebrow}
                </p>
              )}
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-neutral-900 mb-4">
                {cfg.sections.hero.title}
              </h1>
              {cfg.sections.hero.subtitle && (
                <p className="text-lg text-neutral-600 max-w-2xl mx-auto mb-8">
                  {cfg.sections.hero.subtitle}
                </p>
              )}
              <div className="flex gap-3 justify-center flex-wrap">
                {cfg.sections.hero.cta_label && (
                  <span className="rounded-md px-6 py-2.5 text-sm font-semibold text-white shadow" style={{ background: primary }}>
                    {cfg.sections.hero.cta_label}
                  </span>
                )}
                {cfg.sections.hero.cta_label_2 && (
                  <span className="rounded-md border border-neutral-300 px-6 py-2.5 text-sm font-semibold text-neutral-700">
                    {cfg.sections.hero.cta_label_2}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Blog preview mock (para template news) */}
          {cfg.sections.blog_preview?.enabled && (
            <div className="px-8 py-12 border-t border-neutral-100">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold">{cfg.sections.blog_preview.title}</h2>
                {cfg.sections.blog_preview.subtitle && (
                  <p className="text-sm text-neutral-500 mt-1">{cfg.sections.blog_preview.subtitle}</p>
                )}
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { title: 'Elecciones 2026: qué esperar', date: '3 jul' },
                  { title: 'Cambia el clima: análisis local', date: '2 jul' },
                  { title: 'Entrevista al intendente', date: '1 jul' }
                ].map((n, i) => (
                  <div key={i} className="rounded-lg border border-neutral-200 overflow-hidden">
                    <div className="aspect-video bg-gradient-to-br from-neutral-200 to-neutral-300" />
                    <div className="p-3">
                      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{n.date}</div>
                      <div className="font-semibold text-sm mt-1 line-clamp-2">{n.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Featured productos mock */}
          {cfg.sections.featured?.enabled && (
            <div className="px-8 py-12 border-t border-neutral-100">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold">{(cfg.sections.featured as { title?: string }).title || 'Destacados'}</h2>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-lg border border-neutral-200 overflow-hidden">
                    <div className="aspect-square bg-gradient-to-br from-neutral-200 to-neutral-300 flex items-center justify-center text-3xl">
                      {t.emoji}
                    </div>
                    <div className="p-3">
                      <div className="font-semibold text-sm">Producto ejemplo #{i}</div>
                      <div className="text-xs text-neutral-500 mt-1">$ 12.000</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* About mock */}
          {cfg.sections.about?.enabled && (
            <div className="px-8 py-12 border-t border-neutral-100 bg-neutral-50">
              <div className="max-w-3xl mx-auto text-center">
                <h2 className="text-2xl font-bold mb-4">{(cfg.sections.about as { title?: string }).title || 'Sobre nosotros'}</h2>
                <p className="text-neutral-600 leading-relaxed">
                  {(cfg.sections.about as { body?: string }).body || 'Contá quién sos, qué te diferencia, cuál es tu propuesta única.'}
                </p>
              </div>
            </div>
          )}

          {/* Features mock */}
          {cfg.sections.features?.enabled && (
            <div className="px-8 py-12 border-t border-neutral-100">
              <h2 className="text-2xl font-bold text-center mb-8">
                {(cfg.sections.features as { title?: string }).title || 'Features'}
              </h2>
              <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="text-center">
                    <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center text-white text-lg" style={{ background: primary }}>
                      ✓
                    </div>
                    <div className="font-semibold text-sm">Feature {i}</div>
                    <div className="text-xs text-neutral-500 mt-1">Descripción breve del beneficio.</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contact mock */}
          {cfg.sections.contact?.enabled && (
            <div className="px-8 py-12 border-t border-neutral-100 bg-neutral-50 text-center">
              <h2 className="text-2xl font-bold mb-2">
                {(cfg.sections.contact as { title?: string }).title || 'Contactanos'}
              </h2>
              {(cfg.sections.contact as { subtitle?: string }).subtitle && (
                <p className="text-neutral-600 mb-6">
                  {(cfg.sections.contact as { subtitle?: string }).subtitle}
                </p>
              )}
              <div className="max-w-md mx-auto space-y-2">
                <div className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-left text-neutral-400">
                  Tu email…
                </div>
                <div className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-left text-neutral-400 h-20">
                  Tu mensaje…
                </div>
                <div className="rounded-md text-white px-4 py-2 text-sm font-semibold inline-block" style={{ background: primary }}>
                  Enviar
                </div>
              </div>
            </div>
          )}

          {/* CTA final mock */}
          {cfg.sections.cta_final?.enabled && (
            <div className="px-8 py-16 text-center text-white" style={{ background: primary }}>
              <h2 className="text-3xl font-bold mb-3">
                {(cfg.sections.cta_final as { title?: string }).title || '¿Empezamos?'}
              </h2>
              {(cfg.sections.cta_final as { body?: string }).body && (
                <p className="mb-6 opacity-90">{(cfg.sections.cta_final as { body?: string }).body}</p>
              )}
              <span className="rounded-md bg-white px-8 py-3 font-semibold" style={{ color: primary }}>
                {(cfg.sections.cta_final as { cta_label?: string }).cta_label || 'Empezar'}
              </span>
            </div>
          )}

          {/* Footer */}
          <div className="px-8 py-6 bg-neutral-900 text-white text-center text-xs text-white/60">
            © 2026 Tu sitio · Hecho con OfferNow
          </div>
        </div>

        {/* Info box abajo */}
        <div className="mt-8 grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h3 className="font-semibold text-sm mb-2">Este template incluye</h3>
            <div className="flex flex-wrap gap-1.5">
              {enabledSections.map((s) => (
                <span key={s} className="text-[11px] rounded-full bg-neutral-100 border border-neutral-200 px-2.5 py-1">
                  {SECTION_NAMES[s] ?? s}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white p-5">
            <h3 className="font-semibold text-sm mb-2">Podés personalizar</h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Todo el contenido (textos, imágenes, colores, secciones) desde el editor visual del panel.
              También podés sumar más módulos: cursos, productos físicos, gift cards, reservas, y más.
            </p>
          </div>
        </div>
      </div>

      {/* Sticky CTA abajo */}
      <div className="sticky bottom-0 bg-white border-t border-neutral-200 px-6 py-4 flex items-center justify-between gap-4">
        <div className="text-sm">
          <strong className="text-neutral-900">{t.name}</strong>
          <span className="text-neutral-500"> · {t.shortDesc}</span>
        </div>
        <Link
          href={`/signup?type=owner&template=${t.id}`}
          className="shrink-0 rounded-full bg-neutral-900 text-white px-6 py-2.5 font-semibold hover:bg-neutral-800 transition text-sm whitespace-nowrap"
        >
          Empezar con este template →
        </Link>
      </div>
    </div>
  );
}
