export type TestimonialItem = {
  id: string;
  name: string;
  role?: string;
  photo_url?: string | null;
  text: string;
  rating?: number;     // 1..5
};

export type FaqItem = { id: string; q: string; a: string };
export type StatItem = { id: string; number: string; label: string };
export type LearnItem = { id: string; text: string };
export type FeatureItem = { id: string; icon: string; title: string; body: string };
export type LogoItem = { id: string; name: string; logo_url: string | null; href?: string | null };

export type NavLink = { id: string; label: string; href: string };
export type SocialLink = {
  id: string;
  network: 'instagram' | 'youtube' | 'linkedin' | 'twitter' | 'tiktok' | 'facebook' | 'web';
  href: string;
};

export type HeroLayout = 'centered' | 'split' | 'gallery';

export type SectionKey =
  | 'hero'
  | 'trusted_by'
  | 'about'
  | 'instructor'
  | 'stats'
  | 'learn_points'
  | 'features'
  | 'featured'
  | 'catalog'
  | 'testimonials'
  | 'before_after'
  | 'faq'
  | 'offer'
  | 'newsletter'
  | 'cta_final';

/**
 * Shared base for every section: enable flag + optional bg color override.
 * Sections add their own fields on top.
 */
type SectionBase = {
  enabled: boolean;
  bg_color?: string | null;   // hex like '#fafafa' or null to use default
};

export type SiteConfig = {
  sections: {
    hero:         SectionBase & { layout: HeroLayout; title: string | null; subtitle: string; cta_label: string; cta_href: string; image_url: string | null; gallery_urls?: string[] };
    trusted_by:   SectionBase & { title: string; items: LogoItem[]; grayscale: boolean };
    about:        SectionBase & { title: string; body: string; image_url: string | null };
    instructor:   SectionBase & { title: string; name: string; bio: string; photo_url: string | null; credentials: string };
    stats:        SectionBase & { title: string; items: StatItem[] };
    learn_points: SectionBase & { title: string; subtitle: string; items: LearnItem[] };
    features:     SectionBase & { title: string; items: FeatureItem[] };
    featured:     SectionBase & { title: string };
    catalog:      SectionBase & { title: string; show_filters: boolean };
    testimonials: SectionBase & { title: string; items: TestimonialItem[] };
    before_after: SectionBase & { title: string; before_label: string; after_label: string; before_image_url: string | null; after_image_url: string | null; before_body: string; after_body: string };
    faq:          SectionBase & { title: string; items: FaqItem[] };
    offer:        SectionBase & { title: string; subtitle: string; ends_at: string | null; cta_label: string; cta_href: string };
    newsletter:   SectionBase & { title: string; subtitle: string; cta_label: string };
    cta_final:    SectionBase & { title: string; body: string; cta_label: string; cta_href: string };
  };
  order: SectionKey[];
  nav: { links: NavLink[]; show_login: boolean };
  footer: { text: string; socials: SocialLink[]; links: NavLink[] };
};

export const DEFAULT_ORDER: SectionKey[] = [
  'hero', 'trusted_by', 'about', 'instructor', 'stats', 'learn_points',
  'features', 'featured', 'catalog', 'testimonials', 'before_after', 'faq',
  'offer', 'newsletter', 'cta_final'
];

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  sections: {
    hero:         { enabled: true,  layout: 'centered', title: null, subtitle: 'Aprendé con nosotros.', cta_label: 'Ver cursos', cta_href: '#cursos', image_url: null },
    trusted_by:   { enabled: false, title: 'Confían en nosotros', items: [], grayscale: true },
    about:        { enabled: false, title: 'Sobre nosotros', body: '', image_url: null },
    instructor:   { enabled: false, title: 'Tu instructor', name: '', bio: '', photo_url: null, credentials: '' },
    stats:        { enabled: false, title: 'En números', items: [] },
    learn_points: { enabled: false, title: 'Qué vas a aprender', subtitle: '', items: [] },
    features:     { enabled: false, title: 'Por qué elegirnos', items: [] },
    featured:     { enabled: true,  title: 'Cursos destacados' },
    catalog:      { enabled: true,  title: 'Todos los cursos', show_filters: true },
    testimonials: { enabled: false, title: 'Lo que dicen nuestros alumnos', items: [] },
    before_after: { enabled: false, title: 'Antes vs después', before_label: 'Antes', after_label: 'Después', before_image_url: null, after_image_url: null, before_body: '', after_body: '' },
    faq:          { enabled: false, title: 'Preguntas frecuentes', items: [] },
    offer:        { enabled: false, title: 'Oferta por tiempo limitado', subtitle: 'Inscribite antes que termine.', ends_at: null, cta_label: 'Aprovecharla', cta_href: '#cursos' },
    newsletter:   { enabled: false, title: 'Sumate al newsletter', subtitle: 'Recibí nuestros mejores tips y novedades.', cta_label: 'Suscribirme' },
    cta_final:    { enabled: false, title: '¿Listo para empezar?', body: '', cta_label: 'Quiero inscribirme', cta_href: '#cursos' }
  },
  order: DEFAULT_ORDER,
  nav: { links: [], show_login: true },
  footer: { text: '', socials: [], links: [] }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mergeConfig(stored: any): SiteConfig {
  const base = JSON.parse(JSON.stringify(DEFAULT_SITE_CONFIG)) as SiteConfig;
  if (!stored || typeof stored !== 'object') return base;

  if (stored.sections && typeof stored.sections === 'object') {
    for (const key of Object.keys(base.sections) as SectionKey[]) {
      const s = stored.sections[key];
      if (s && typeof s === 'object') {
        base.sections[key] = { ...base.sections[key], ...s } as never;
      }
    }
  }
  if (Array.isArray(stored.order) && stored.order.length > 0) {
    const stored_order = stored.order.filter((k: string) => k in base.sections) as SectionKey[];
    const missing = DEFAULT_ORDER.filter((k) => !stored_order.includes(k));
    base.order = [...stored_order, ...missing];
  }
  if (stored.nav && typeof stored.nav === 'object') {
    base.nav = { ...base.nav, ...stored.nav };
    if (!Array.isArray(base.nav.links)) base.nav.links = [];
  }
  if (stored.footer && typeof stored.footer === 'object') {
    base.footer = { ...base.footer, ...stored.footer };
    if (!Array.isArray(base.footer.socials)) base.footer.socials = [];
    if (!Array.isArray(base.footer.links)) base.footer.links = [];
  }
  return base;
}
