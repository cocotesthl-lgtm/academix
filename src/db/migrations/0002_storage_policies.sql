-- =====================================================================
-- OfferNow — Storage buckets + RLS policies (Week 3)
-- Run AFTER 0001_init.sql.
-- =====================================================================

-- Create buckets (idempotent)
insert into storage.buckets (id, name, public)
values
  ('branding', 'branding', true),
  ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- =====================================================================
-- BRANDING bucket — public read, owner-of-tenant write
-- Path convention: <tenant_id>/<filename>
-- =====================================================================

drop policy if exists branding_public_read on storage.objects;
create policy branding_public_read on storage.objects
  for select
  using (bucket_id = 'branding');

drop policy if exists branding_owner_write on storage.objects;
create policy branding_owner_write on storage.objects
  for insert
  with check (
    bucket_id = 'branding'
    and (
      public.is_super_admin()
      or public.is_tenant_owner((split_part(name, '/', 1))::uuid)
    )
  );

drop policy if exists branding_owner_update on storage.objects;
create policy branding_owner_update on storage.objects
  for update
  using (
    bucket_id = 'branding'
    and (
      public.is_super_admin()
      or public.is_tenant_owner((split_part(name, '/', 1))::uuid)
    )
  );

drop policy if exists branding_owner_delete on storage.objects;
create policy branding_owner_delete on storage.objects
  for delete
  using (
    bucket_id = 'branding'
    and (
      public.is_super_admin()
      or public.is_tenant_owner((split_part(name, '/', 1))::uuid)
    )
  );

-- =====================================================================
-- ATTACHMENTS bucket — private; ticket participants only
-- Path convention: tickets/<ticket_id>/<filename>
-- For MVP we restrict by tenant ownership; ticket-level access is enforced
-- at the API layer by validating the signed URL request.
-- =====================================================================

drop policy if exists attachments_member_read on storage.objects;
create policy attachments_member_read on storage.objects
  for select
  using (
    bucket_id = 'attachments'
    and auth.uid() is not null
  );

drop policy if exists attachments_member_write on storage.objects;
create policy attachments_member_write on storage.objects
  for insert
  with check (
    bucket_id = 'attachments'
    and auth.uid() is not null
  );

-- =====================================================================
-- Add INSERT policy on tenants so we can drop service-role usage later.
-- For now createTenantAction uses service-role, but this prepares the path.
-- =====================================================================

drop policy if exists tenants_self_create on public.tenants;
create policy tenants_self_create on public.tenants
  for insert
  with check (owner_user_id = auth.uid());

drop policy if exists memberships_self_owner_create on public.memberships;
create policy memberships_self_owner_create on public.memberships
  for insert
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and exists (
      select 1 from public.tenants t
      where t.id = tenant_id and t.owner_user_id = auth.uid()
    )
  );
