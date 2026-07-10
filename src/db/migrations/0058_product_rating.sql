-- =====================================================================
-- 0058_product_rating.sql
-- Rating manual + cantidad de reseñas por producto físico.
--
-- No hay reviews reales — es un campo que el owner llena a mano en el
-- editor para dar prueba social (estilo Amazon/ML). Nulls = no mostrar.
--
-- rating: 0.0 a 5.0 con un decimal (ej. 4.3)
-- reviews_count: cantidad total (ej. "4.3 (5.592 opiniones)")
-- =====================================================================

alter table public.physical_products
  add column if not exists rating numeric(2,1) check (rating >= 0 and rating <= 5),
  add column if not exists reviews_count int not null default 0 check (reviews_count >= 0);
