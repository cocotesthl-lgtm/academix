export type TestimonialItem = {
  id: string;
  name: string;
  role?: string;
  photo_url?: string | null;
  text: string;
  rating?: number;
};

export type FaqItem = {
  id: string;
  q: string;
  a: string;
};

export type StatItem = {
  id: string;
  number: string;   // "+2.400", "98%", etc — free text
  label: string;    // "alumnos", "satisfacción"
};

export type NavLink = {
  id: string;
  label: string;
  href: string;        // /something, #anchor, https://...
};

export type SocialLink = {
  id: string;
  network: 'instagram' | 'youtube' | 'linkedin' | 'twitter' | 'tiktok' | 'facebook' | 'web';
  href: string;
};

export type SectionKey =
  | 'hero'
  | 'about'
  | 'instructor'
  | 'stats'
  | 'featured'
  | 'catalog'
  | 'testimonials'
  | 'faq'
  | 'newsletter'
  | 'cta_final';

export type SiteConfig = {
  sections: {
    hero:         { enabled: boolean; title: string | null; subtitle: string; cta_label: string; cta_href: string };
    about:        { enabled: boolean; title: string; body: string; image_url: string | null };
    instructor:   { enabled: boolean; title: string; name: string; bio: string; photo_url: string | null; credentials: string };
    stats:        { enabled: boolean; title: string; items: StatItem[] };
    featured:     { enabled: boolean; title: string };
    catalog:      { enabled: boolean; title: string; show_filters: boolean };
    testimonials: { enabled: boolean; title: string; items: TestimonialItem[] };
    faq:          { enabled: boolean; title: string; items: FaqItem[] };
    newsletter:   { enabled: boolean; title: string; subtitle: string; cta_label: string };
    cta_final:    { enabled: boolean; title: string; body: string; cta_label: string; cta_href: string };
  };
  order: SectionKey[];
  nav: {
    links: NavLink[];
    show_login: boolean;
  };
  footer: {
    text: string;
    socials: SocialLink[];
    links: NavLink[];
  };
};

export const DEFAULT_ORDER: SectionKey[] = [
  'hero', 'about', 'instructor', 'stats', 'featured', 'catalog', 'testimonials', 'faq', 'newsletter', 'cta_final'
];

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  sections: {
    hero:         { enabled: true,  title: null, subtitle: 'Aprendé con nosotros.', cta_label: 'Ver cursos', cta_href: '#cursos' },
    about:        { enabled: false, title: 'Sobre nosotros', body: '', image_url: null },
    instructor:   { enabled: false, title: 'Tu instructor', name: '', bio: '', photo_url: null, credentials: '' },
    stats:        { enabled: false, title: 'En números', items: [] },
    featured:     { enabled: true,  title: 'Cursos destacados' },
    catalog:      { enabled: true,  title: 'Todos los cursos', show_filters: true },
    testimonials: { enabled: false, title: 'Lo que dicen nuestros alumnos', items: [] },
    faq:          { enabled: false, title: 'Preguntas frecuentes', items: [] },
    newsletter:   { enabled: false, title: 'Sumate al newsletter', subtitle: 'Recibí nuestros mejores tips y novedades.', cta_label: 'Suscribirme' },
    cta_final:    { enabled: false, title: '¿Listo para empezar?', body: '', cta_label: 'Quiero inscribirme', cta_href: '#cursos' }
  },
  order: DEFAULT_ORDER,
  nav: {
    links: [],
    show_login: true
  },
  footer: {
    text: '',
    socials: [],
    links: []
  }
};

/**
 * Deep-merge a stored partial site_config with the defaults so that
 * tenants created before new sections existed don't crash when we
 * try to read those new keys.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mergeConfig(stored: any): SiteConfig {
  const base = JSON.parse(JSON.stringify(DEFAULT_SITE_CONFIG)) as SiteConfig;
  if (!stored || typeof stored !== 'object') return base;

  // sections
  if (stored.sections && typeof stored.sections === 'object') {
    for (const key of Object.keys(base.sections) as SectionKey[]) {
      const s = stored.sections[key];
      if (s && typeof s === 'object') {
        base.sections[key] = { ...base.sections[key], ...s } as never;
      }
    }
  }

  // order: keep stored order, append any missing sections at the end
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
