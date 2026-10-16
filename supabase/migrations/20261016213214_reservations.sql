create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text not null,
  email text,
  mascota text,
  servicio text,
  datetime text not null unique,
  status text not null default 'confirmed',
  notes text,
  worker_id uuid,
  google_event_id text,
  google_sync_error text,
  google_synced_at timestamp,
  start_at timestamptz,
  end_at timestamptz,
  client_id uuid references public.profiles(id) on delete set null,
  updated_at timestamp not null default now(),
  created_at timestamptz not null default now()
);

alter table public.reservations
  add column if not exists status text not null default 'confirmed',
  add column if not exists email text,
  add column if not exists notes text,
  add column if not exists worker_id uuid,
  add column if not exists google_event_id text,
  add column if not exists google_sync_error text,
  add column if not exists google_synced_at timestamp,
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz,
  add column if not exists client_id uuid references public.profiles(id) on delete set null,
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

alter table public.reservations
  alter column status set default 'confirmed';

update public.reservations
set status = 'confirmed'
where status = 'pending';

update public.reservations
set
  start_at = coalesce(start_at, datetime::timestamp at time zone 'Europe/Madrid'),
  end_at = case
    when servicio = 'cirugia' then (datetime::timestamp + interval '60 minutes') at time zone 'Europe/Madrid'
    else coalesce(end_at, (datetime::timestamp + interval '30 minutes') at time zone 'Europe/Madrid')
  end
where datetime ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'
  and (start_at is null or end_at is null or servicio = 'cirugia');

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

-- Bloqueo atomico de solapamientos por rango de tiempo (cubre servicios de
-- distinta duracion, p. ej. una cirugia de 10:30-11:30 frente a una consulta
-- de 11:00-11:30, que el indice unico de arriba no detecta porque su
-- "datetime" de inicio es distinto). Requiere start_at/end_at rellenos: el
-- backfill de mas arriba ya los completa para las filas existentes.
alter table public.reservations
  alter column start_at set not null,
  alter column end_at set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'reservations_no_overlap'
      and conrelid = 'public.reservations'::regclass
  ) then
    alter table public.reservations
      drop constraint reservations_no_overlap;
  end if;
end;
$$;

-- Rango semiabierto '[)': dos citas consecutivas (10:00-10:30 y 10:30-11:00)
-- no se consideran solapadas. Solo aplica a reservas activas: las canceladas
-- (status = 'cancelled') no bloquean el horario. La comprobacion la hace
-- Postgres de forma atomica en el INSERT/UPDATE, sin ventana de carrera.
alter table public.reservations
  add constraint reservations_no_overlap
  exclude using gist (tstzrange(start_at, end_at, '[)') with &&)
  where (status <> 'cancelled');

create index if not exists reservations_start_at_idx
  on public.reservations (start_at);

create index if not exists reservations_status_idx
  on public.reservations (status);

create index if not exists reservations_worker_id_idx
  on public.reservations (worker_id);

create index if not exists reservations_client_id_idx
  on public.reservations (client_id);

create index if not exists reservations_google_event_id_idx
  on public.reservations (google_event_id);

create index if not exists reservations_google_synced_at_idx
  on public.reservations (google_synced_at);

create or replace function public.get_reserved_reservation_slots(p_month text)
returns table (
  datetime text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  month_start text;
  month_end text;
begin
  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'El mes debe tener formato YYYY-MM';
  end if;

  month_start := p_month || '-01T00:00';
  month_end := to_char((p_month || '-01')::date + interval '1 month', 'YYYY-MM-DD') || 'T00:00';

  return query
    select
      to_char(slot_at, 'YYYY-MM-DD"T"HH24:MI') as datetime,
      reservations.status
    from public.reservations
    cross join lateral generate_series(
      reservations.datetime::timestamp,
      coalesce(
        reservations.end_at at time zone 'Europe/Madrid',
        reservations.datetime::timestamp + case
          when reservations.servicio = 'cirugia' then interval '60 minutes'
          else interval '30 minutes'
        end
      ) - interval '30 minutes',
      interval '30 minutes'
    ) as slots(slot_at)
    where reservations.datetime >= month_start
      and reservations.datetime < month_end
      and reservations.status <> 'cancelled';
end;
$$;

create or replace function public.find_profile_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from auth.users as u
  join public.profiles as p on p.id = u.id
  where lower(u.email) = lower(trim(p_email))
  limit 1;
$$;

create or replace function public.set_reservation_client_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(trim(coalesce(new.email, '')), '') is null then
    new.client_id = null;
  else
    new.client_id = public.find_profile_id_by_email(new.email);
  end if;

  return new;
end;
$$;

drop trigger if exists set_reservation_client_id_trigger on public.reservations;
create trigger set_reservation_client_id_trigger
  before insert or update of email on public.reservations
  for each row execute function public.set_reservation_client_id();

update public.reservations
set client_id = public.find_profile_id_by_email(email)
where email is not null;

grant usage on schema public to anon, authenticated;
revoke all on table public.reservations from anon;
revoke all on table public.reservations from authenticated;
grant insert on table public.reservations to anon;
grant select, update, delete on table public.reservations to authenticated;
grant execute on function public.get_reserved_reservation_slots(text) to anon, authenticated;

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

drop policy if exists "Public can create reservations"
  on public.reservations;

drop policy if exists "Admin can read reservations"
  on public.reservations;

drop policy if exists "Clients read own reservations"
  on public.reservations;

drop policy if exists "Admin can update reservations"
  on public.reservations;

drop policy if exists "Admin can delete reservations"
  on public.reservations;

create policy "Public can create reservations"
  on public.reservations
  for insert
  to anon
  with check (true);

create policy "Admin can read reservations"
  on public.reservations
  for select
  to authenticated
  using (public.is_admin());

create policy "Clients read own reservations"
  on public.reservations
  for select
  to authenticated
  using (client_id = auth.uid());

create policy "Admin can update reservations"
  on public.reservations
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin can delete reservations"
  on public.reservations
  for delete
  to authenticated
  using (public.is_admin());
