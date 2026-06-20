-- 0040 Trazabilidad de pagos parciales en ventas
-- Cuando el comprador paga sólo la seña (no el total), marcamos la venta
-- como 'deposit'. El owner ve "Pago parcial" en el panel.
alter table public.sales add column if not exists payment_kind text;
do $$ begin
  alter table public.sales add constraint sales_payment_kind_check
    check (payment_kind is null or payment_kind in ('full', 'deposit'));
exception when duplicate_object then null; end $$;
