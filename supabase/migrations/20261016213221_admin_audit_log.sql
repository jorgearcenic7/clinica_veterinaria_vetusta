-- Requiere que supabase-client-area.sql se haya ejecutado antes
-- (usa la función public.is_admin() definida en ese script).

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid,
  admin_email text,
  action text not null check (action in ('create', 'update', 'status_change', 'cancel', 'delete')),
  entity_type text not null default 'reservation',
  entity_id text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_entity_idx on public.admin_audit_logs(entity_type, entity_id);
create index if not exists admin_audit_logs_admin_user_id_idx on public.admin_audit_logs(admin_user_id);
create index if not exists admin_audit_logs_created_at_idx on public.admin_audit_logs(created_at);

-- Grants explicitos: este proyecto no depende de privilegios por defecto del
-- esquema public (mismo patron que supabase-reservations.sql y
-- supabase-client-area.sql). Sin esto, el INSERT falla con "permission denied
-- for table admin_audit_logs" antes de que RLS llegue a evaluarse.
grant usage on schema public to authenticated;
revoke all on table public.admin_audit_logs from anon;
grant select, insert on table public.admin_audit_logs to authenticated;

alter table public.admin_audit_logs enable row level security;

drop policy if exists "Admins read audit logs" on public.admin_audit_logs;
drop policy if exists "Admins insert audit logs" on public.admin_audit_logs;

-- Solo lectura e inserción para admins. Sin política de update/delete:
-- un registro de auditoría no debe poder modificarse ni borrarse vía API.
create policy "Admins read audit logs"
  on public.admin_audit_logs
  for select
  using (public.is_admin());

create policy "Admins insert audit logs"
  on public.admin_audit_logs
  for insert
  with check (public.is_admin());
