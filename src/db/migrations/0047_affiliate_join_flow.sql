-- =====================================================================
-- 0047_affiliate_join_flow.sql
-- Flow de "Trabajá con nosotros" (F6).
--
-- Cada tenant elige cómo acepta afiliados:
--   - 'disabled'  → la sección/CTA no aparece en el storefront (default)
--   - '1click'    → el user aplica y queda active al instante
--   - 'approval'  → el user aplica con status='pending', el owner aprueba
--
-- affiliate_commission_rate: % que gana el afiliado sobre cada venta que
-- genera (0..1). Sobreescribe el default de plataforma para las
-- comisiones de afiliados INTERNOS al tenant. Los platform-level siguen
-- usando la config global.
--
-- affiliate_terms: texto libre (markdown-lite) que el owner puede
-- mostrar en el storefront como "Términos del programa" antes del CTA.
-- =====================================================================

alter table public.tenants
  add column if not exists affiliate_mode text not null default 'disabled',
  add column if not exists affiliate_commission_rate numeric(4,3),
  add column if not exists affiliate_terms text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tenants_affiliate_mode_check') then
    alter table public.tenants add constraint tenants_affiliate_mode_check
      check (affiliate_mode in ('disabled', '1click', 'approval'));
  end if;
end $$;
