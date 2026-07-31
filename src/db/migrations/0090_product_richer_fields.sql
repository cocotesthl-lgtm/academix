-- 0090 · Productos físicos: condición + cuotas + reviews breakdown + variantes con axis label
--
-- Extensiones sobre la ficha de producto físico para acercarlo al estándar
-- de MercadoLibre / Amazon:
--   · condition            → 'new' | 'used' | null (no especificar)
--   · installments_max     → int, ej 12 para "12 cuotas"
--   · installments_interest_free → int, ej 6 para "hasta 6 cuotas sin interés"
--   · reviews_breakdown    → jsonb [c5, c4, c3, c2, c1] — cuentas por estrella
--   · qty_selector_enabled → boolean, muestra "cantidad ˅" en el buy box
--   · product_variants.option_key → text (ej 'color', 'talle', 'sabor')
--                                    permite crear variantes con axis custom.
--
-- Todos opcionales / defaults para no romper productos existentes.
-- También agrego los mismos campos al `demo_physical_products` para que
-- los templates iniciales muestren la ficha completa.

alter table public.physical_products
  add column if not exists condition text check (condition is null or condition in ('new', 'used')),
  add column if not exists installments_max int check (installments_max is null or installments_max between 1 and 60),
  add column if not exists installments_interest_free int check (installments_interest_free is null or installments_interest_free between 0 and 60),
  add column if not exists reviews_breakdown jsonb not null default '[]'::jsonb,
  add column if not exists qty_selector_enabled boolean not null default true;

alter table public.product_variants
  add column if not exists option_key text;

alter table public.demo_physical_products
  add column if not exists condition text,
  add column if not exists installments_max int,
  add column if not exists installments_interest_free int,
  add column if not exists reviews_breakdown jsonb not null default '[]'::jsonb,
  add column if not exists qty_selector_enabled boolean not null default true,
  add column if not exists specs jsonb not null default '[]'::jsonb;

-- Enriquecer los productos demo existentes con estas features así los
-- templates de ecommerce se ven "completos" out-of-the-box.

update public.demo_physical_products
set condition = 'new',
    installments_max = 12,
    installments_interest_free = 6,
    qty_selector_enabled = true
where condition is null;

-- Reviews breakdown: distribuido por rating (aproximación realista).
-- Producto con rating alto → mayoría 5⭐, algunos 4⭐, pocos bajos.
update public.demo_physical_products set reviews_breakdown = '[186,72,28,12,5]'::jsonb
  where slug = 'auriculares-bluetooth' and jsonb_array_length(reviews_breakdown) = 0;
update public.demo_physical_products set reviews_breakdown = '[142,58,22,8,3]'::jsonb
  where slug = 'teclado-mecanico' and jsonb_array_length(reviews_breakdown) = 0;
update public.demo_physical_products set reviews_breakdown = '[210,84,31,15,6]'::jsonb
  where slug = 'mouse-inalambrico' and jsonb_array_length(reviews_breakdown) = 0;
update public.demo_physical_products set reviews_breakdown = '[95,42,18,7,3]'::jsonb
  where slug = 'remera-basica-blanca' and jsonb_array_length(reviews_breakdown) = 0;
update public.demo_physical_products set reviews_breakdown = '[78,35,14,5,2]'::jsonb
  where slug = 'sweater-oversized' and jsonb_array_length(reviews_breakdown) = 0;
update public.demo_physical_products set reviews_breakdown = '[124,52,19,8,4]'::jsonb
  where slug = 'jean-slim' and jsonb_array_length(reviews_breakdown) = 0;
update public.demo_physical_products set reviews_breakdown = '[168,61,24,10,4]'::jsonb
  where slug = 'mochila-trekking' and jsonb_array_length(reviews_breakdown) = 0;
update public.demo_physical_products set reviews_breakdown = '[240,92,38,16,7]'::jsonb
  where slug = 'botella-termica' and jsonb_array_length(reviews_breakdown) = 0;
update public.demo_physical_products set reviews_breakdown = '[112,45,17,6,2]'::jsonb
  where slug = 'vela-aromatica' and jsonb_array_length(reviews_breakdown) = 0;
update public.demo_physical_products set reviews_breakdown = '[89,38,15,6,3]'::jsonb
  where slug = 'sabanas-algodon' and jsonb_array_length(reviews_breakdown) = 0;

-- Specs útiles por categoría
update public.demo_physical_products set specs = '[
  {"label":"Tipo de conexión","value":"Bluetooth 5.3"},
  {"label":"Autonomía","value":"Hasta 30 horas con estuche"},
  {"label":"Cancelación de ruido","value":"Activa (ANC)"},
  {"label":"Micrófono incorporado","value":"Sí"},
  {"label":"Garantía","value":"12 meses"}
]'::jsonb
  where slug = 'auriculares-bluetooth' and jsonb_array_length(specs) = 0;

update public.demo_physical_products set specs = '[
  {"label":"Switches","value":"Cherry MX Red"},
  {"label":"Layout","value":"Latino (español)"},
  {"label":"Retroiluminación","value":"RGB por tecla"},
  {"label":"Conexión","value":"USB-C desmontable"},
  {"label":"Software","value":"Configurable por tecla"}
]'::jsonb
  where slug = 'teclado-mecanico' and jsonb_array_length(specs) = 0;

update public.demo_physical_products set specs = '[
  {"label":"DPI","value":"Hasta 1600"},
  {"label":"Autonomía","value":"18 meses (2xAA)"},
  {"label":"Conexión","value":"USB inalámbrico 2.4 GHz"},
  {"label":"Ergonomía","value":"Diseño para mano derecha"},
  {"label":"Botones","value":"6 personalizables"}
]'::jsonb
  where slug = 'mouse-inalambrico' and jsonb_array_length(specs) = 0;

update public.demo_physical_products set specs = '[
  {"label":"Material","value":"100% algodón peinado"},
  {"label":"Gramaje","value":"180 g/m²"},
  {"label":"Corte","value":"Regular unisex"},
  {"label":"Lavado","value":"Agua fría, no usar secadora"},
  {"label":"Origen","value":"Confeccionada en Argentina"}
]'::jsonb
  where slug = 'remera-basica-blanca' and jsonb_array_length(specs) = 0;

update public.demo_physical_products set specs = '[
  {"label":"Capacidad","value":"40 litros"},
  {"label":"Material","value":"Poliéster 600D impermeable"},
  {"label":"Peso","value":"1.2 kg"},
  {"label":"Compartimentos","value":"Principal + 2 laterales + secreto"},
  {"label":"Garantía","value":"6 meses"}
]'::jsonb
  where slug = 'mochila-trekking' and jsonb_array_length(specs) = 0;

update public.demo_physical_products set specs = '[
  {"label":"Capacidad","value":"750 ml"},
  {"label":"Material","value":"Acero inoxidable 304"},
  {"label":"Retención frío","value":"24 horas"},
  {"label":"Retención calor","value":"12 horas"},
  {"label":"Libre de BPA","value":"Sí"}
]'::jsonb
  where slug = 'botella-termica' and jsonb_array_length(specs) = 0;

-- Recarga schema cache
do $$ begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then null;
end $$;
