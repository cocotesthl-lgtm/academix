/**
 * Datos de muestra por template — se usan en /preview/[id] para renderizar
 * un sitio realista y navegable de cada vertical. Todas las imágenes son
 * URLs de Unsplash (source libre para uso).
 */

export type DemoItem = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  price?: string;
  category?: string;
  image: string;
  meta?: string; // fecha, duración, etc.
};

export type DemoContent = {
  items: DemoItem[];
  itemsLabel: string;         // "Últimas notas", "Menú", "Cursos", etc.
  itemsSubtitle?: string;
  categories?: string[];       // para filtros/tabs
  ctaLabel: string;            // "Leer nota", "Reservar mesa", "Comprar", etc.
  showsPrices: boolean;
  layout: 'grid-3' | 'grid-4' | 'list' | 'menu';
};

const UNSPLASH = 'https://images.unsplash.com/photo-';

export const DEMO_CONTENT: Record<string, DemoContent> = {
  news: {
    itemsLabel: 'Últimas notas',
    itemsSubtitle: 'Lo más reciente de nuestra redacción.',
    categories: ['Todas', 'Política', 'Economía', 'Cultura', 'Deportes'],
    ctaLabel: 'Leer nota',
    showsPrices: false,
    layout: 'grid-3',
    items: [
      {
        id: 'n1',
        title: 'Se aprobó la reforma en el Concejo tras 8 horas de debate',
        subtitle: 'Política',
        description: 'La sesión terminó pasada la medianoche con votación dividida. Los detalles de qué cambia a partir del lunes.',
        image: `${UNSPLASH}1541872703-74c5e44368f9?w=600&auto=format&fit=crop&q=80`,
        meta: 'Hace 2 horas · Redacción'
      },
      {
        id: 'n2',
        title: 'Inflación de julio: qué pasó con la canasta básica en el partido',
        subtitle: 'Economía',
        description: 'Un relevamiento en 12 supermercados y almacenes revela dónde se sintió más el aumento.',
        image: `${UNSPLASH}1554224155-6726b3ff858f?w=600&auto=format&fit=crop&q=80`,
        meta: 'Hace 5 horas · M. Rodríguez'
      },
      {
        id: 'n3',
        title: 'El festival de tango vuelve al centro este fin de semana',
        subtitle: 'Cultura',
        description: 'Más de 40 orquestas en 3 escenarios. Programa completo y cómo llegar.',
        image: `${UNSPLASH}1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80`,
        meta: 'Hace 8 horas · L. Vera'
      },
      {
        id: 'n4',
        title: 'Fecha del clásico local: día, hora y árbitro designado',
        subtitle: 'Deportes',
        description: 'La Liga confirmó los detalles del partido más esperado de la temporada.',
        image: `${UNSPLASH}1508098682722-e99c43a406b2?w=600&auto=format&fit=crop&q=80`,
        meta: 'Hace 12 horas · Deportes'
      },
      {
        id: 'n5',
        title: 'Obras en la Ruta 8: cortes hasta el viernes por reparación',
        subtitle: 'Política',
        description: 'Vialidad recomendó vías alternativas. El cronograma completo día por día.',
        image: `${UNSPLASH}1449824913935-59a10b8d2000?w=600&auto=format&fit=crop&q=80`,
        meta: 'Ayer · P. Suárez'
      },
      {
        id: 'n6',
        title: 'Entrevista al intendente: "El presupuesto 2027 prioriza salud"',
        subtitle: 'Política',
        description: '45 minutos mano a mano. Qué proyectos siguen y cuáles se dan de baja.',
        image: `${UNSPLASH}1541872705-1f73c6400ec9?w=600&auto=format&fit=crop&q=80`,
        meta: 'Ayer · Editorial'
      }
    ]
  },

  restaurant: {
    itemsLabel: 'Nuestra carta',
    itemsSubtitle: 'Cocina de estación con ingredientes locales.',
    categories: ['Todo', 'Entradas', 'Principales', 'Pastas', 'Postres', 'Vinos'],
    ctaLabel: 'Reservar mesa',
    showsPrices: true,
    layout: 'menu',
    items: [
      { id: 'r1', title: 'Provoleta a la parrilla', category: 'Entradas', description: 'Queso ahumado con romero, orégano y aceite de oliva.', price: '$ 6.500', image: `${UNSPLASH}1568901346375-23c9450c58cd?w=400&auto=format&fit=crop&q=80` },
      { id: 'r2', title: 'Empanadas de la casa · Doc', category: 'Entradas', description: 'Salteñas de carne cortada a cuchillo. Masa hecha en casa.', price: '$ 4.800', image: `${UNSPLASH}1601926378770-e6c2c31b71d5?w=400&auto=format&fit=crop&q=80` },
      { id: 'r3', title: 'Bife de chorizo · 400g', category: 'Principales', description: 'A la parrilla con guarnición de papas rústicas y chimichurri.', price: '$ 18.900', image: `${UNSPLASH}1544025162-d76694265947?w=400&auto=format&fit=crop&q=80` },
      { id: 'r4', title: 'Salmón grillado', category: 'Principales', description: 'Con puré de coliflor y vegetales de estación al vapor.', price: '$ 16.500', image: `${UNSPLASH}1467003909585-2f8a72700288?w=400&auto=format&fit=crop&q=80` },
      { id: 'r5', title: 'Ravioles de calabaza', category: 'Pastas', description: 'Rellenos con calabaza asada, ricotta y nuez. Salsa de manteca y salvia.', price: '$ 12.400', image: `${UNSPLASH}1621996346565-e3dbc353d2e5?w=400&auto=format&fit=crop&q=80` },
      { id: 'r6', title: 'Sorrentinos de jamón crudo', category: 'Pastas', description: 'Con mozzarella y albahaca. Salsa fileto o crema de champignones.', price: '$ 11.800', image: `${UNSPLASH}1621996659490-3275b4d0d951?w=400&auto=format&fit=crop&q=80` },
      { id: 'r7', title: 'Volcán de chocolate', category: 'Postres', description: 'Con helado de crema americana. Servido tibio.', price: '$ 7.200', image: `${UNSPLASH}1541599540903-216a46ca1dc0?w=400&auto=format&fit=crop&q=80` },
      { id: 'r8', title: 'Malbec de bodega familiar', category: 'Vinos', description: 'Copa · Mendoza · 100% Malbec añejado en roble francés.', price: '$ 5.400', image: `${UNSPLASH}1553361371-9b22f78e8b1d?w=400&auto=format&fit=crop&q=80` }
    ]
  },

  academy: {
    itemsLabel: 'Nuestros cursos',
    itemsSubtitle: 'Programas completos con acceso permanente.',
    categories: ['Todos', 'Principiantes', 'Intermedios', 'Avanzados'],
    ctaLabel: 'Ver programa',
    showsPrices: true,
    layout: 'grid-3',
    items: [
      { id: 'c1', title: 'Inglés desde cero · A1 → B1', description: '48 clases + material descargable + comunidad. Certificado incluido.', price: '$ 24.900', meta: '48 clases · 3 meses', image: `${UNSPLASH}1546410531-bb4caa6b424d?w=600&auto=format&fit=crop&q=80`, category: 'Principiantes' },
      { id: 'c2', title: 'Marketing digital para PyMEs', description: 'Meta Ads, Google Ads, TikTok, WhatsApp Business. Casos reales.', price: '$ 34.900', meta: '32 clases · 2 meses', image: `${UNSPLASH}1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80`, category: 'Intermedios' },
      { id: 'c3', title: 'Excel avanzado + Power BI', description: 'Tablas dinámicas, macros, dashboards profesionales. Todos los niveles.', price: '$ 19.900', meta: '24 clases · 6 semanas', image: `${UNSPLASH}1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80`, category: 'Intermedios' },
      { id: 'c4', title: 'Diseño UX/UI con Figma', description: 'De cero a portfolio en 3 meses. Con proyecto final revisado 1-a-1.', price: '$ 49.900', meta: '40 clases · 3 meses', image: `${UNSPLASH}1587440871875-191322ee64b0?w=600&auto=format&fit=crop&q=80`, category: 'Avanzados' },
      { id: 'c5', title: 'Programación con Python', description: 'De cero a apps con IA. Sin experiencia previa. Comunidad activa.', price: '$ 39.900', meta: '36 clases · 3 meses', image: `${UNSPLASH}1526379095098-d400fd0bf935?w=600&auto=format&fit=crop&q=80`, category: 'Principiantes' },
      { id: 'c6', title: 'Trading para principiantes', description: 'Análisis técnico + gestión de riesgo. Sin promesas mágicas.', price: '$ 29.900', meta: '20 clases · 5 semanas', image: `${UNSPLASH}1611974789855-9c2a0a7236a3?w=600&auto=format&fit=crop&q=80`, category: 'Intermedios' }
    ]
  },

  ecommerce: {
    itemsLabel: 'Productos',
    itemsSubtitle: 'Envío a todo el país. Devolución gratis 15 días.',
    categories: ['Todos', 'Remeras', 'Buzos', 'Pantalones', 'Accesorios'],
    ctaLabel: 'Ver producto',
    showsPrices: true,
    layout: 'grid-4',
    items: [
      { id: 'p1', title: 'Remera clásica oversized', category: 'Remeras', price: '$ 14.900', description: 'Algodón peinado 220gr · Talles S-XL · 5 colores.', image: `${UNSPLASH}1521572163474-6864f9cf17ab?w=400&auto=format&fit=crop&q=80` },
      { id: 'p2', title: 'Buzo canguro con estampa', category: 'Buzos', price: '$ 29.900', description: 'Frisa premium · Interior polar · Ilustración exclusiva.', image: `${UNSPLASH}1556821840-3a63f95609a7?w=400&auto=format&fit=crop&q=80` },
      { id: 'p3', title: 'Jean tapered fit', category: 'Pantalones', price: '$ 32.500', description: 'Denim 12oz · Corte ajustado en tobillo · Bolsillos reforzados.', image: `${UNSPLASH}1542272604-787c3835535d?w=400&auto=format&fit=crop&q=80` },
      { id: 'p4', title: 'Gorra snapback', category: 'Accesorios', price: '$ 8.900', description: 'Visera plana · Ajuste regulable · Bordado 3D.', image: `${UNSPLASH}1588850561407-ed78c282e89b?w=400&auto=format&fit=crop&q=80` },
      { id: 'p5', title: 'Remera básica pack x3', category: 'Remeras', price: '$ 34.900', description: 'Blanco + Negro + Gris · Ahorro del 20% vs individual.', image: `${UNSPLASH}1503341504253-dff4815485f1?w=400&auto=format&fit=crop&q=80` },
      { id: 'p6', title: 'Buzo cerrado premium', category: 'Buzos', price: '$ 24.900', description: 'Sin capucha · Puños elastizados · Perfect fit.', image: `${UNSPLASH}1620799140408-edc6dcb6d633?w=400&auto=format&fit=crop&q=80` },
      { id: 'p7', title: 'Pantalón cargo urbano', category: 'Pantalones', price: '$ 28.900', description: 'Bolsillos laterales · Cordón ajustable · Ideal día a día.', image: `${UNSPLASH}1584467541268-b040f83be3fd?w=400&auto=format&fit=crop&q=80` },
      { id: 'p8', title: 'Riñonera crossbody', category: 'Accesorios', price: '$ 11.900', description: 'Cuero sintético premium · 3 compartimentos · Correa ajustable.', image: `${UNSPLASH}1553062407-98eeb64c6a62?w=400&auto=format&fit=crop&q=80` }
    ]
  },

  professional: {
    itemsLabel: 'Áreas de práctica',
    itemsSubtitle: 'Especialistas con más de 10 años de experiencia.',
    ctaLabel: 'Consultar',
    showsPrices: false,
    layout: 'grid-3',
    items: [
      { id: 's1', title: 'Derecho Civil', description: 'Divorcios, sucesiones, contratos, daños y perjuicios. Asesoramiento integral.', image: `${UNSPLASH}1589829545856-d10d557cf95f?w=600&auto=format&fit=crop&q=80` },
      { id: 's2', title: 'Derecho Comercial', description: 'Constitución de sociedades, contratos comerciales, marcas y patentes.', image: `${UNSPLASH}1450101499163-c8848c66ca85?w=600&auto=format&fit=crop&q=80` },
      { id: 's3', title: 'Derecho Laboral', description: 'Despidos, indemnizaciones, accidentes de trabajo, negociación colectiva.', image: `${UNSPLASH}1521791136064-7986c2920216?w=600&auto=format&fit=crop&q=80` },
      { id: 's4', title: 'Derecho de Familia', description: 'Alimentos, tenencia, régimen de visitas, adopción. Con enfoque humano.', image: `${UNSPLASH}1511895426328-dc8714191300?w=600&auto=format&fit=crop&q=80` },
      { id: 's5', title: 'Derecho Penal', description: 'Defensa y querellas. Asesoramiento integral desde la primera declaración.', image: `${UNSPLASH}1521587760476-6c12a4b040da?w=600&auto=format&fit=crop&q=80` },
      { id: 's6', title: 'Sucesiones', description: 'Iniciar el trámite, división de bienes, testamentos. Acompañamos todo el proceso.', image: `${UNSPLASH}1505664194779-8beaceb93744?w=600&auto=format&fit=crop&q=80` }
    ]
  },

  multivenue: {
    itemsLabel: 'Nuestras sedes',
    itemsSubtitle: 'Elegí la más cercana y reservá.',
    ctaLabel: 'Reservar en esta sede',
    showsPrices: true,
    layout: 'grid-3',
    items: [
      { id: 'v1', title: 'Sede Centro', description: 'Corrientes 1234, CABA · Abierto Lun-Dom 10 a 22hs.', price: 'Desde $ 8.000', meta: '3 canchas · Estacionamiento gratis', image: `${UNSPLASH}1519671482749-fd09be7ccebf?w=600&auto=format&fit=crop&q=80` },
      { id: 'v2', title: 'Sede Norte', description: 'Av. Libertador 5678, Vicente López · Lun-Dom 9 a 23hs.', price: 'Desde $ 8.500', meta: '5 canchas · Bar-parrilla en el lugar', image: `${UNSPLASH}1552083375-1447ce886485?w=600&auto=format&fit=crop&q=80` },
      { id: 'v3', title: 'Sede Sur', description: 'Av. Hipólito Yrigoyen 9012, Lomas · Lun-Vie 14 a 23hs · Sáb-Dom 10 a 22hs.', price: 'Desde $ 7.500', meta: '4 canchas · Vestuario premium', image: `${UNSPLASH}1521412644187-c49fa049e84d?w=600&auto=format&fit=crop&q=80` }
    ]
  },

  beauty: {
    itemsLabel: 'Servicios',
    itemsSubtitle: 'Reservá tu turno online en 30 segundos.',
    categories: ['Todos', 'Cabello', 'Uñas', 'Facial', 'Depilación'],
    ctaLabel: 'Sacar turno',
    showsPrices: true,
    layout: 'list',
    items: [
      { id: 'b1', title: 'Corte + Brushing', category: 'Cabello', description: 'Corte personalizado + hidratación + peinado. 60min.', price: '$ 12.900', image: `${UNSPLASH}1560066984-138dadb4c035?w=400&auto=format&fit=crop&q=80` },
      { id: 'b2', title: 'Coloración + Balayage', category: 'Cabello', description: 'Técnica francesa · Trabajamos con productos veganos. 3hs.', price: '$ 45.000', image: `${UNSPLASH}1522337360788-8b13dee7a37e?w=400&auto=format&fit=crop&q=80` },
      { id: 'b3', title: 'Manicura + gel semipermanente', category: 'Uñas', description: 'Retiro anterior incluido · Dura hasta 3 semanas. 45min.', price: '$ 8.500', image: `${UNSPLASH}1604654894610-df63bc536371?w=400&auto=format&fit=crop&q=80` },
      { id: 'b4', title: 'Nail art personalizado', category: 'Uñas', description: 'Diseños de temporada · Traé tu inspiración. 90min.', price: '$ 14.900', image: `${UNSPLASH}1607779097040-26e80aa78e66?w=400&auto=format&fit=crop&q=80` },
      { id: 'b5', title: 'Limpieza facial profunda', category: 'Facial', description: 'Vapor + extracción + mascarilla + hidratante. Piel radiante. 75min.', price: '$ 18.900', image: `${UNSPLASH}1570172619644-dfd03ed5d881?w=400&auto=format&fit=crop&q=80` },
      { id: 'b6', title: 'Depilación piernas completas', category: 'Depilación', description: 'Cera tibia natural · Post-tratamiento incluido. 45min.', price: '$ 9.500', image: `${UNSPLASH}1600334129128-685c5582fd35?w=400&auto=format&fit=crop&q=80` }
    ]
  },

  gym: {
    itemsLabel: 'Nuestros planes',
    itemsSubtitle: 'Sin cuotas ocultas. Bajás cuando quieras.',
    ctaLabel: 'Empezar prueba gratis',
    showsPrices: true,
    layout: 'grid-3',
    items: [
      { id: 'g1', title: 'Plan Mensual', price: '$ 22.900 /mes', description: 'Acceso ilimitado a la sala + clases grupales + evaluación inicial. Cancela cuando quieras.', meta: 'Más popular', image: `${UNSPLASH}1571019613454-1cb2f99b2d8b?w=600&auto=format&fit=crop&q=80` },
      { id: 'g2', title: 'Plan Trimestral', price: '$ 59.900 /3 meses', description: 'Todo lo del mensual + 4 sesiones de PT + plan nutricional personalizado. Ahorrás 15%.', image: `${UNSPLASH}1534438327276-14e5300c3a48?w=600&auto=format&fit=crop&q=80` },
      { id: 'g3', title: 'Plan Anual', price: '$ 199.900 /año', description: 'Acceso total + PT ilimitado + nutricionista + acceso a spa. Ahorrás 27% vs mensual.', meta: 'Mejor precio', image: `${UNSPLASH}1517836357463-d25dfeac3438?w=600&auto=format&fit=crop&q=80` }
    ]
  },

  creator: {
    itemsLabel: 'Trabajos seleccionados',
    itemsSubtitle: 'Un vistazo a proyectos recientes.',
    categories: ['Todo', 'Editorial', 'Producto', 'Retrato', 'Eventos'],
    ctaLabel: 'Ver proyecto',
    showsPrices: false,
    layout: 'grid-3',
    items: [
      { id: 'w1', title: 'Campaña editorial VOGUE LatAm', subtitle: 'Editorial', description: '2026 · Locación: Cabo Polonio, Uruguay.', image: `${UNSPLASH}1483985988355-763728e1935b?w=600&auto=format&fit=crop&q=80` },
      { id: 'w2', title: 'Lookbook otoño-invierno', subtitle: 'Producto', description: '2026 · Cliente: Marca privada.', image: `${UNSPLASH}1490114538077-0a7f8cb49891?w=600&auto=format&fit=crop&q=80` },
      { id: 'w3', title: 'Sesión de retratos autoral', subtitle: 'Retrato', description: '2025 · Proyecto personal.', image: `${UNSPLASH}1494790108377-be9c29b29330?w=600&auto=format&fit=crop&q=80` },
      { id: 'w4', title: 'Casamiento en Punta del Este', subtitle: 'Eventos', description: '2025 · Evento privado.', image: `${UNSPLASH}1519741497674-611481863552?w=600&auto=format&fit=crop&q=80` },
      { id: 'w5', title: 'Editorial gastronómica Nat Geo', subtitle: 'Editorial', description: '2025 · Cliente: revista internacional.', image: `${UNSPLASH}1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80` },
      { id: 'w6', title: 'Campaña relojería suiza', subtitle: 'Producto', description: '2024 · Cliente confidencial.', image: `${UNSPLASH}1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80` }
    ]
  }
};

/** Mapping templateId → key en DEMO_CONTENT. */
export function contentKey(templateId: string): keyof typeof DEMO_CONTENT | null {
  const map: Record<string, keyof typeof DEMO_CONTENT> = {
    news: 'news',
    restaurant: 'restaurant',
    academy: 'academy',
    ecommerce: 'ecommerce',
    professional: 'professional',
    experience: 'multivenue',
    beauty: 'beauty',
    gym: 'gym',
    creator: 'creator'
  };
  return map[templateId] ?? null;
}
