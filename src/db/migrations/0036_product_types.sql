-- 0036 Ampliar product_type a tipos generales (no solo curso / VIP)
-- Permite: course (default), event, mentorship, vip_pack, digital, physical, service
do $$
begin
  alter table public.courses drop constraint if exists courses_product_type_check;
exception when undefined_table then null;
end $$;

alter table public.courses
  add constraint courses_product_type_check
  check (product_type in ('course', 'event', 'mentorship', 'vip_pack', 'digital', 'physical', 'service'));
