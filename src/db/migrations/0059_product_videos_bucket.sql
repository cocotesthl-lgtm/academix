-- =====================================================================
-- 0059_product_videos_bucket.sql
-- Bucket para videos de productos físicos (feature de plans premium).
--
-- Escapa la política URL-only del proyecto: solo tenants con plan que
-- tenga features.uploads_enabled=true pueden subir. Enforce en el
-- endpoint /api/products/upload-video (chequea el plan antes de aceptar
-- el archivo).
--
-- Bucket público (para que el <video> del storefront lo lea sin auth).
-- Path convention: <tenant_id>/<uuid>.<ext>
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('product-videos', 'product-videos', true)
on conflict (id) do nothing;

-- Read público (storefront de cualquier visitante)
drop policy if exists "product_videos_public_read" on storage.objects;
create policy "product_videos_public_read" on storage.objects
  for select using (bucket_id = 'product-videos');

-- Write: solo el service_role. El endpoint API valida el plan y usa
-- service client — no hay INSERT/UPDATE/DELETE directo del client.
-- (Sin policy adicional; service_role bypasea RLS.)
