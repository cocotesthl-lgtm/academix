import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { DEFAULT_SITE_CONFIG, type SiteConfig } from "@/lib/site/types";
import { toggleSectionAction } from "@/lib/site/actions";
import {
  HeroEditor,
  AboutEditor,
  FeaturedEditor,
  CatalogEditor,
  TestimonialsEditor,
  FaqEditor,
  CtaFinalEditor
} from "@/components/owner/site/SectionEditors";

export const dynamic = "force-dynamic";

export default async function SiteBuilderPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const { data: tenantRow } = await svc
    .from("tenants")
    .select("site_config, brand")
    .eq("id", tenant.id)
    .single<{ site_config: SiteConfig | null; brand: { primary_color?: string; accent_color?: string } | null }>();
  const cfg: SiteConfig = tenantRow?.site_config ?? DEFAULT_SITE_CONFIG;
  const primary = tenantRow?.brand?.primary_color ?? '#a855f7';

  // Build public URL for "Ver storefront"
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
            Personalizá las secciones de tu academia pública. Cada cambio se ve en vivo en el preview de la derecha.
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

      <Section title="🏆 Hero" desc="Primera impresión arriba del todo. Título grande + subtítulo + botón principal."
        enabled={cfg.sections.hero.enabled} sectionKey="hero">
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
      </Section>

      <Section title="🪪 Sobre nosotros" desc="Quién sos, qué te diferencia, por qué eligen tu academia."
        enabled={cfg.sections.about.enabled} sectionKey="about">
        <AboutEditor
          initial={{ title: cfg.sections.about.title, body: cfg.sections.about.body }}
          imageUrl={cfg.sections.about.image_url}
          primary={primary}
        />
      </Section>

      <Section title="⭐ Cursos destacados" desc="Aparecen arriba del catálogo. Marcalos como destacados desde cada curso."
        enabled={cfg.sections.featured.enabled} sectionKey="featured">
        <FeaturedEditor initialTitle={cfg.sections.featured.title} primary={primary} />
      </Section>

      <Section title="📚 Catálogo completo" desc="Todos los cursos publicados, con filtros opcionales por categoría."
        enabled={cfg.sections.catalog.enabled} sectionKey="catalog">
        <CatalogEditor
          initialTitle={cfg.sections.catalog.title}
          initialShowFilters={cfg.sections.catalog.show_filters}
          primary={primary}
        />
      </Section>

      <Section title="💬 Testimonios" desc="Prueba social. Comentarios de tus alumnos."
        enabled={cfg.sections.testimonials.enabled} sectionKey="testimonials">
        <TestimonialsEditor
          initialTitle={cfg.sections.testimonials.title}
          items={cfg.sections.testimonials.items}
          primary={primary}
        />
      </Section>

      <Section title="❓ Preguntas frecuentes" desc="Responde objeciones comunes antes de la compra."
        enabled={cfg.sections.faq.enabled} sectionKey="faq">
        <FaqEditor initialTitle={cfg.sections.faq.title} items={cfg.sections.faq.items} />
      </Section>

      <Section title="🎯 CTA final" desc="Cierre de la página, después del catálogo."
        enabled={cfg.sections.cta_final.enabled} sectionKey="cta_final">
        <CtaFinalEditor
          initial={{
            title: cfg.sections.cta_final.title,
            body: cfg.sections.cta_final.body,
            cta_label: cfg.sections.cta_final.cta_label,
            cta_href: cfg.sections.cta_final.cta_href
          }}
          primary={primary}
        />
      </Section>
    </div>
  );
}

function Section({
  title, desc, enabled, sectionKey, children
}: {
  title: string; desc: string; enabled: boolean; sectionKey: string; children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border ${enabled ? 'border-white/15 bg-white/[0.02]' : 'border-white/10 bg-white/[0.01] opacity-70'}`}>
      <div className="p-5 flex items-start justify-between gap-3 border-b border-white/5">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-white/50 mt-0.5">{desc}</p>
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
