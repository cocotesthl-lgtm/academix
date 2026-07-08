-- =====================================================================
-- 0056_bundles_physical.sql
-- Bundles ahora soportan productos físicos (physical_products) además de
-- cursos (courses). Un bundle puede mezclar los dos tipos: "Kit skincare"
-- con shampoo + acondicionador (físicos) + curso "Rutina diaria" (curso).
--
-- Cambio: bundle_items.course_id pasa a nullable + agregamos
-- physical_product_id nullable. Exactamente UNO de los dos debe estar seteado.
-- =====================================================================

-- 1) course_id → nullable
alter table public.bundle_items
  alter column course_id drop not null;

-- 2) Nueva columna physical_product_id
alter table public.bundle_items
  add column if not exists physical_product_id uuid references public.physical_products(id) on delete cascade;

-- 3) Check: exactamente uno de los dos
alter table public.bundle_items
  drop constraint if exists bundle_items_one_target;
alter table public.bundle_items
  add constraint bundle_items_one_target check (
    (course_id is not null and physical_product_id is null)
    or (course_id is null and physical_product_id is not null)
  );

-- 4) Unique constraint viejo (bundle_id, course_id) ya no aplica solo:
--    la reemplazamos por un unique index PARCIAL (donde course_id is not null)
--    y agregamos otro para physical. Así podemos tener el mismo bundle con
--    un curso Y un producto físico sin colisiones.
--
--    Orden importante: dropeamos la CONSTRAINT primero — eso libera el
--    índice unique auto-generado por Postgres. Si intentamos drop index
--    antes, Postgres tira 2BP01 ("cannot drop because constraint requires it").
alter table public.bundle_items
  drop constraint if exists bundle_items_bundle_id_course_id_key;
-- Por si el nombre del índice difiere de la constraint (schemas raros o
-- versiones viejas), lo dropeamos también con IF EXISTS.
drop index if exists public.bundle_items_bundle_id_course_id_key;

create unique index if not exists uq_bundle_items_course
  on public.bundle_items(bundle_id, course_id)
  where course_id is not null;
create unique index if not exists uq_bundle_items_physical
  on public.bundle_items(bundle_id, physical_product_id)
  where physical_product_id is not null;

create index if not exists idx_bundle_items_physical on public.bundle_items(physical_product_id);
