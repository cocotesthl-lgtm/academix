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

export type SectionKey = 'hero' | 'about' | 'featured' | 'catalog' | 'testimonials' | 'faq' | 'cta_final';

export type SiteConfig = {
  sections: {
    hero: { enabled: boolean; title: string | null; subtitle: string; cta_label: string; cta_href: string };
    about: { enabled: boolean; title: string; body: string; image_url: string | null };
    featured: { enabled: boolean; title: string };
    catalog: { enabled: boolean; title: string; show_filters: boolean };
    testimonials: { enabled: boolean; title: string; items: TestimonialItem[] };
    faq: { enabled: boolean; title: string; items: FaqItem[] };
    cta_final: { enabled: boolean; title: string; body: string; cta_label: string; cta_href: string };
  };
  order: SectionKey[];
};

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  sections: {
    hero: { enabled: true, title: null, subtitle: 'Aprendé con nosotros.', cta_label: 'Ver cursos', cta_href: '#cursos' },
    about: { enabled: false, title: 'Sobre nosotros', body: '', image_url: null },
    featured: { enabled: true, title: 'Cursos destacados' },
    catalog: { enabled: true, title: 'Todos los cursos', show_filters: true },
    testimonials: { enabled: false, title: 'Lo que dicen nuestros alumnos', items: [] },
    faq: { enabled: false, title: 'Preguntas frecuentes', items: [] },
    cta_final: { enabled: false, title: '¿Listo para empezar?', body: '', cta_label: 'Quiero inscribirme', cta_href: '#cursos' }
  },
  order: ['hero', 'about', 'featured', 'catalog', 'testimonials', 'faq', 'cta_final']
};
