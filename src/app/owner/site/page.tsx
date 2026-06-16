import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { mergeConfig, type SectionKey } from "@/lib/site/types";
import {
  toggleSectionAction,
  moveSectionAction,
  setSectionBgColorAction,
  setSectionTextColorAction,
  applyThemeAction
} from "@/lib/site/actions";
import {
  HeroEditor,
  TrustedByEditor,
  AboutEditor,
  InstructorEditor,
  StatsEditor,
  LearnPointsEditor,
  FeaturesEditor,
  FeaturedEditor,
  CatalogEditor,
  TestimonialsEditor,
  BeforeAfterEditor,
  FaqEditor,
  OfferEditor,
  PricingEditor,
  VideoEditor,
  GalleryEditor,
  NewsletterEditor,
  CtaFinalEditor,
  ContactEditor,
  CustomEditor,
  NavEditor,
  FooterEditor
} from "@/components/owner/site/SectionEditors";
import { ColorAutoSave } from "@/components/owner/site/ColorAutoSave";
import { SectionStyleEditor } from "@/components/owner/site/SectionStyleEditor";

export const dynamic = "force-dynamic";

const SECTION_META: Record<SectionKey, { title: string; desc: string }> = {
  hero:         { title: "🏆 Hero", desc: "Primera impresión. Plantilla centrada, dividida o galería." },
  trusted_by:   { title: "🤝 Confían en nosotros", desc: "Logos de clientes/marcas, con filtro grayscale opcional." },
  about:        { title: "🪪 Sobre nosotros", desc: "Quién sos, qué te diferencia, por qué eligen tu academia." },
  instructor:   { title: "👤 Instructor", desc: "Quién va a enseñar. Foto, biografía, credenciales." },
  stats:        { title: "📊 Estadísticas", desc: "Números fuertes: alumnos formados, años, satisfacción." },
  learn_points: { title: "✅ Qué vas a aprender", desc: "Lista de puntos con check marks. Lo que se llevan." },
  features:     { title: "🎴 Features (3 tarjetas)", desc: "Beneficios o diferenciales con icono + título + texto." },
  featured:     { title: "⭐ Cursos destacados", desc: "Cursos marcados como destacados desde su editor." },
  catalog:      { title: "📚 Catálogo completo", desc: "Todos los cursos publicados con filtros por categoría." },
  testimonials: { title: "💬 Testimonios", desc: "Estilo Google: estrellas, foto, rol, comentario." },
  before_after: { title: "🔄 Antes / Después", desc: "Comparativa visual con imágenes y textos descriptivos." },
  faq:          { title: "❓ Preguntas frecuentes", desc: "Acordeón clásico para responder objeciones." },
  offer:        { title: "⏰ Oferta limitada", desc: "Banner con contador regresivo hasta una fecha." },
  pricing:      { title: "💰 Planes / pricing", desc: "Tarjetas comparativas con plan, precio, features y CTA." },
  video:        { title: "🎬 Video", desc: "Embed de YouTube o Google Drive. Trailer, presentación, lo que quieras." },
  gallery:      { title: "🖼️ Galería", desc: "Grid de imágenes con caption. 2, 3 o 4 columnas." },
  newsletter:   { title: "📧 Newsletter", desc: "Capturá emails con un formulario simple." },
  custom:       { title: "🎨 Bloque personalizado", desc: "Comodín 100% editable: título + texto + imagen + CTA + posición." },
  contact:      { title: "✉️ Contacto", desc: "Formulario de contacto con email y WhatsApp opcionales." },
  cta_final:    { title: "🎯 CTA final", desc: "Cierre de la página con llamado a la acción." }
};

export default async function SiteBuilderPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const { data: tenantRow } = await svc
    .from("tenants")
    .select("site_config, brand")
    .eq("id", tenant.id)
    .single<{ site_config: unknown; brand: { primary_color?: string } | null }>();
  const cfg = mergeConfig(tenantRow?.site_config);
  const primary = tenantRow?.brand?.primary_color ?? '#a855f7';

  // CSS para que las previews del editor reflejen los colores reales.
  // Cada Section envuelve sus children con data-sec-editor={key}.
  // Si el owner picó text_color o bg_color, esos ganan en el preview también.
  const previewCss = cfg.order
    .filter((k) => cfg.sections[k].text_color || cfg.sections[k].bg_color)
    .map((k) => {
      const text = (cfg.sections[k].text_color ?? '').replace(/[^#0-9a-fA-F]/g, '');
      const bg = (cfg.sections[k].bg_color ?? '').replace(/[^#0-9a-fA-F]/g, '');
      const rules: string[] = [];
      if (text) {
        rules.push(`[data-sec-editor="${k}"] [data-pf]{color:${text}}`);
        rules.push(`[data-sec-editor="${k}"] [data-pf] .text-black, [data-sec-editor="${k}"] [data-pf] [class*="text-black/"]{color:${text} !important}`);
      }
      if (bg) {
        // Pisa los gradients hardcodeados de los previews internos
        rules.push(`[data-sec-editor="${k}"] [data-pf]>*{background:${bg} !important}`);
      }
      return rules.join('\n');
    })
    .join('\n');

  const u = new URL(env.appUrl);
  const isLocal = u.hostname === 'localhost' || u.hostname.endsWith('.localhost');
  const publicHost = isLocal
    ? `${tenant.slug}.localhost${u.port ? ':' + u.port : ''}`
    : `${tenant.slug}.${env.rootDomain}`;
  const publicUrl = `${u.protocol}//${publicHost}`;

  return (
    <div className="space-y-6 max-w-6xl">
      {previewCss && (
        <style dangerouslySetInnerHTML={{ __html: previewCss }} />
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Editor de sitio</h1>
          <p className="text-white/60 text-sm mt-1">
            15 secciones + nav + footer. Cada cambio se ve en vivo en el preview.
            Reordená con ▲▼, cambiá colores por sección, activá lo que necesites.
          </p>
        </div>
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener"
          className="rounded-md border border-white/15 px-3 py-2 text-sm hover:bg-white/5 whitespace-nowrap"
        >
          Ver storefront →
        </a>
      </div>

      {/* Pre-built themes */}
      <div className="rounded-xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/5 to-purple-500/5 p-5">
        <h2 className="text-lg font-bold mb-1">✨ Plantillas pre-armadas</h2>
        <p className="text-sm text-white/60 mb-4">
          La opción <strong className="text-white">Sitio completo</strong> reescribe todo con contenido de muestra (para arrancar con un sitio bonito y editar después).
          Las otras solo encienden secciones del vertical sin pisar tu contenido. <strong className="text-fuchsia-300">Hotmart</strong> y <strong className="text-fuchsia-300">Funnel</strong> sí cambian el orden de las secciones (son layouts completos).
        </p>
        <p className="text-xs text-white/50 italic mb-3">
          💡 ¿Buscás plantillas Hotmart o Funnel para vender UN curso específico? Ya no van acá
          (eran para todo el sitio). Ahora las elegís por curso en{' '}
          <a href="/courses" className="text-fuchsia-300 hover:underline">/courses</a> → editar curso → sección "Landing page".
        </p>
        <div className="grid md:grid-cols-4 gap-3">
          <form action={applyThemeAction}>
            <input type="hidden" name="theme" value="sample" />
            <button className="w-full text-left rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 p-4 hover:bg-fuchsia-500/20">
              <div className="text-2xl mb-1">✨</div>
              <div className="font-semibold text-sm">Sitio completo</div>
              <div className="text-xs text-white/60 mt-1">15 secciones con contenido de muestra (pisa todo)</div>
            </button>
          </form>
          <form action={applyThemeAction}>
            <input type="hidden" name="theme" value="fitness" />
            <button className="w-full text-left rounded-lg border border-white/15 bg-white/[0.02] p-4 hover:bg-white/[0.05]">
              <div className="text-2xl mb-1">💪</div>
              <div className="font-semibold text-sm">Fitness / Coaching</div>
              <div className="text-xs text-white/50 mt-1">Hero split + instructor + before-after</div>
            </button>
          </form>
          <form action={applyThemeAction}>
            <input type="hidden" name="theme" value="tech" />
            <button className="w-full text-left rounded-lg border border-white/15 bg-white/[0.02] p-4 hover:bg-white/[0.05]">
              <div className="text-2xl mb-1">💻</div>
              <div className="font-semibold text-sm">Tech / Educación</div>
              <div className="text-xs text-white/50 mt-1">Trusted + features + learn-points + FAQ</div>
            </button>
          </form>
          <form action={applyThemeAction}>
            <input type="hidden" name="theme" value="business" />
            <button className="w-full text-left rounded-lg border border-white/15 bg-white/[0.02] p-4 hover:bg-white/[0.05]">
              <div className="text-2xl mb-1">📈</div>
              <div className="font-semibold text-sm">Business / Pro</div>
              <div className="text-xs text-white/50 mt-1">Hero gallery + stats + features + pricing</div>
            </button>
          </form>
        </div>
      </div>

      {cfg.order.map((key, idx) => {
        const meta = SECTION_META[key];
        const isFirst = idx === 0;
        const isLast = idx === cfg.order.length - 1;
        return (
          <Section
            key={key}
            sectionKey={key}
            title={meta.title}
            desc={meta.desc}
            enabled={cfg.sections[key].enabled}
            bgColor={cfg.sections[key].bg_color ?? null}
            textColor={cfg.sections[key].text_color ?? null}
            styles={{
              title_color:       cfg.sections[key].title_color       ?? null,
              body_color:        cfg.sections[key].body_color        ?? null,
              accent_color:      cfg.sections[key].accent_color      ?? null,
              card_bg_color:     cfg.sections[key].card_bg_color     ?? null,
              card_border_color: cfg.sections[key].card_border_color ?? null,
              font_family:       cfg.sections[key].font_family       ?? null,
              title_weight:      cfg.sections[key].title_weight      ?? null
            }}
            isFirst={isFirst}
            isLast={isLast}
            position={idx + 1}
            total={cfg.order.length}
          >
            {key === 'hero' && (
              <HeroEditor
                initial={{
                  eyebrow: cfg.sections.hero.eyebrow ?? '',
                  title: cfg.sections.hero.title ?? '',
                  subtitle: cfg.sections.hero.subtitle,
                  cta_label: cfg.sections.hero.cta_label,
                  cta_href: cfg.sections.hero.cta_href,
                  cta_label_2: cfg.sections.hero.cta_label_2 ?? '',
                  cta_href_2: cfg.sections.hero.cta_href_2 ?? '',
                  caption: cfg.sections.hero.caption ?? ''
                }}
                fallbackTitle={tenant.name}
                primary={primary}
                layout={cfg.sections.hero.layout}
                imageUrl={cfg.sections.hero.image_url}
              />
            )}
            {key === 'trusted_by' && (
              <TrustedByEditor
                initialTitle={cfg.sections.trusted_by.title}
                items={cfg.sections.trusted_by.items}
                grayscale={cfg.sections.trusted_by.grayscale}
                marquee={cfg.sections.trusted_by.marquee}
              />
            )}
            {key === 'about' && (
              <AboutEditor
                initial={{ title: cfg.sections.about.title, body: cfg.sections.about.body }}
                imageUrl={cfg.sections.about.image_url}
                primary={primary}
              />
            )}
            {key === 'instructor' && (
              <InstructorEditor
                initial={{
                  title: cfg.sections.instructor.title,
                  display_mode: cfg.sections.instructor.display_mode ?? 'single'
                }}
                items={cfg.sections.instructor.items ?? []}
                primary={primary}
              />
            )}
            {key === 'stats' && (
              <StatsEditor
                initialTitle={cfg.sections.stats.title}
                items={cfg.sections.stats.items}
                primary={primary}
              />
            )}
            {key === 'learn_points' && (
              <LearnPointsEditor
                initialTitle={cfg.sections.learn_points.title}
                initialSubtitle={cfg.sections.learn_points.subtitle}
                items={cfg.sections.learn_points.items}
                primary={primary}
              />
            )}
            {key === 'features' && (
              <FeaturesEditor
                initialTitle={cfg.sections.features.title}
                items={cfg.sections.features.items}
                primary={primary}
              />
            )}
            {key === 'featured' && (
              <FeaturedEditor initialTitle={cfg.sections.featured.title} primary={primary} />
            )}
            {key === 'catalog' && (
              <CatalogEditor
                initialTitle={cfg.sections.catalog.title}
                initialShowFilters={cfg.sections.catalog.show_filters}
                initialMaxVisible={cfg.sections.catalog.max_visible ?? 3}
                initialPaginationMode={cfg.sections.catalog.pagination_mode ?? 'show_more'}
                initialCtaMode={cfg.sections.catalog.cta_mode ?? 'course_link'}
                initialCtaCustomHref={cfg.sections.catalog.cta_custom_href ?? ''}
                initialManualCards={cfg.sections.catalog.manual_cards ?? []}
                initialManualCardsPosition={cfg.sections.catalog.manual_cards_position ?? 'before'}
                initialShowAutoCourses={cfg.sections.catalog.show_auto_courses !== false}
                initialCardStyle={cfg.sections.catalog.card_style ?? 'classic'}
                primary={primary}
              />
            )}
            {key === 'testimonials' && (
              <TestimonialsEditor
                initialTitle={cfg.sections.testimonials.title}
                items={cfg.sections.testimonials.items}
                primary={primary}
              />
            )}
            {key === 'before_after' && (
              <BeforeAfterEditor
                initial={{
                  title: cfg.sections.before_after.title,
                  before_label: cfg.sections.before_after.before_label,
                  after_label: cfg.sections.before_after.after_label,
                  before_body: cfg.sections.before_after.before_body,
                  after_body: cfg.sections.before_after.after_body
                }}
                beforeUrl={cfg.sections.before_after.before_image_url}
                afterUrl={cfg.sections.before_after.after_image_url}
                primary={primary}
              />
            )}
            {key === 'faq' && (
              <FaqEditor initialTitle={cfg.sections.faq.title} items={cfg.sections.faq.items} />
            )}
            {key === 'offer' && (
              <OfferEditor
                initial={{
                  title: cfg.sections.offer.title,
                  subtitle: cfg.sections.offer.subtitle,
                  ends_at: cfg.sections.offer.ends_at ?? '',
                  cta_label: cfg.sections.offer.cta_label,
                  cta_href: cfg.sections.offer.cta_href
                }}
                primary={primary}
              />
            )}
            {key === 'pricing' && (
              <PricingEditor
                initialTitle={cfg.sections.pricing.title}
                initialSubtitle={cfg.sections.pricing.subtitle}
                tiers={cfg.sections.pricing.tiers}
                primary={primary}
              />
            )}
            {key === 'video' && (
              <VideoEditor
                initial={{
                  title: cfg.sections.video.title,
                  subtitle: cfg.sections.video.subtitle,
                  provider: cfg.sections.video.provider,
                  video_id: cfg.sections.video.video_id
                }}
                primary={primary}
              />
            )}
            {key === 'gallery' && (
              <GalleryEditor
                initialTitle={cfg.sections.gallery.title}
                initialSubtitle={cfg.sections.gallery.subtitle}
                items={cfg.sections.gallery.items}
                columns={cfg.sections.gallery.columns}
              />
            )}
            {key === 'newsletter' && (
              <NewsletterEditor
                initial={{
                  title: cfg.sections.newsletter.title,
                  subtitle: cfg.sections.newsletter.subtitle,
                  cta_label: cfg.sections.newsletter.cta_label
                }}
                primary={primary}
              />
            )}
            {key === 'custom' && (
              <CustomEditor
                initial={{
                  title: cfg.sections.custom.title,
                  subtitle: cfg.sections.custom.subtitle,
                  body: cfg.sections.custom.body,
                  image_pos: cfg.sections.custom.image_pos,
                  cta_label: cfg.sections.custom.cta_label,
                  cta_href: cfg.sections.custom.cta_href
                }}
                imageUrl={cfg.sections.custom.image_url}
                primary={primary}
              />
            )}
            {key === 'contact' && (
              <ContactEditor
                initial={{
                  title: cfg.sections.contact.title,
                  subtitle: cfg.sections.contact.subtitle,
                  email: cfg.sections.contact.email,
                  whatsapp: cfg.sections.contact.whatsapp,
                  name_label: cfg.sections.contact.name_label,
                  email_label: cfg.sections.contact.email_label,
                  message_label: cfg.sections.contact.message_label,
                  submit_label: cfg.sections.contact.submit_label
                }}
                primary={primary}
              />
            )}
            {key === 'cta_final' && (
              <CtaFinalEditor
                initial={{
                  title: cfg.sections.cta_final.title,
                  body: cfg.sections.cta_final.body,
                  cta_label: cfg.sections.cta_final.cta_label,
                  cta_href: cfg.sections.cta_final.cta_href
                }}
                primary={primary}
              />
            )}
          </Section>
        );
      })}

      <div className="pt-6 border-t border-white/10">
        <h2 className="text-xl font-bold mb-2">Cabecera (nav)</h2>
        <div className="rounded-xl border border-white/15 bg-white/[0.02] p-5">
          <NavEditor
            links={cfg.nav.links}
            showLogin={cfg.nav.show_login}
            primary={primary}
            tenantName={tenant.name}
          />
        </div>
      </div>

      <div className="pt-6">
        <h2 className="text-xl font-bold mb-2">Pie de página (footer)</h2>
        <div className="rounded-xl border border-white/15 bg-white/[0.02] p-5">
          <FooterEditor
            initialText={cfg.footer.text}
            links={cfg.footer.links}
            socials={cfg.footer.socials}
            tenantName={tenant.name}
          />
        </div>
      </div>
    </div>
  );
}

function Section({
  title, desc, enabled, sectionKey, bgColor, textColor, styles, children, isFirst, isLast, position, total
}: {
  title: string; desc: string; enabled: boolean; sectionKey: string;
  bgColor: string | null; textColor: string | null;
  styles: {
    title_color: string | null; body_color: string | null; accent_color: string | null;
    card_bg_color: string | null; card_border_color: string | null;
    font_family: string | null; title_weight: string | null;
  };
  children: React.ReactNode; isFirst: boolean; isLast: boolean; position: number; total: number;
}) {
  return (
    <div className={`rounded-xl border ${enabled ? 'border-white/15 bg-white/[0.02]' : 'border-white/10 bg-white/[0.01] opacity-70'}`}>
      <div className="p-5 flex items-start justify-between gap-3 border-b border-white/5 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="flex flex-col gap-1 pt-1">
            <form action={moveSectionAction}>
              <input type="hidden" name="section" value={sectionKey} />
              <input type="hidden" name="dir" value="up" />
              <button disabled={isFirst} className="text-white/60 hover:text-white disabled:opacity-20 text-sm leading-none">▲</button>
            </form>
            <form action={moveSectionAction}>
              <input type="hidden" name="section" value={sectionKey} />
              <input type="hidden" name="dir" value="down" />
              <button disabled={isLast} className="text-white/60 hover:text-white disabled:opacity-20 text-sm leading-none">▼</button>
            </form>
          </div>
          <div>
            <h3 className="font-semibold">
              {title}
              <span className="ml-2 text-xs text-white/30 font-normal">{position}/{total}</span>
            </h3>
            <p className="text-xs text-white/50 mt-0.5">{desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Color pickers — auto-aplican al elegir, sin botón Aplicar.
              Se guarda + revalida apenas el owner pica un color en la rueda. */}
          <ColorAutoSave
            label="Fondo"
            fieldName="bg_color"
            sectionKey={sectionKey}
            initial={bgColor}
            action={setSectionBgColorAction}
          />
          <ColorAutoSave
            label="Texto"
            fieldName="text_color"
            sectionKey={sectionKey}
            initial={textColor}
            action={setSectionTextColorAction}
          />
          <SectionStyleEditor sectionKey={sectionKey} initial={styles} />
          <form action={toggleSectionAction}>
            <input type="hidden" name="section" value={sectionKey} />
            <button
              type="submit"
              className={`text-xs px-2.5 py-1 rounded border whitespace-nowrap ${enabled ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-white/15 text-white/50'}`}
            >
              {enabled ? '✓ activa' : 'desactivada'}
            </button>
          </form>
        </div>
      </div>
      {enabled && <div className="p-5" data-sec-editor={sectionKey}>{children}</div>}
    </div>
  );
}
