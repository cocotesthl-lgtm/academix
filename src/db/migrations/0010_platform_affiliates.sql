-- 0010_platform_affiliates.sql
--
-- Afiliados pasan a ser un rol PLATFORM-LEVEL (de OfferNow), no per-tenant.
-- Cualquier afiliado registrado puede promocionar cursos de cualquier
-- academia. La membership por tenant se sigue creando, pero se autocrea
-- la primera vez que el afiliado genera un link para esa academia (así el
-- owner lo ve listado entre "sus afiliados").
--
-- Flujo nuevo:
--   1. User se registra como afiliado (de OfferNow) desde apex/marketplace/login
--      → profiles.is_affiliate = true
--   2. Navega cualquier storefront → AffiliateBar aparece (lee is_affiliate)
--   3. Click "Copiar mi link" en una landing → /api/aff/my-code crea el
--      affiliate_link + autocrea memberships(role=affiliate) si falta
--   4. Owner ve al afiliado en /owner/affiliates (sigue funcionando igual)
--
-- Backfill: cualquier user que ya sea affiliate en algún tenant se marca
-- is_affiliate=true automáticamente.

alter table public.profiles
  add column if not exists is_affiliate         boolean default false,
  add column if not exists affiliate_signup_at  timestamptz;

-- Backfill: si ya tenía membership role=affiliate, ya es afiliado platform-level
update public.profiles p
set is_affiliate = true,
    affiliate_signup_at = coalesce(p.affiliate_signup_at, now())
where exists (
  select 1 from public.memberships m
  where m.user_id = p.id and m.role = 'affiliate' and m.status = 'active'
)
and p.is_affiliate is not true;

-- Índice para buscar afiliados platform-wide (founder dashboard a futuro)
create index if not exists profiles_is_affiliate_idx
  on public.profiles (is_affiliate)
  where is_affiliate = true;
