create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text not null,
  email text,
  mascota text,
  servicio text,
  datetime text not null unique,
  status text not null default 'pending',
  notes text,
  worker_id uuid,
  google_event_id text,
  google_sync_error text,
  google_synced_at timestamp,
  start_at timestamptz,
  end_at timestamptz,
  updated_at timestamp not null default now(),
  created_at timestamptz not null default now()
);

alter table public.reservations
  add column if not exists status text not null default 'pending',
  add column if not exists email text,
  add column if not exists notes text,
  add column if not exists worker_id uuid,
  add column if not exists google_event_id text,
  add column if not exists google_sync_error text,
  add column if not exists google_synced_at timestamp,
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz,
  add column if not exists updated_at timestamp not null default now();

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'reservations_datetime_key'
      and conrelid = 'public.reservations'::regclass
  ) then
    alter table public.reservations
      drop constraint reservations_datetime_key;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservations_status_check'
      and conrelid = 'public.reservations'::regclass
  ) then
    alter table public.reservations
      add constraint reservations_status_check
      check (status in ('pending', 'confirmed', 'cancelled'));
  end if;
end;
$$;

update public.reservations
set
  start_at = coalesce(start_at, datetime::timestamp at time zone 'Europe/Madrid'),
  end_at = coalesce(end_at, (datetime::timestamp + interval '30 minutes') at time zone 'Europe/Madrid')
where datetime ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'
  and (start_at is null or end_at is null);

create or replace function public.set_reservation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_reservation_updated_at_trigger on public.reservations;
create trigger set_reservation_updated_at_trigger
  before update on public.reservations
  for each row execute function public.set_reservation_updated_at();

create index if not exists reservations_datetime_idx
  on public.reservations (datetime);

create unique index if not exists reservations_active_datetime_unique_idx
  on public.reservations (datetime)
  where status <> 'cancelled';

create index if not exists reservations_start_at_idx
  on public.reservations (start_at);

create index if not exists reservations_status_idx
  on public.reservations (status);

create index if not exists reservations_worker_id_idx
  on public.reservations (worker_id);

create index if not exists reservations_google_event_id_idx
  on public.reservations (google_event_id);

create index if not exists reservations_google_synced_at_idx
  on public.reservations (google_synced_at);

grant usage on schema public to anon, authenticated;
grant select, insert on table public.reservations to anon;
grant select, update on table public.reservations to authenticated;

-- Recomendado para produccion:
-- 1. Mantener RLS activado.
-- 2. Usar SUPABASE_SERVICE_ROLE_KEY solo en el backend/Vercel, nunca en el HTML.
-- 3. Si usas service role, puedes eliminar estas politicas para anon.
alter table public.reservations enable row level security;

drop policy if exists "Allow reservation reads from backend anon key"
  on public.reservations;

drop policy if exists "Allow reservation inserts from backend anon key"
  on public.reservations;

drop policy if exists "Admins manage reservations"
  on public.reservations;

drop policy if exists "allow public insert"
  on public.reservations;

drop policy if exists "admin read reservations"
  on public.reservations;

drop policy if exists "admin update reservations"
  on public.reservations;

create policy "allow public insert"
  on public.reservations
  for insert
  to anon
  with check (true);

create policy "admin read reservations"
  on public.reservations
  for select
  to authenticated
  using (true);

create policy "admin update reservations"
  on public.reservations
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
