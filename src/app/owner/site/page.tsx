import Link from "next/link";
import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { mergeConfig, type SectionKey } from "@/lib/site/types";
import { getTenantModules } from "@/lib/modules/queries";
import type { ModuleKey } from "@/lib/modules/types";
import {
  toggleSectionAction,
  moveSectionAction,
  setSectionBgColorAction,
  setSectionTextColorAction,
  updatePaywallAction
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
  CardsEditor,
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
  MapEditor,
  BlogPreviewEditor,
  ArticleListEditor,
  CategoryShowcaseEditor,
  ProductsEditor,
  BenefitsBarEditor,
  CategoryCardsEditor,
  HeroSlidesEditor,
  ProductsStripEditor,
  CustomEditor,
  NavEditor,
  FooterEditor
} from "@/components/owner/site/SectionEditors";
import { ColorAutoSave } from "@/components/owner/site/ColorAutoSave";
import { SectionStyleEditor } from "@/components/owner/site/SectionStyleEditor";
import { EyebrowAutoSave } from "@/components/owner/site/EyebrowAutoSave";
import { HrefTargetsProvider } from "@/components/owner/site/HrefSelect";
import { buildCourseTargets } from "@/components/owner/site/href-targets";
import { SiteBuilderToolbar } from "@/components/owner/site/SiteBuilderToolbar";
import { setWhatsAppConfigAction } from "@/lib/whatsapp/actions";

export const dynamic = "force-dynamic";

const SECTION_META: Record<SectionKey, { title: string; desc: string }> = {
  hero:         { title: "🏆 Hero", desc: "Primera impresión. Plantilla centrada, dividida, galería o slider auto." },
  benefits_bar: { title: "🚚 Cinta de beneficios", desc: "Cinta debajo del hero con envíos, cuotas, transferencia. Estilo ecommerce Amazon/ML." },
  category_cards: { title: "🗂️ Grid de categorías", desc: "Bloques grandes con imagen + label, links a filtros. Tipo Tienda Nube, Shopify." },
  products_strip: { title: "🎠 Carrusel de productos", desc: "Cinta horizontal scrolleable con productos. Tipo 'Inspirado en lo último que viste' de MercadoLibre." },
  trusted_by:   { title: "🤝 Confían en nosotros", desc: "Logos de clientes/marcas, con filtro grayscale opcional." },
  about:        { title: "🪪 Sobre nosotros", desc: "Quién sos, qué te diferencia, por qué eligen tu sitio." },
  instructor:   { title: "👤 Instructor", desc: "Quién va a enseñar. Foto, biografía, credenciales." },
  stats:        { title: "📊 Estadísticas", desc: "Números fuertes: alumnos formados, años, satisfacción." },
  learn_points: { title: "✅ Qué vas a aprender", desc: "Lista de puntos con check marks. Lo que se llevan." },
  features:     { title: "🎴 Features (3 tarjetas)", desc: "Beneficios o diferenciales con icono + título + texto." },
  featured:     { title: "⭐ Publicaciones destacados", desc: "Publicaciones marcados como destacados desde su editor." },
  catalog:      { title: "📚 Catálogo completo", desc: "Todas las publicaciones publicados con filtros por categoría." },
  cards:        { title: "🧩 Tarjetas (bloques destacados)", desc: "Tarjetas custom: info, producto, link, banner horizontal/vertical con imagen + texto." },
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
  map:          { title: "📍 Mapa / Ubicación", desc: "Mostrá dónde estás con Google Maps embebido (sin API key)." },
  workwithus:   { title: "🤝 Trabajá con nosotros", desc: "CTA de programa de afiliados. Aparece solo si activaste el programa en Afiliados → Configuración." },
  blog_preview: { title: "📰 Últimas del blog", desc: "Grid con los últimos artículos publicados en tu blog. Link para ver todo." },
  article_list: { title: "📑 Columnas de headlines", desc: "Múltiples listas de artículos lado a lado (Últimas, Tendencias, etc). Para sitios editoriales tipo NYT/The Times." },
  category_showcase: { title: "🗞️ Vitrinas por categoría", desc: "Un bloque por cada categoría (Deportes, Cultura, etc): 1 artículo grande + 4 chicos en grid. Estilo NYT 'Life & Style' / The Times." },
  featured_event: { title: "🏆 Evento destacado", desc: "Strip horizontal con 4 notas de un evento puntual (Mundial, elecciones, gran pelea, cumbre). Filtra por tag para agrupar notas de distintas categorías bajo un mismo evento." },
  videos_reel: { title: "🎬 Strip de shorts (YouTube)", desc: "Fila horizontal de videos verticales tipo NYT 'Watch Today's Videos'. Click abre /reels con navegación TikTok-style + autoplay." },
  products:     { title: "📦 Tienda / Productos físicos", desc: "Grid con productos publicados. Link para ver toda la tienda." },
  cta_final:    { title: "🎯 CTA final", desc: "Cierre de la página con llamado a la acción." }
};

/**
 * Secciones que dependen de una app específica. Cuando la app está off,
 * el editor de la sección se bloquea y muestra un CTA "Activar app".
 * El toggle de habilitar la sección tampoco funciona hasta activar.
 */
const SECTION_REQUIRES_MODULE: Partial<Record<SectionKey, { key: ModuleKey; label: string }>> = {
  blog_preview:   { key: 'blog',       label: 'Blog' },
  products:       { key: 'ecommerce',  label: 'Tienda online (productos físicos)' },
  products_strip: { key: 'ecommerce',  label: 'Tienda online (productos físicos)' },
  benefits_bar:   { key: 'ecommerce',  label: 'Tienda online (productos físicos)' },
  workwithus:     { key: 'affiliates', label: 'Programa de afiliados' }
};

export default async function SiteBuilderPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const modules = await getTenantModules(tenant.id);
  // Traigo también site_config_published + timestamp para el toolbar
  // (Wix-style draft/published). Defensivo con any por si migration 0048
  // aún no corrió: los campos vienen undefined y todo sigue funcionando.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenantRow } = await (svc.from("tenants") as any)
    .select("site_config, site_config_published, site_config_published_at, brand, whatsapp_number, whatsapp_greeting, whatsapp_position")
    .eq("id", tenant.id)
    .single();
  const tr = tenantRow as {
    site_config?: unknown;
    site_config_published?: unknown;
    site_config_published_at?: string | null;
    brand?: { primary_color?: string } | null;
    whatsapp_number?: string | null;
    whatsapp_greeting?: string | null;
    whatsapp_position?: string | null;
  } | null;
  const waNumber = tr?.whatsapp_number ?? '';
  const waGreeting = tr?.whatsapp_greeting ?? '';
  const waPosition = (tr?.whatsapp_position === 'left' ? 'left' : 'right') as 'left' | 'right';
  const cfg = mergeConfig(tr?.site_config);
  const primary = tr?.brand?.primary_color ?? '#f97316';
  // ¿Hay cambios sin publicar? Comparo la serialización de ambos objetos.
  // No hashing sofisticado — el jsonb ya es determinístico y esto corre
  // 1× por page load, no en un loop.
  const draftSerial = JSON.stringify(tr?.site_config ?? null);
  const publishedSerial = JSON.stringify(tr?.site_config_published ?? null);
  const hasUnpublishedChanges = draftSerial !== publishedSerial;
  const lastPublishedAt = tr?.site_config_published_at ?? null;

  // Publicaciones del tenant para enriquecer el dropdown de href
  // (cada publicación aparece como link directo + opción de checkout).
  const { data: ownerCourses } = await svc
    .from("courses")
    .select("slug, title")
    .eq("tenant_id", tenant.id)
    .eq("status", "published")
    .order("created_at", { ascending: false });
  const courseTargets = buildCourseTargets((ownerCourses ?? []) as Array<{ slug: string; title: string }>);

  // Categorías del tenant (para el dropdown del category_showcase editor).
  // Defensivo si no hay tabla o RLS.
  let availableCategories: Array<{ slug: string; name: string }> = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: catsRaw } = await (svc.from('course_categories') as any)
      .select('slug, name')
      .eq('tenant_id', tenant.id)
      .order('position', { ascending: true });
    availableCategories = (catsRaw ?? []) as Array<{ slug: string; name: string }>;
  } catch { /* ignore */ }

  // Forms disponibles del tenant (para el dropdown del hero media_type='form').
  // Defensivo: si la migración 0030 aún no corrió, fallback silencioso a [].
  let availableForms: Array<{ id: string; title: string }> = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: fr } = await (svc.from('forms') as any)
      .select('id, title')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });
    availableForms = (fr ?? []) as Array<{ id: string; title: string }>;
  } catch { /* migración pendiente */ }

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
    <HrefTargetsProvider targets={courseTargets}>
    <div className="space-y-6 max-w-6xl">
      {previewCss && (
        <style dangerouslySetInnerHTML={{ __html: previewCss }} />
      )}
      {/* Wix-style: barra fija arriba con estado guardado + Publicar */}
      <SiteBuilderToolbar
        publicUrl={publicUrl}
        initiallyDirty={hasUnpublishedChanges}
        lastPublishedAt={lastPublishedAt}
      />
      <p className="text-white/60 text-sm">
        Cada cambio se guarda solo. Cuando estés listo, tocá <strong>Publicar</strong> para
        que aparezca en tu sitio. Podés descartar cambios sin publicar en cualquier momento.
      </p>

      {/* Las plantillas pre-armadas se movieron a la sección Templates
          (/owner/templates) que tiene un catálogo completo por vertical.
          El bloque viejo fue eliminado de acá porque duplicaba esa entrada
          de menú y confundía. */}

      {/* Botón flotante de WhatsApp */}
      <div className="rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-emerald-500/[0.02] p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              💬 Botón flotante de WhatsApp
              {waNumber && (
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Activo</span>
              )}
            </h2>
            <p className="text-sm text-white/60 mt-1">
              Aparece en tu sitio abajo a la derecha (o izquierda). Al clickearlo
              abre WhatsApp Web / la app con un mensaje pre-cargado.
            </p>
          </div>
        </div>
        <form action={setWhatsAppConfigAction} className="grid sm:grid-cols-2 gap-3">
          <label className="block sm:col-span-2">
            <span className="text-xs uppercase tracking-wider text-white/55 font-semibold">Número de WhatsApp</span>
            <input name="whatsapp_number" defaultValue={waNumber}
              placeholder="+54 9 11 2345 6789"
              className="mt-1 w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <span className="text-[10px] text-white/40">Formato internacional. Dejalo vacío para desactivar el botón.</span>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs uppercase tracking-wider text-white/55 font-semibold">Mensaje que se abre pre-cargado (opcional)</span>
            <textarea name="whatsapp_greeting" defaultValue={waGreeting} rows={2}
              maxLength={300}
              placeholder="Hola, vi tu sitio y quería consultar por..."
              className="mt-1 w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-white/55 font-semibold">Posición</span>
            <select name="whatsapp_position" defaultValue={waPosition}
              className="mt-1 w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
              <option value="right" className="bg-[#0a0a0a]">Abajo a la derecha (default)</option>
              <option value="left" className="bg-[#0a0a0a]">Abajo a la izquierda</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <button type="submit"
              className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
              Guardar
            </button>
          </div>
        </form>
      </div>

      {cfg.order.map((key, idx) => {
        const meta = SECTION_META[key];
        const isFirst = idx === 0;
        const isLast = idx === cfg.order.length - 1;
        const req = SECTION_REQUIRES_MODULE[key];
        const requiresModule = req && modules[req.key] === false
          ? { key: req.key, label: req.label }
          : null;
        return (
          <Section
            key={key}
            sectionKey={key}
            title={meta.title}
            desc={meta.desc}
            enabled={cfg.sections[key].enabled}
            requiresModule={requiresModule}
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
            brandHex={primary}
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
                mediaType={cfg.sections.hero.media_type ?? 'image'}
                videoUrl={cfg.sections.hero.video_url ?? ''}
                formId={cfg.sections.hero.form_id ?? ''}
                availableForms={availableForms}
              />
            )}
            {key === 'trusted_by' && (
              <TrustedByEditor
                initialTitle={cfg.sections.trusted_by.title}
                items={cfg.sections.trusted_by.items}
                grayscale={cfg.sections.trusted_by.grayscale}
                marquee={cfg.sections.trusted_by.marquee}
                marqueeSpeed={cfg.sections.trusted_by.marquee_speed ?? 30}
                logoHeight={cfg.sections.trusted_by.logo_height ?? 40}
                logoGap={cfg.sections.trusted_by.logo_gap ?? 64}
              />
            )}
            {key === 'about' && (<>
              <div className="mb-4 max-w-md">
                <EyebrowAutoSave sectionKey="about" initial={cfg.sections.about.eyebrow_text} placeholder="SOBRE NOSOTROS" />
              </div>
              <AboutEditor
                initial={{
                  title: cfg.sections.about.title,
                  body: cfg.sections.about.body,
                  image_position: cfg.sections.about.image_position,
                  image_fit: cfg.sections.about.image_fit
                }}
                imageUrl={cfg.sections.about.image_url}
                primary={primary}
              />
            </>)}
            {key === 'instructor' && (
              <>
              <div className="mb-4 max-w-md">
                <EyebrowAutoSave sectionKey="instructor" initial={cfg.sections.instructor.eyebrow_text} placeholder="QUIÉN ENSEÑA" />
              </div>
              <InstructorEditor
                initial={{
                  title: cfg.sections.instructor.title,
                  display_mode: cfg.sections.instructor.display_mode ?? 'single'
                }}
                items={cfg.sections.instructor.items ?? []}
                primary={primary}
              />
            </>
            )}
            {key === 'stats' && (
              <StatsEditor
                initialTitle={cfg.sections.stats.title}
                items={cfg.sections.stats.items}
                primary={primary}
              />
            )}
            {key === 'learn_points' && (
              <>
              <div className="mb-4 max-w-md">
                <EyebrowAutoSave sectionKey="learn_points" initial={cfg.sections.learn_points.eyebrow_text} placeholder="APRENDIZAJE" />
              </div>
              <LearnPointsEditor
                initialTitle={cfg.sections.learn_points.title}
                initialSubtitle={cfg.sections.learn_points.subtitle}
                items={cfg.sections.learn_points.items}
                primary={primary}
              />
            </>
            )}
            {key === 'features' && (
              <>
              <div className="mb-4 max-w-md">
                <EyebrowAutoSave sectionKey="features" initial={cfg.sections.features.eyebrow_text} placeholder="BENEFICIOS" />
              </div>
              <FeaturesEditor
                initialTitle={cfg.sections.features.title}
                items={cfg.sections.features.items}
                primary={primary}
              />
            </>
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
                initialManualCardsPosition={cfg.sections.catalog.manual_cards_position ?? 'before'}
                initialShowAutoCourses={cfg.sections.catalog.show_auto_courses !== false}
                initialCardStyle={cfg.sections.catalog.card_style ?? 'classic'}
                primary={primary}
              />
            )}
            {key === 'cards' && (
              <CardsEditor
                initialTitle={cfg.sections.cards.title}
                initialSubtitle={cfg.sections.cards.subtitle ?? ''}
                initialColumns={(cfg.sections.cards.columns ?? 3) as 2 | 3 | 4}
                items={cfg.sections.cards.items}
                primary={primary}
              />
            )}
            {key === 'testimonials' && (
              <>
              <div className="mb-4 max-w-md">
                <EyebrowAutoSave sectionKey="testimonials" initial={cfg.sections.testimonials.eyebrow_text} placeholder="TESTIMONIOS" />
              </div>
              <TestimonialsEditor
                initialTitle={cfg.sections.testimonials.title}
                items={cfg.sections.testimonials.items}
                primary={primary}
              />
            </>
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
              <>
              <div className="mb-4 max-w-md">
                <EyebrowAutoSave sectionKey="faq" initial={cfg.sections.faq.eyebrow_text} placeholder="FAQ" />
              </div>
              <FaqEditor initialTitle={cfg.sections.faq.title} items={cfg.sections.faq.items} />
            </>
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
              <>
              <div className="mb-4 max-w-md">
                <EyebrowAutoSave sectionKey="contact" initial={cfg.sections.contact.eyebrow_text} placeholder="CONTACTO" />
              </div>
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
            </>
            )}
            {key === 'map' && (
              <MapEditor
                initial={{
                  title: cfg.sections.map.title,
                  subtitle: cfg.sections.map.subtitle,
                  address: cfg.sections.map.address ?? '',
                  zoom: cfg.sections.map.zoom ?? 15,
                  height_px: cfg.sections.map.height_px ?? 400,
                  show_directions_cta: cfg.sections.map.show_directions_cta ?? true
                }}
              />
            )}
            {key === 'blog_preview' && (
              <BlogPreviewEditor
                initial={{
                  title: cfg.sections.blog_preview.title,
                  subtitle: cfg.sections.blog_preview.subtitle,
                  count: cfg.sections.blog_preview.count ?? 3,
                  cta_label: cfg.sections.blog_preview.cta_label,
                  layout: cfg.sections.blog_preview.layout ?? 'grid'
                }}
              />
            )}
            {key === 'article_list' && (
              <ArticleListEditor
                initial={{ columns: cfg.sections.article_list?.columns ?? [] }}
              />
            )}
            {key === 'category_showcase' && (
              <CategoryShowcaseEditor
                initial={{ blocks: cfg.sections.category_showcase?.blocks ?? [] }}
                availableCategories={availableCategories}
              />
            )}
            {key === 'products' && (
              <ProductsEditor
                initial={{
                  title: cfg.sections.products.title,
                  subtitle: cfg.sections.products.subtitle,
                  count: cfg.sections.products.count ?? 8,
                  layout: cfg.sections.products.layout ?? 'grid',
                  cta_label: cfg.sections.products.cta_label
                }}
              />
            )}
            {key === 'benefits_bar' && (
              <BenefitsBarEditor
                initial={cfg.sections.benefits_bar.items}
                variant={cfg.sections.benefits_bar.variant}
              />
            )}
            {key === 'category_cards' && (
              <CategoryCardsEditor
                initial={cfg.sections.category_cards.items}
                aspect={cfg.sections.category_cards.aspect}
                layout={cfg.sections.category_cards.layout}
              />
            )}
            {key === 'products_strip' && (
              <ProductsStripEditor
                initial={{
                  title: cfg.sections.products_strip.title,
                  subtitle: cfg.sections.products_strip.subtitle,
                  source: cfg.sections.products_strip.source ?? 'featured',
                  category_slug: cfg.sections.products_strip.category_slug ?? '',
                  count: cfg.sections.products_strip.count ?? 12,
                  cta_label: cfg.sections.products_strip.cta_label ?? '',
                  cta_href: cfg.sections.products_strip.cta_href ?? '/tienda'
                }}
                categoriesOptions={[]}
              />
            )}
            {/* Hero slider — editor accesible siempre dentro del hero */}
            {key === 'hero' && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="text-xs uppercase tracking-wider text-white/60 mb-3 font-semibold">
                  🎠 Modo slider auto (opcional)
                </div>
                <HeroSlidesEditor
                  initial={cfg.sections.hero.slides ?? []}
                  interval={cfg.sections.hero.slide_interval}
                />
              </div>
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
            showMyCourses={cfg.nav.show_my_courses === true}
            showAffiliates={cfg.nav.show_affiliates === true}
            showCategoriesMega={cfg.nav.show_categories_mega === true}
            categoriesMegaLabel={cfg.nav.categories_mega_label ?? ''}
            myCoursesLabel={cfg.nav.my_courses_label ?? ''}
            affiliatesLabel={cfg.nav.affiliates_label ?? ''}
            primary={primary}
            tenantName={tenant.name}
          />
        </div>
      </div>

      <div className="pt-6 border-t border-white/10">
        <h2 className="text-xl font-bold mb-2">🔒 Paywall del blog</h2>
        <div className="rounded-xl border border-white/15 bg-white/[0.02] p-5">
          <PaywallEditor cfg={cfg.paywall} />
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
    </HrefTargetsProvider>
  );
}

/**
 * Editor del paywall del blog: 3 tarjetas grandes (off / soft / hard)
 * + campos de configuración fina (título, mensaje, CTA, párrafos gratis).
 * Un radio compartido; el submit graba todo en un action solo.
 */
function PaywallEditor({ cfg }: { cfg: import('@/lib/site/types').SiteConfig['paywall'] }) {
  const current = cfg?.mode || 'off';
  return (
    <form action={updatePaywallAction} className="space-y-4">
      <div className="grid md:grid-cols-3 gap-3">
        {([
          { v: 'off', icon: '🔓', label: 'Sin paywall', desc: 'Todas las notas se leen completas. Comportamiento tradicional.' },
          { v: 'soft', icon: '💡', label: 'Opcional', desc: 'Muestra los primeros párrafos + banner recomendando suscribirse, pero el visitante puede cerrar y leer igual.' },
          { v: 'hard', icon: '🔒', label: 'Obligatorio', desc: 'Los primeros párrafos gratis + gate bloqueante. Sin suscripción no se puede leer el resto.' }
        ] as const).map((opt) => (
          <label key={opt.v}
            className={`cursor-pointer border-2 rounded-lg p-4 transition ${
              current === opt.v
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-white/15 bg-white/[0.03] hover:border-white/30'
            }`}>
            <input type="radio" name="mode" value={opt.v} defaultChecked={current === opt.v} className="sr-only" />
            <div className="text-3xl mb-2">{opt.icon}</div>
            <div className="font-bold mb-1">{opt.label}</div>
            <div className="text-xs text-white/70">{opt.desc}</div>
          </label>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-xs font-semibold text-white/70">Párrafos gratis antes del paywall</span>
          <input name="free_paragraphs" type="number" min={1} max={10}
            defaultValue={cfg?.free_paragraphs ?? 3}
            className="mt-1 w-full border border-white/15 bg-white/[0.02] rounded px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold text-white/70">Link del CTA (ancla o URL)</span>
          <input name="cta_href" defaultValue={cfg?.cta_href ?? '#pricing'}
            className="mt-1 w-full border border-white/15 bg-white/[0.02] rounded px-3 py-2 text-sm font-mono"
            placeholder="#pricing" />
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-xs font-semibold text-white/70">Título del paywall</span>
        <input name="title" defaultValue={cfg?.title ?? ''} maxLength={120}
          className="mt-1 w-full border border-white/15 bg-white/[0.02] rounded px-3 py-2 text-sm"
          placeholder="Seguí leyendo esta nota exclusiva" />
      </label>

      <label className="block text-sm">
        <span className="text-xs font-semibold text-white/70">Mensaje persuasivo</span>
        <textarea name="message" rows={2} maxLength={500} defaultValue={cfg?.message ?? ''}
          className="mt-1 w-full border border-white/15 bg-white/[0.02] rounded px-3 py-2 text-sm"
          placeholder="Suscribite y accedé sin límites a todas las notas, análisis y podcasts." />
      </label>

      <div className="grid md:grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="text-xs font-semibold text-white/70">Texto del botón CTA</span>
          <input name="cta_label" defaultValue={cfg?.cta_label ?? 'Suscribirme ahora'} maxLength={60}
            className="mt-1 w-full border border-white/15 bg-white/[0.02] rounded px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold text-white/70">
            Texto &ldquo;seguir leyendo igual&rdquo; (solo modo Opcional)
          </span>
          <input name="dismiss_label" defaultValue={cfg?.dismiss_label ?? 'Seguir leyendo igual'} maxLength={60}
            className="mt-1 w-full border border-white/15 bg-white/[0.02] rounded px-3 py-2 text-sm" />
        </label>
      </div>

      <button type="submit"
        className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">
        Guardar paywall
      </button>

      <div className="text-xs text-white/50">
        💡 Los suscriptores activos y el owner del sitio SIEMPRE ven las notas completas —
        sin importar el modo.
      </div>
    </form>
  );
}

function Section({
  title, desc, enabled, sectionKey, requiresModule, bgColor, textColor, styles, children, isFirst, isLast, position, total, brandHex
}: {
  title: string; desc: string; enabled: boolean; sectionKey: string;
  /** Si la sección depende de una app off, se pasa este objeto y la sección aparece bloqueada. */
  requiresModule: { key: ModuleKey; label: string } | null;
  bgColor: string | null; textColor: string | null;
  styles: {
    title_color: string | null; body_color: string | null; accent_color: string | null;
    card_bg_color: string | null; card_border_color: string | null;
    font_family: string | null; title_weight: string | null;
  };
  children: React.ReactNode; isFirst: boolean; isLast: boolean; position: number; total: number;
  /** Hex del brand del tenant — se propaga a ColorAutoSave y desde ahí
   *  a ThemePresets para mostrar el swatch "Usar el color/gradient de
   *  mi sitio". */
  brandHex?: string;
}) {
  const locked = !!requiresModule;
  return (
    <div className={`rounded-xl border ${
      locked ? 'border-amber-500/30 bg-amber-500/[0.03]' :
      enabled ? 'border-white/15 bg-white/[0.02]' : 'border-white/10 bg-white/[0.01] opacity-70'
    }`}>
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
            <h3 className="font-semibold flex items-center gap-2 flex-wrap">
              {title}
              <span className="text-xs text-white/30 font-normal">{position}/{total}</span>
              {locked && (
                <span className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                  🔒 App off
                </span>
              )}
            </h3>
            <p className="text-xs text-white/50 mt-0.5">{desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Color pickers y toggle sólo tienen sentido cuando la sección
              no está bloqueada por app off — si la app no está activa, el
              contenido no va a renderizar en el sitio de todas formas. */}
          {!locked && (<>
            <ColorAutoSave
              label="Fondo"
              fieldName="bg_color"
              sectionKey={sectionKey}
              initial={bgColor}
              action={setSectionBgColorAction}
              brandHex={brandHex}
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
          </>)}
        </div>
      </div>
      {locked ? (
        // Estado bloqueado: reemplaza el editor por un CTA para activar la app.
        // El link va a /modulos?open=<key> — el AppMarket auto-abre ese modal
        // (mismo patrón que "Activar app" desde Mis publicaciones).
        <div className="p-6 text-center space-y-3">
          <p className="text-sm text-white/70">
            Esta sección requiere la app{' '}
            <strong className="text-white">{requiresModule!.label}</strong>.
            Actívala para poder editarla y mostrarla en tu sitio.
          </p>
          <Link
            href={`/modulos?open=${requiresModule!.key}`}
            className="inline-block rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-sm font-semibold px-4 py-2 hover:bg-emerald-500/20"
          >
            ⚡ Activar {requiresModule!.label}
          </Link>
        </div>
      ) : enabled ? (
        <div className="p-5" data-sec-editor={sectionKey}>{children}</div>
      ) : null}
    </div>
  );
}
