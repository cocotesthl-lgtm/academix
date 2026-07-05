-- 0054 · Categorías con jerarquía (mega-menu tipo MercadoLibre)
--
-- Antes: course_categories era plana — solo name/slug/position.
-- Ahora: cada categoría puede tener parent_id opcional. Depth máximo
-- de facto = 2 (padre + hijo). No aplicamos check constraint para
-- permitir 3 niveles si el owner los quiere, pero la UI solo expone 2.
--
-- Uso desde storefront:
--   · Sidebar del megamenu = categorías con parent_id=null (roots)
--   · Panel derecho al hover = children del root seleccionado
--
-- Filtro en /tienda:
--   Si filtrás "Tecnología" (root), los productos matcheados incluyen
--   los que están en cualquier categoría cuya cadena de parents llegue
--   a "Tecnología". Esto se resuelve en app (no en SQL) porque es un
--   set chico.

alter table public.course_categories
  add column if not exists parent_id uuid references public.course_categories(id) on delete set null,
  add column if not exists is_featured boolean not null default false;
  -- is_featured = "aparece en el megamenu principal" (para que el owner
  -- pueda tener 30 categorías internas pero solo destacar 8 en la nav)

create index if not exists idx_categories_parent on public.course_categories(parent_id);
create index if not exists idx_categories_tenant_featured on public.course_categories(tenant_id, is_featured);
