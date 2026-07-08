import { getServiceClient } from '@/lib/supabase/service';

/**
 * Siembra categorías + productos físicos "listos para editar" cuando se
 * aplica el template ecommerce. La idea:
 *  · El owner aplica el template
 *  · Le aparecen 6 categorías y 12 productos ya cargados en /owner/products
 *  · Solo tiene que cambiar títulos, precios y fotos — no arrancar de cero
 *
 * Idempotente: si el tenant YA tiene productos o categorías, no toca nada
 * (así evitamos duplicar al re-aplicar el template).
 */

type SeedCategory = { slug: string; name: string; is_featured?: boolean };
type SeedProduct = {
  slug: string;
  title: string;
  description: string;
  cover_url: string;
  gallery: string[];
  price_cents: number;
  compare_at_price_cents: number | null;
  stock_qty: number;
  category_slug: string;   // referencia por slug, se resuelve al insertar
};

const CATEGORIES: SeedCategory[] = [
  { slug: 'ropa-hombre', name: 'Ropa hombre', is_featured: true },
  { slug: 'ropa-mujer', name: 'Ropa mujer', is_featured: true },
  { slug: 'tecnologia', name: 'Tecnología', is_featured: true },
  { slug: 'calzado', name: 'Calzado', is_featured: true },
  { slug: 'accesorios', name: 'Accesorios', is_featured: true },
  { slug: 'ofertas', name: 'Ofertas', is_featured: true }
];

const PRODUCTS: SeedProduct[] = [
  {
    slug: 'zapatillas-urbanas-premium',
    title: 'Zapatillas urbanas premium — nueva temporada',
    description: 'Zapatillas de diseño urbano con suela ultraliviana y plantilla acolchada. Ideales para uso diario, resistentes y con excelente terminación. Disponibles en múltiples talles.',
    cover_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&auto=format&fit=crop&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1200&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=1200&auto=format&fit=crop&q=80'
    ],
    price_cents: 4599900,
    compare_at_price_cents: 6999900,
    stock_qty: 12,
    category_slug: 'calzado'
  },
  {
    slug: 'auriculares-inalambricos-noise-cancelling',
    title: 'Auriculares inalámbricos con cancelación activa de ruido',
    description: 'Sonido premium, cancelación activa de ruido, hasta 30hs de batería. Bluetooth 5.3, estuche de carga incluido. Perfectos para trabajo o viajes.',
    cover_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&auto=format&fit=crop&q=80',
    gallery: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&auto=format&fit=crop&q=80'],
    price_cents: 8999900,
    compare_at_price_cents: 12999900,
    stock_qty: 8,
    category_slug: 'tecnologia'
  },
  {
    slug: 'reloj-deportivo-digital',
    title: 'Reloj deportivo digital resistente al agua',
    description: 'Monitor de ritmo cardíaco, GPS, resistente al agua hasta 50m. Notificaciones inteligentes y más de 20 modos deportivos.',
    cover_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&auto=format&fit=crop&q=80',
    gallery: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200&auto=format&fit=crop&q=80'],
    price_cents: 3200000,
    compare_at_price_cents: null,
    stock_qty: 20,
    category_slug: 'tecnologia'
  },
  {
    slug: 'camara-instantanea-vintage',
    title: 'Cámara instantánea vintage · Edición limitada',
    description: 'Diseño retro, film instantáneo, flash automático. Ideal para fiestas, viajes y capturar momentos únicos con impresión al toque.',
    cover_url: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=1200&auto=format&fit=crop&q=80',
    gallery: ['https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=1200&auto=format&fit=crop&q=80'],
    price_cents: 5499900,
    compare_at_price_cents: 6999900,
    stock_qty: 5,
    category_slug: 'tecnologia'
  },
  {
    slug: 'mochila-urbana-impermeable',
    title: 'Mochila urbana impermeable para notebook',
    description: 'Compartimento acolchado para notebook hasta 15,6", puerto USB externo, material impermeable. Diseño minimalista y funcional.',
    cover_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&auto=format&fit=crop&q=80',
    gallery: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&auto=format&fit=crop&q=80'],
    price_cents: 2799900,
    compare_at_price_cents: 3899900,
    stock_qty: 15,
    category_slug: 'accesorios'
  },
  {
    slug: 'lentes-de-sol-aviator',
    title: 'Lentes de sol polarizados aviator',
    description: 'Marco metálico, cristales polarizados con protección UV400. Estuche rígido y paño de limpieza incluidos.',
    cover_url: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=1200&auto=format&fit=crop&q=80',
    gallery: ['https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=1200&auto=format&fit=crop&q=80'],
    price_cents: 1899900,
    compare_at_price_cents: null,
    stock_qty: 30,
    category_slug: 'accesorios'
  },
  {
    slug: 'smartphone-gama-alta',
    title: 'Smartphone gama alta 256GB · Cámara 108MP',
    description: 'Pantalla AMOLED 6.7", 256GB de almacenamiento, cámara principal de 108MP con estabilización óptica. Carga rápida 65W.',
    cover_url: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=1200&auto=format&fit=crop&q=80',
    gallery: ['https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=1200&auto=format&fit=crop&q=80'],
    price_cents: 24999900,
    compare_at_price_cents: 32999900,
    stock_qty: 6,
    category_slug: 'tecnologia'
  },
  {
    slug: 'sneakers-running-ultralivianas',
    title: 'Sneakers running técnicas ultralivianas',
    description: 'Suela con retorno de energía, upper de malla transpirable. Ideal para running de asfalto y entrenamientos exigentes.',
    cover_url: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=1200&auto=format&fit=crop&q=80',
    gallery: ['https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=1200&auto=format&fit=crop&q=80'],
    price_cents: 6299900,
    compare_at_price_cents: 8499900,
    stock_qty: 10,
    category_slug: 'calzado'
  },
  {
    slug: 'perfume-eau-de-parfum-100ml',
    title: 'Perfume Eau de Parfum 100ml · Notas amaderadas',
    description: 'Fragancia amaderada con notas de cedro, sándalo y bergamota. Duración prolongada, ideal para uso diario o de noche.',
    cover_url: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=1200&auto=format&fit=crop&q=80',
    gallery: ['https://images.unsplash.com/photo-1541643600914-78b084683601?w=1200&auto=format&fit=crop&q=80'],
    price_cents: 3999900,
    compare_at_price_cents: 5299900,
    stock_qty: 18,
    category_slug: 'accesorios'
  },
  {
    slug: 'cafetera-espresso-automatica',
    title: 'Cafetera espresso automática con molinillo integrado',
    description: 'Molinillo cerámico integrado, 15 bares de presión, espumador de leche. Prepará café de especialidad en tu casa.',
    cover_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&auto=format&fit=crop&q=80',
    gallery: ['https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&auto=format&fit=crop&q=80'],
    price_cents: 15999900,
    compare_at_price_cents: 19999900,
    stock_qty: 4,
    category_slug: 'tecnologia'
  },
  {
    slug: 'notebook-14-ultraliviana',
    title: 'Notebook 14" ultraliviana · 16GB RAM · SSD 512GB',
    description: 'Procesador de última generación, 16GB de RAM, SSD 512GB NVMe. Batería de 12hs, teclado retroiluminado, menos de 1,4 kg.',
    cover_url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=1200&auto=format&fit=crop&q=80',
    gallery: ['https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=1200&auto=format&fit=crop&q=80'],
    price_cents: 78999900,
    compare_at_price_cents: 94999900,
    stock_qty: 3,
    category_slug: 'tecnologia'
  },
  {
    slug: 'buzo-hoodie-oversize',
    title: 'Buzo hoodie oversize algodón premium',
    description: 'Algodón premium 320gr, corte oversize, capucha con cordón ajustable, bolsillo canguro. Disponible en múltiples colores.',
    cover_url: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=1200&auto=format&fit=crop&q=80',
    gallery: ['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=1200&auto=format&fit=crop&q=80'],
    price_cents: 2499900,
    compare_at_price_cents: 3299900,
    stock_qty: 22,
    category_slug: 'ropa-hombre'
  }
];

export async function seedEcommerceDemoData(tenantId: string): Promise<void> {
  const svc = getServiceClient();

  // Bail out si ya tiene productos O categorías. Idempotente: si el owner
  // re-aplica el template, no le duplicamos ni sobrescribimos su data.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: prodCount } = await (svc.from('physical_products') as any)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  if ((prodCount ?? 0) > 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: catCount } = await (svc.from('course_categories') as any)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  // Insertar categorías (solo si no tenía) y armar map slug → id
  const categoryIdBySlug: Record<string, string> = {};
  if ((catCount ?? 0) === 0) {
    const rows = CATEGORIES.map((c, i) => ({
      tenant_id: tenantId,
      slug: c.slug,
      name: c.name,
      position: i,
      is_featured: c.is_featured ?? false
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error } = await (svc.from('course_categories') as any)
      .insert(rows).select('id, slug');
    if (error) throw error;
    for (const r of (inserted ?? []) as Array<{ id: string; slug: string }>) {
      categoryIdBySlug[r.slug] = r.id;
    }
  } else {
    // Ya había categorías: usamos las existentes que matcheen por slug (o
    // dejamos category_id en null si no matchea ninguna).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (svc.from('course_categories') as any)
      .select('id, slug').eq('tenant_id', tenantId);
    for (const r of (existing ?? []) as Array<{ id: string; slug: string }>) {
      categoryIdBySlug[r.slug] = r.id;
    }
  }

  // Insertar productos
  const productRows = PRODUCTS.map((p) => ({
    tenant_id: tenantId,
    slug: p.slug,
    title: p.title,
    description: p.description,
    cover_url: p.cover_url,
    gallery: p.gallery,
    price_cents: p.price_cents,
    compare_at_price_cents: p.compare_at_price_cents,
    currency: 'ARS',
    stock_qty: p.stock_qty,
    track_stock: true,
    requires_shipping: true,
    status: 'published',
    category_id: categoryIdBySlug[p.category_slug] ?? null
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: prodErr } = await (svc.from('physical_products') as any).insert(productRows);
  if (prodErr) throw prodErr;
}
