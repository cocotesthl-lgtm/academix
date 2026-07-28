-- 0088 · Fix delete de usuarios: agregar ON DELETE CASCADE / SET NULL
--
-- Problema: cuando un founder intenta borrar un user desde /founder/users,
-- Supabase devuelve "Database error deleting user" porque hay múltiples FKs
-- a profiles.id que NO tienen cascade/set null. Al intentar borrar el auth
-- user → cascade al profile → FK violation por rows huérfanos.
--
-- Solución: alter cada FK problemático con la política adecuada:
--   · CASCADE   → cuando el row es "contenido del user" (memberships,
--                  enrollments, tickets, tenants owned, mensajes)
--   · SET NULL  → cuando queremos preservar el histórico anonimizado
--                  (sales, commissions, audit_log, comentarios, etc)
--
-- Idempotente: usa DO blocks que primero drop la FK vieja (si existe) y
-- después crea la nueva con la policy correcta.

-- Helper local: alterar una FK
--   $1 = table
--   $2 = column
--   $3 = referenced table (ej. 'public.profiles')
--   $4 = policy: 'cascade' | 'set null'
create or replace function _tmp_alter_fk(
  p_table text, p_column text, p_ref text, p_policy text
) returns void as $$
declare
  con_name text;
  ref_col text := split_part(p_ref, '(', 2);
begin
  ref_col := rtrim(ref_col, ')');
  if ref_col = '' then ref_col := 'id'; end if;

  -- Encontrar el nombre de la FK existente
  select tc.constraint_name into con_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.constraint_type = 'FOREIGN KEY'
    and tc.table_schema = split_part(p_table, '.', 1)
    and tc.table_name = split_part(p_table, '.', 2)
    and kcu.column_name = p_column
  limit 1;

  if con_name is not null then
    execute format('alter table %s drop constraint %I', p_table, con_name);
  end if;

  execute format(
    'alter table %s add constraint %I foreign key (%I) references %s on delete %s',
    p_table,
    p_table || '_' || p_column || '_fkey',
    p_column,
    p_ref,
    p_policy
  );
exception when undefined_table or undefined_column then
  -- Tabla o columna no existe en este entorno (migration futura) — skip
  null;
end;
$$ language plpgsql;

-- ============================================================
-- FKs a public.profiles(id)
-- ============================================================

-- Tenants: si borrás al owner, se borra el sitio entero
select _tmp_alter_fk('public.tenants', 'owner_user_id', 'public.profiles(id)', 'cascade');

-- Profiles: referrer se desasocia si el referido se borra
select _tmp_alter_fk('public.profiles', 'referred_by_user_id', 'public.profiles(id)', 'set null');

-- Courses: preservamos el curso, autor pasa a null
select _tmp_alter_fk('public.courses', 'created_by', 'public.profiles(id)', 'set null');

-- Sales: histórico se preserva anonimizado
select _tmp_alter_fk('public.sales', 'buyer_user_id', 'public.profiles(id)', 'set null');

-- Commission rates: quien seteo la override → null
select _tmp_alter_fk('public.commission_rates', 'set_by', 'public.profiles(id)', 'set null');

-- Commissions: comprador + tres niveles → null para preservar plata
select _tmp_alter_fk('public.commissions', 'buyer_user_id', 'public.profiles(id)', 'set null');
select _tmp_alter_fk('public.commissions', 'l1_user_id', 'public.profiles(id)', 'set null');
select _tmp_alter_fk('public.commissions', 'l2_user_id', 'public.profiles(id)', 'set null');
select _tmp_alter_fk('public.commissions', 'l3_user_id', 'public.profiles(id)', 'set null');

-- Enrollments (NOT NULL): borrar enrollment del user
select _tmp_alter_fk('public.enrollments', 'user_id', 'public.profiles(id)', 'cascade');

-- Tickets (NOT NULL): borrar tickets del user
select _tmp_alter_fk('public.tickets', 'opened_by', 'public.profiles(id)', 'cascade');

-- Ticket messages (NOT NULL): borrar mensajes del user
select _tmp_alter_fk('public.ticket_messages', 'author_user_id', 'public.profiles(id)', 'cascade');

-- Audit log: mantener entry para trazabilidad, actor → null
select _tmp_alter_fk('public.audit_log', 'actor_user_id', 'public.profiles(id)', 'set null');

-- Pay links (RESTRICT — bloqueaba todo): preservar histórico
select _tmp_alter_fk('public.pay_links', 'created_by', 'public.profiles(id)', 'set null');

-- ============================================================
-- FKs a auth.users(id)
-- ============================================================

select _tmp_alter_fk('public.whatsapp_conversations', 'assigned_user_id', 'auth.users(id)', 'set null');
select _tmp_alter_fk('public.whatsapp_broadcasts', 'created_by', 'auth.users(id)', 'set null');
select _tmp_alter_fk('public.whatsapp_broadcasts_scheduled', 'created_by', 'auth.users(id)', 'set null');

-- ============================================================
-- Cleanup
-- ============================================================
drop function _tmp_alter_fk(text, text, text, text);

-- Recarga schema cache de PostgREST
do $$ begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then null;
end $$;
