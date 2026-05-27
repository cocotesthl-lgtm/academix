import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { DEFAULT_SITE_CONFIG, type SiteConfig } from "@/lib/site/types";
import {
  toggleSectionAction,
  updateSectionFieldsAction,
  uploadAboutImageAction,
  addTestimonialAction,
  deleteTestimonialAction,
  addFaqAction,
  deleteFaqAction
} from "@/lib/site/actions";

export const dynamic = "force-dynamic";

export default async function SiteBuilderPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const { data } = await svc
    .from("tenants")
    .select("site_config")
    .eq("id", tenant.id)
    .single<{ site_config: SiteConfig | null }>();
  const cfg: SiteConfig = data?.site_config ?? DEFAULT_SITE_CONFIG;

  // Build public URL
  const u = new URL(env.appUrl);
  const isLocal = u.hostname === 'localhost' || u.hostname.endsWith('.localhost');
  const publicHost = isLocal
    ? `${tenant.slug}.localhost${u.port ? ':' + u.port : ''}`
    : `${tenant.slug}.${env.rootDomain}`;
  const publicUrl = `${u.protocol}//${publicHost}`;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Editor de sitio</h1>
          <p className="text-white/60 text-sm mt-1">
            Personalizá las secciones de tu academia pública. Cada sección se puede prender o apagar.
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

      {/* HERO */}
      <Section title="🏆 Hero" desc="Primera impresión arriba del todo. Título grande + subtítulo + botón principal." enabled={cfg.sections.hero.enabled} sectionKey="hero">
        <form action={updateSectionFieldsAction} className="space-y-3">
          <input type="hidden" name="section" value="hero" />
          <Field label="Título (opcional, default = nombre de la academia)" name="title" defaultValue={cfg.sections.hero.title ?? ''} placeholder={tenant.name} />
          <Field label="Subtítulo" name="subtitle" defaultValue={cfg.sections.hero.subtitle} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Texto del botón" name="cta_label" defaultValue={cfg.sections.hero.cta_label} />
            <Field label="Destino del botón (href)" name="cta_href" defaultValue={cfg.sections.hero.cta_href} />
          </div>
          <SaveButton />
        </form>
      </Section>

      {/* ABOUT */}
      <Section title="🪪 Sobre nosotros" desc="Quién sos, qué te diferencia, por qué eligen tu academia." enabled={cfg.sections.about.enabled} sectionKey="about">
        <form action={updateSectionFieldsAction} className="space-y-3">
          <input type="hidden" name="section" value="about" />
          <Field label="Título" name="title" defaultValue={cfg.sections.about.title} />
          <Textarea label="Texto" name="body" rows={5} defaultValue={cfg.sections.about.body} />
          <SaveButton />
        </form>
        <form action={uploadAboutImageAction} className="mt-4 flex items-center gap-3 pt-3 border-t border-white/5">
          <div className="w-24 h-24 rounded-md bg-white/5 border border-white/15 overflow-hidden flex items-center justify-center">
            {cfg.sections.about.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cfg.sections.about.image_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs text-white/40">sin foto</span>
            )}
          </div>
          <div className="flex-1">
            <label className="block text-sm text-white/70 mb-1.5">Foto (opcional)</label>
            <input type="file" name="image" accept="image/png,image/jpeg,image/webp" className="text-sm text-white/70 file:mr-3 file:rounded-md file:border-0 file:bg-white file:text-black file:px-3 file:py-1.5 file:font-medium" />
            <button className="ml-2 rounded-md bg-white text-black px-3 py-1.5 text-sm font-medium hover:bg-white/90">Subir</button>
          </div>
        </form>
      </Section>

      {/* FEATURED */}
      <Section title="⭐ Cursos destacados" desc="Aparecen arriba del catálogo. Marca cursos como 'destacado' desde cada curso." enabled={cfg.sections.featured.enabled} sectionKey="featured">
        <form action={updateSectionFieldsAction} className="space-y-3">
          <input type="hidden" name="section" value="featured" />
          <Field label="Título de la sección" name="title" defaultValue={cfg.sections.featured.title} />
          <SaveButton />
        </form>
      </Section>

      {/* CATALOG */}
      <Section title="📚 Catálogo completo" desc="Todos los cursos publicados. Mostrá filtros por categoría si tenés varios." enabled={cfg.sections.catalog.enabled} sectionKey="catalog">
        <form action={updateSectionFieldsAction} className="space-y-3">
          <input type="hidden" name="section" value="catalog" />
          <Field label="Título de la sección" name="title" defaultValue={cfg.sections.catalog.title} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="show_filters" defaultChecked={cfg.sections.catalog.show_filters} />
            Mostrar filtros por categoría
          </label>
          <SaveButton />
        </form>
      </Section>

      {/* TESTIMONIALS */}
      <Section title="💬 Testimonios" desc="Prueba social. Comentarios de tus alumnos." enabled={cfg.sections.testimonials.enabled} sectionKey="testimonials">
        <form action={updateSectionFieldsAction} className="space-y-3">
          <input type="hidden" name="section" value="testimonials" />
          <Field label="Título de la sección" name="title" defaultValue={cfg.sections.testimonials.title} />
          <SaveButton />
        </form>

        <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
          <ul className="space-y-2">
            {cfg.sections.testimonials.items.length === 0 && (
              <li className="text-xs text-white/40">Sin testimonios aún.</li>
            )}
            {cfg.sections.testimonials.items.map((t) => (
              <li key={t.id} className="rounded border border-white/10 p-3 flex items-start justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">{t.name}{t.role && <span className="text-white/40"> · {t.role}</span>}</div>
                  <div className="text-white/70 mt-1">{t.text}</div>
                </div>
                <form action={deleteTestimonialAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="text-xs text-red-300 hover:text-red-200">Eliminar</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addTestimonialAction} className="grid grid-cols-2 gap-2">
            <input name="name" required placeholder="Nombre" className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <input name="role" placeholder="Rol o ciudad (opcional)" className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <input name="text" required placeholder="Lo que dijo" className="col-span-2 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <button className="col-span-2 rounded bg-white text-black px-3 py-1.5 text-sm font-medium">+ Agregar testimonio</button>
          </form>
        </div>
      </Section>

      {/* FAQ */}
      <Section title="❓ Preguntas frecuentes" desc="Responde objeciones comunes antes de la compra." enabled={cfg.sections.faq.enabled} sectionKey="faq">
        <form action={updateSectionFieldsAction} className="space-y-3">
          <input type="hidden" name="section" value="faq" />
          <Field label="Título de la sección" name="title" defaultValue={cfg.sections.faq.title} />
          <SaveButton />
        </form>

        <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
          <ul className="space-y-2">
            {cfg.sections.faq.items.length === 0 && <li className="text-xs text-white/40">Sin preguntas aún.</li>}
            {cfg.sections.faq.items.map((f) => (
              <li key={f.id} className="rounded border border-white/10 p-3 flex items-start justify-between gap-3">
                <div className="text-sm">
                  <div className="font-medium">{f.q}</div>
                  <div className="text-white/70 mt-1 whitespace-pre-line">{f.a}</div>
                </div>
                <form action={deleteFaqAction}>
                  <input type="hidden" name="id" value={f.id} />
                  <button className="text-xs text-red-300 hover:text-red-200">Eliminar</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addFaqAction} className="space-y-2">
            <input name="q" required placeholder="Pregunta" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <textarea name="a" required rows={2} placeholder="Respuesta" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <button className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium">+ Agregar pregunta</button>
          </form>
        </div>
      </Section>

      {/* CTA FINAL */}
      <Section title="🎯 CTA final" desc="Cierre de la página, después del catálogo." enabled={cfg.sections.cta_final.enabled} sectionKey="cta_final">
        <form action={updateSectionFieldsAction} className="space-y-3">
          <input type="hidden" name="section" value="cta_final" />
          <Field label="Título" name="title" defaultValue={cfg.sections.cta_final.title} />
          <Textarea label="Texto" name="body" rows={3} defaultValue={cfg.sections.cta_final.body} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Texto del botón" name="cta_label" defaultValue={cfg.sections.cta_final.cta_label} />
            <Field label="Destino (href)" name="cta_href" defaultValue={cfg.sections.cta_final.cta_href} />
          </div>
          <SaveButton />
        </form>
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
    <div className={`rounded-xl border ${enabled ? 'border-white/15 bg-white/[0.02]' : 'border-white/10 bg-white/[0.01] opacity-80'}`}>
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

function Field({ label, name, defaultValue, placeholder }: { label: string; name: string; defaultValue?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1">{label}</label>
      <input
        name={name}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
      />
    </div>
  );
}

function Textarea({ label, name, defaultValue, rows = 3 }: { label: string; name: string; defaultValue?: string; rows?: number }) {
  return (
    <div>
      <label className="block text-xs text-white/60 mb-1">{label}</label>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ''}
        className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
      />
    </div>
  );
}

function SaveButton() {
  return (
    <button className="rounded bg-white text-black px-3 py-1.5 text-sm font-medium hover:bg-white/90">
      Guardar
    </button>
  );
}
