-- =====================================================================
-- Curplat — Coupons + redemptions (Sprint 4)
-- Run AFTER 0001 + 0002 + 0003.
-- =====================================================================

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code citext not null,
  type text not null check (type in ('percent', 'fixed')),
  amount numeric not null check (amount > 0),
  course_id uuid references public.courses(id) on delete cascade,
  max_redemptions int,
  redemption_count int not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'paused', 'expired')),
  source text not null default 'manual' check (source in ('manual', 'wheel')),
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);
create index if not exists idx_coupons_tenant_status on public.coupons(tenant_id, status);
create index if not exists idx_coupons_code on public.coupons(code);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  sale_id uuid references public.sales(id) on delete set null,
  amount_discounted_cents bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_redemptions_coupon on public.coupon_redemptions(coupon_id, created_at desc);
create index if not exists idx_redemptions_tenant on public.coupon_redemptions(tenant_id, created_at desc);

alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;

drop policy if exists coupons_public_read on public.coupons;
create policy coupons_public_read on public.coupons
  for select using (status = 'active');

drop policy if exists coupons_owner_all on public.coupons;
create policy coupons_owner_all on public.coupons
  for all
  using (public.is_tenant_owner(tenant_id) or public.is_super_admin())
  with check (public.is_tenant_owner(tenant_id) or public.is_super_admin());

drop policy if exists redemptions_owner_read on public.coupon_redemptions;
create policy redemptions_owner_read on public.coupon_redemptions
  for select using (public.is_tenant_owner(tenant_id) or public.is_super_admin());
