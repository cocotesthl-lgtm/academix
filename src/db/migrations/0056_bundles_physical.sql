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
--    agregamos otro para physical. El viejo permite duplicar physical.
drop index if exists bundle_items_bundle_id_course_id_key;
alter table public.bundle_items
  drop constraint if exists bundle_items_bundle_id_course_id_key;
create unique index if not exists uq_bundle_items_course
  on public.bundle_items(bundle_id, course_id)
  where course_id is not null;
create unique index if not exists uq_bundle_items_physical
  on public.bundle_items(bundle_id, physical_product_id)
  where physical_product_id is not null;

create index if not exists idx_bundle_items_physical on public.bundle_items(physical_product_id);
