-- 0091 · Biblioteca de colores del sitio (brand swatches)
--
-- Guarda los colores/gradients que el owner "pinnea" (o auto-guardamos
-- cada vez que aplica uno del template) para reutilizarlos entre secciones
-- sin tener que recordar el hex o volver a armar el gradient.
--
-- Estructura del array:
--   [{ id: string, value: string, kind: 'solid'|'gradient', created_at: timestamp }]
--   · value: hex ('#f97316') o CSS ('linear-gradient(135deg, #x, #y)')
--   · kind: para separar visualmente en la strip
--   · id: uuid client-generated para poder unpin uno específico

alter table public.tenants
  add column if not exists brand_swatches jsonb not null default '[]'::jsonb;

-- Seed: pinnear el primary_color + primary_gradient de brand para cada
-- tenant que ya los tenga. Así al abrir el editor, aparece la paleta del
-- template que eligieron al hacer onboarding.
do $$
declare
  t record;
  swatches jsonb;
  pc text;
  pg text;
begin
  for t in select id, brand from public.tenants where jsonb_array_length(brand_swatches) = 0 loop
    swatches := '[]'::jsonb;
    pc := t.brand->>'primary_color';
    pg := t.brand->>'primary_gradient';
    if pc is not null and pc <> '' then
      swatches := swatches || jsonb_build_object(
        'id', gen_random_uuid()::text,
        'value', pc,
        'kind', 'solid',
        'created_at', now()
      );
    end if;
    if pg is not null and pg <> '' then
      swatches := swatches || jsonb_build_object(
        'id', gen_random_uuid()::text,
        'value', pg,
        'kind', 'gradient',
        'created_at', now()
      );
    end if;
    if jsonb_array_length(swatches) > 0 then
      update public.tenants set brand_swatches = swatches where id = t.id;
    end if;
  end loop;
end $$;

-- Recarga schema cache
do $$ begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then null;
end $$;
