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

/**
 * Categorías con jerarquía. `parent_slug` referencia una root para armar
 * el mega-menú tipo MercadoLibre. Sin parent_slug = root (aparece en la
 * columna izquierda del mega-menú si is_featured=true).
 */
type SeedCategoryHier = SeedCategory & { parent_slug?: string };

const CATEGORIES: SeedCategoryHier[] = [
  // Roots (aparecen en el sidebar del mega-menú)
  { slug: 'tecnologia', name: 'Tecnología', is_featured: true },
  { slug: 'ropa-hombre', name: 'Ropa hombre', is_featured: true },
  { slug: 'ropa-mujer', name: 'Ropa mujer', is_featured: true },
  { slug: 'calzado', name: 'Calzado', is_featured: true },
  { slug: 'accesorios', name: 'Accesorios', is_featured: true },
  { slug: 'hogar-muebles', name: 'Hogar y Muebles', is_featured: true },
  { slug: 'deportes', name: 'Deportes y Fitness', is_featured: true },
  { slug: 'ofertas', name: 'Ofertas', is_featured: true },

  // Hijos de Tecnología (nivel 2 — aparecen a la derecha al hover)
  { slug: 'celulares', name: 'Celulares y Teléfonos', is_featured: false, parent_slug: 'tecnologia' },
  { slug: 'computacion', name: 'Computación', is_featured: false, parent_slug: 'tecnologia' },
  { slug: 'audio-video', name: 'Electrónica, Audio y Video', is_featured: false, parent_slug: 'tecnologia' },
  { slug: 'consolas', name: 'Consolas y Videojuegos', is_featured: false, parent_slug: 'tecnologia' },
  { slug: 'camaras', name: 'Cámaras y Accesorios', is_featured: false, parent_slug: 'tecnologia' },
  { slug: 'televisores', name: 'Televisores', is_featured: false, parent_slug: 'tecnologia' },

  // Hijos de Ropa hombre
  { slug: 'remeras-hombre', name: 'Remeras', is_featured: false, parent_slug: 'ropa-hombre' },
  { slug: 'buzos-hombre', name: 'Buzos y hoodies', is_featured: false, parent_slug: 'ropa-hombre' },
  { slug: 'pantalones-hombre', name: 'Pantalones y jeans', is_featured: false, parent_slug: 'ropa-hombre' },
  { slug: 'camisas', name: 'Camisas', is_featured: false, parent_slug: 'ropa-hombre' },

  // Hijos de Ropa mujer
  { slug: 'remeras-mujer', name: 'Remeras y tops', is_featured: false, parent_slug: 'ropa-mujer' },
  { slug: 'vestidos', name: 'Vestidos', is_featured: false, parent_slug: 'ropa-mujer' },
  { slug: 'jeans-mujer', name: 'Jeans y pantalones', is_featured: false, parent_slug: 'ropa-mujer' },

  // Hijos de Calzado
  { slug: 'zapatillas', name: 'Zapatillas urbanas', is_featured: false, parent_slug: 'calzado' },
  { slug: 'running', name: 'Running', is_featured: false, parent_slug: 'calzado' },
  { slug: 'botas', name: 'Botas', is_featured: false, parent_slug: 'calzado' },

  // Hijos de Accesorios
  { slug: 'mochilas', name: 'Mochilas y bolsos', is_featured: false, parent_slug: 'accesorios' },
  { slug: 'relojes', name: 'Relojes', is_featured: false, parent_slug: 'accesorios' },
  { slug: 'lentes', name: 'Lentes de sol', is_featured: false, parent_slug: 'accesorios' },
  { slug: 'perfumes', name: 'Perfumes', is_featured: false, parent_slug: 'accesorios' }
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
    // Paso 1: insertar SOLO roots (sin parent_slug) para tener sus IDs.
    // Paso 2: insertar hijos con parent_id resuelto por slug.
    // Esto respeta el FK parent_id → course_categories(id) de la migration 0054.
    // Si migration 0054 no corrió, reintentamos sin is_featured/parent_id.
    const roots = CATEGORIES.filter((c) => !c.parent_slug);
    const children = CATEGORIES.filter((c) => !!c.parent_slug);

    async function insertBatch(rows: Record<string, unknown>[]): Promise<Array<{ id: string; slug: string }>> {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (svc.from('course_categories') as any)
        .insert(rows).select('id, slug');
      if (error) {
        console.warn('[seedEcommerce] insert con cols nuevas falló, reintento básico:', error.message);
        const basic = rows.map((r) => ({
          tenant_id: r.tenant_id, slug: r.slug, name: r.name, position: r.position
        }));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const retry = await (svc.from('course_categories') as any).insert(basic).select('id, slug');
        if (retry.error) {
          console.error('[seedEcommerce] insert categorías falló definitivo:', retry.error);
          throw retry.error;
        }
        return (retry.data ?? []) as Array<{ id: string; slug: string }>;
      }
      return (data ?? []) as Array<{ id: string; slug: string }>;
    }

    const rootRows = roots.map((c, i) => ({
      tenant_id: tenantId, slug: c.slug, name: c.name, position: i,
      is_featured: c.is_featured ?? false
    }));
    const rootIds = await insertBatch(rootRows);
    for (const r of rootIds) categoryIdBySlug[r.slug] = r.id;

    if (children.length > 0) {
      const childRows = children.map((c, i) => ({
        tenant_id: tenantId, slug: c.slug, name: c.name, position: roots.length + i,
        is_featured: c.is_featured ?? false,
        parent_id: c.parent_slug ? categoryIdBySlug[c.parent_slug] : null
      }));
      const childIds = await insertBatch(childRows);
      for (const r of childIds) categoryIdBySlug[r.slug] = r.id;
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

  // Insertar productos. gallery es jsonb — supabase-js lo serializa solo.
  // Rating y reviews_count seeded a mano (variados 4.0-4.9) para dar prueba
  // social desde el día 1 estilo Amazon/ML.
  const productRows = PRODUCTS.map((p, i) => ({
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
    category_id: categoryIdBySlug[p.category_slug] ?? null,
    rating: [4.5, 4.3, 4.8, 4.2, 4.6, 4.1, 4.7, 4.4, 4.9, 4.5, 4.6, 4.3][i] ?? 4.5,
    reviews_count: [5592, 1284, 342, 89, 2103, 654, 891, 4210, 178, 45, 12, 2891][i] ?? 100
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { error: prodErr } = await (svc.from('physical_products') as any).insert(productRows);
  if (prodErr && /rating|reviews_count/.test(prodErr.message ?? '')) {
    // Migration 0058 pendiente — reintento sin las cols nuevas.
    const stripped = productRows.map((r) => {
      const clone: Record<string, unknown> = { ...r };
      delete clone.rating;
      delete clone.reviews_count;
      return clone;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const retry = await (svc.from('physical_products') as any).insert(stripped);
    prodErr = retry.error;
  }
  if (prodErr) {
    console.error('[seedEcommerce] insert productos falló:', prodErr);
    throw prodErr;
  }

  // Promo de muestra: 3x2 en toda la tienda + envío gratis desde $80k.
  // Sirve como plantilla para que el owner vea cómo se ve una promo activa.
  // Defensivo: si migration 0057 no corrió, catch silencioso.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('promotions') as any).insert([
      {
        tenant_id: tenantId,
        title: '3x2 en toda la tienda',
        description: 'El más barato queda gratis en cada trío. Editá o apagá desde /owner/promotions.',
        type: 'nx_pay_m',
        buy_qty: 3, pay_qty: 2,
        scope: 'all',
        target_ids: [],
        enabled: true,
        priority: 10
      },
      {
        tenant_id: tenantId,
        title: 'Envío gratis desde $80.000',
        description: 'Se aplica automáticamente al carrito.',
        type: 'min_amount_free_shipping',
        min_amount_cents: 8000000,
        scope: 'all',
        target_ids: [],
        enabled: true,
        priority: 5
      }
    ]);
  } catch (e) {
    console.warn('[seedEcommerce] promos skipped (migration 0057 pendiente?):', e);
  }

  console.log(`[seedEcommerce] OK tenant=${tenantId}: ${CATEGORIES.length} cats, ${productRows.length} productos`);
}
