-- 0055 · Gift cards
--
-- Modelo: single-use full-redemption. Cada card tiene un código único
-- (a nivel plataforma, no tenant — para permitir escaneo desde cualquier
-- URL sin colisiones aunque son legibles solo con el tenant correcto).
-- El comprador la usa una vez completa; si sobra saldo se pierde.
--
-- Extensiones futuras (parked):
--   · partial redemption con balance restante → tabla gift_card_redemptions
--   · convertir a wallet balance en vez de descuento one-shot
--
-- Cada card se emite con un CODE de 8-10 chars legibles (sin O/0, I/1)
-- para reducir errores de tipeo. La URL de landing es /gc/<code>.

create table if not exists public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,        -- ej. "K7X9M2XN" — plataforma-unique
  amount_cents int not null check (amount_cents > 0),
  currency text not null default 'ARS',
  recipient_name text,       -- para el diseño ("Para: María")
  sender_name text,          -- ("De: Juan")
  message text,              -- mensaje libre
  expires_at timestamptz,    -- null = sin expiración
  status text not null default 'active' check (status in (
    'active', 'redeemed', 'expired', 'cancelled'
  )),
  redeemed_at timestamptz,
  redeemed_by_email text,
  redeemed_order_id uuid,    -- referencia a physical_orders (sin FK, borrado libre)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (code)
);
create index if not exists idx_giftcards_tenant on public.gift_cards(tenant_id, created_at desc);
create index if not exists idx_giftcards_status on public.gift_cards(tenant_id, status);
create index if not exists idx_giftcards_code on public.gift_cards(code);

alter table public.gift_cards enable row level security;

-- Owner: full access a las de su tenant
drop policy if exists giftcards_owner on public.gift_cards;
create policy giftcards_owner on public.gift_cards
  for all to authenticated
  using (
    exists (select 1 from public.memberships m
      where m.tenant_id = gift_cards.tenant_id
      and m.user_id = auth.uid() and m.role = 'owner' and m.status = 'active')
  );

-- Público: puede leer una card por su código exacto (para la landing /gc/<code>).
-- No expone listado — solo lookup by code.
drop policy if exists giftcards_public_read_by_code on public.gift_cards;
create policy giftcards_public_read_by_code on public.gift_cards
  for select to anon, authenticated using (true);
