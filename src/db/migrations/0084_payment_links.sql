-- 0084_payment_links.sql
-- App "Links de pago": permite al owner (y opcionalmente a sus afiliados)
-- generar URLs cortas /pay/{code} con monto + descripción + reglas (max
-- usos, expiración, campos requeridos al buyer). Al pagar se crea un
-- registro en pay_link_payments; si viene con ref de afiliado se registra
-- la comisión inline (no depende del commission engine de courses porque
-- estos links no tienen course_id).
--
-- Diseño:
--   pay_links: el link maestro (uno por producto/servicio)
--   pay_link_payments: cada intento/pago (idempotente por external_id)
--
-- Idempotencia MP: (external_provider, external_id) UNIQUE.
-- RLS: solo owner + staff/admin del tenant pueden CRUD; public read por
-- code está disponible via service_role (webhook + public page).

create table if not exists public.pay_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- Código público corto (base62 ~8 chars). UNIQUE global — nadie
  -- adivina el link de otro tenant si el code es opaco.
  code text not null unique,

  title text not null,
  description text,
  cover_url text,

  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'ARS',

  -- Quién lo creó: owner directo, un staff/admin, o un afiliado (si la app
  -- de afiliados está prendida y el link permite afiliados).
  created_by uuid not null references public.profiles(id) on delete restrict,
  creator_role text not null check (creator_role in ('owner','admin','staff','affiliate')),
  -- Si lo creó un afiliado, se referencia acá directo. Si un owner lo creó
  -- pero permite afiliados, sigue null hasta que un afiliado genere su
  -- variante — en cuyo caso se crea una NUEVA row hija.
  affiliate_user_id uuid references public.profiles(id) on delete set null,
  -- Cuando un afiliado clona un link del owner, guardamos el id del original
  -- para agrupar métricas y no permitir editar precio/título por afiliado.
  parent_link_id uuid references public.pay_links(id) on delete cascade,

  status text not null default 'active' check (status in ('active','paused','expired','used_up')),
  max_uses integer,                            -- null = ilimitado
  uses_count integer not null default 0,
  expires_at timestamptz,

  -- Info que se le pide al buyer en el checkout (nombre siempre; email casi
  -- siempre — dni/phone opcionales según el owner).
  require_email boolean not null default true,
  require_name boolean not null default true,
  require_phone boolean not null default false,
  require_dni boolean not null default false,
  custom_note text,                            -- texto libre visible en la página de pago

  -- Comisión que le queda al afiliado (fija por link — override del split
  -- global del tenant, para links donde el owner quiere ser más agresivo
  -- o conservador). Si es null, se usa affiliate_budget_pct del tenant.
  affiliate_commission_pct numeric(5,2),       -- ej 20.00 = 20% del total
  -- El owner elige si este link puede ser promocionado por afiliados.
  allow_affiliates boolean not null default false,

  -- Analytics
  views_count integer not null default 0,
  clicks_count integer not null default 0,     -- clicks al botón Pagar
  revenue_cents bigint not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pay_links_tenant on public.pay_links(tenant_id, status);
create index if not exists idx_pay_links_affiliate on public.pay_links(tenant_id, affiliate_user_id) where affiliate_user_id is not null;
create index if not exists idx_pay_links_parent on public.pay_links(parent_link_id) where parent_link_id is not null;

alter table public.pay_links enable row level security;

drop policy if exists "pay_links owner rw" on public.pay_links;
create policy "pay_links owner rw" on public.pay_links
  for all using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = pay_links.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin','staff')
        and m.status = 'active'
    )
  );

drop policy if exists "pay_links affiliate rw" on public.pay_links;
create policy "pay_links affiliate rw" on public.pay_links
  for all using (
    -- El afiliado sólo puede ver sus propias variantes hijas
    pay_links.affiliate_user_id = auth.uid()
  );

-- Registros de pagos hechos vía un link
create table if not exists public.pay_link_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  pay_link_id uuid not null references public.pay_links(id) on delete cascade,

  -- Info del comprador (según require_* del link)
  buyer_name text,
  buyer_email text,
  buyer_phone text,
  buyer_dni text,
  buyer_user_id uuid references public.profiles(id) on delete set null,

  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null,

  -- Origen del pago
  external_provider text not null default 'mercadopago' check (external_provider in ('mercadopago','manual')),
  external_id text,                            -- MP payment_id
  preference_id text,                          -- MP preference_id (útil pre-pago)

  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),

  -- Afiliado que trajo la venta (resuelto en el checkout — proviene del
  -- ref cookie o del affiliate_user_id del link si es una variante hija).
  affiliate_user_id uuid references public.profiles(id) on delete set null,
  affiliate_commission_cents bigint not null default 0,
  -- Cuando la comisión se marca como "settled" (pagada al afiliado) queda
  -- este timestamp — sino sigue como "deuda con el afiliado".
  affiliate_settled_at timestamptz,

  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (external_provider, external_id)
);

create index if not exists idx_pll_payments_tenant on public.pay_link_payments(tenant_id, status);
create index if not exists idx_pll_payments_link on public.pay_link_payments(pay_link_id);
create index if not exists idx_pll_payments_affiliate on public.pay_link_payments(affiliate_user_id, affiliate_settled_at) where affiliate_user_id is not null;

alter table public.pay_link_payments enable row level security;

drop policy if exists "pll owner rw" on public.pay_link_payments;
create policy "pll owner rw" on public.pay_link_payments
  for all using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = pay_link_payments.tenant_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin','staff')
        and m.status = 'active'
    )
  );

drop policy if exists "pll affiliate read" on public.pay_link_payments;
create policy "pll affiliate read" on public.pay_link_payments
  for select using (pay_link_payments.affiliate_user_id = auth.uid());
