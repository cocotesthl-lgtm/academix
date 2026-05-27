import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { mergeConfig, type SectionKey } from "@/lib/site/types";
import { toggleSectionAction, moveSectionAction } from "@/lib/site/actions";
import {
  HeroEditor,
  AboutEditor,
  InstructorEditor,
  StatsEditor,
  FeaturedEditor,
  CatalogEditor,
  TestimonialsEditor,
  FaqEditor,
  NewsletterEditor,
  CtaFinalEditor,
  NavEditor,
  FooterEditor
} from "@/components/owner/site/SectionEditors";

export const dynamic = "force-dynamic";

const SECTION_META: Record<SectionKey, { title: string; desc: string }> = {
  hero:         { title: "🏆 Hero", desc: "Primera impresión arriba del todo. Título grande + subtítulo + botón principal." },
  about:        { title: "🪪 Sobre nosotros", desc: "Quién sos, qué te diferencia, por qué eligen tu academia." },
  instructor:   { title: "👤 Instructor", desc: "Quién va a enseñar. Foto, biografía, credenciales." },
  stats:        { title: "📊 Estadísticas", desc: "Números fuertes: alumnos formados, años de experiencia, satisfacción." },
  featured:     { title: "⭐ Cursos destacados", desc: "Aparecen arriba del catálogo. Marcalos como destacados desde cada curso." },
  catalog:      { title: "📚 Catálogo completo", desc: "Todos los cursos publicados, con filtros opcionales por categoría." },
  testimonials: { title: "💬 Testimonios", desc: "Prueba social. Comentarios de tus alumnos." },
  faq:          { title: "❓ Preguntas frecuentes", desc: "Responde objeciones comunes antes de la compra." },
  newsletter:   { title: "📧 Newsletter", desc: "Capturá emails con un formulario simple." },
  cta_final:    { title: "🎯 CTA final", desc: "Cierre de la página, después del catálogo." }
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

  const u = new URL(env.appUrl);
  const isLocal = u.hostname === 'localhost' || u.hostname.endsWith('.localhost');
  const publicHost = isLocal
    ? `${tenant.slug}.localhost${u.port ? ':' + u.port : ''}`
    : `${tenant.slug}.${env.rootDomain}`;
  const publicUrl = `${u.protocol}//${publicHost}`;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Editor de sitio</h1>
          <p className="text-white/60 text-sm mt-1">
            Personalizá las secciones de tu academia pública. El preview de la derecha se actualiza en vivo.
            Reordená las secciones con las flechas ↑↓.
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
            isFirst={isFirst}
            isLast={isLast}
            position={idx + 1}
            total={cfg.order.length}
          >
            {key === 'hero' && (
              <HeroEditor
                initial={{
                  title: cfg.sections.hero.title ?? '',
                  subtitle: cfg.sections.hero.subtitle,
                  cta_label: cfg.sections.hero.cta_label,
                  cta_href: cfg.sections.hero.cta_href
                }}
                fallbackTitle={tenant.name}
                primary={primary}
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
                  name: cfg.sections.instructor.name,
                  bio: cfg.sections.instructor.bio,
                  credentials: cfg.sections.instructor.credentials
                }}
                photoUrl={cfg.sections.instructor.photo_url}
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
            {key === 'featured' && (
              <FeaturedEditor initialTitle={cfg.sections.featured.title} primary={primary} />
            )}
            {key === 'catalog' && (
              <CatalogEditor
                initialTitle={cfg.sections.catalog.title}
                initialShowFilters={cfg.sections.catalog.show_filters}
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
            {key === 'faq' && (
              <FaqEditor initialTitle={cfg.sections.faq.title} items={cfg.sections.faq.items} />
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
        <p className="text-white/60 text-sm mb-4">Personalizá los links del menú superior de tu storefront.</p>
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
        <p className="text-white/60 text-sm mb-4">Texto, links legales y redes sociales que aparecen abajo del todo.</p>
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
  title, desc, enabled, sectionKey, children, isFirst, isLast, position, total
}: {
  title: string; desc: string; enabled: boolean; sectionKey: string;
  children: React.ReactNode; isFirst: boolean; isLast: boolean; position: number; total: number;
}) {
  return (
    <div className={`rounded-xl border ${enabled ? 'border-white/15 bg-white/[0.02]' : 'border-white/10 bg-white/[0.01] opacity-70'}`}>
      <div className="p-5 flex items-start justify-between gap-3 border-b border-white/5">
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
      {enabled && <div className="p-5">{children}</div>}
    </div>
  );
}
