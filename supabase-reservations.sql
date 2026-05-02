create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text not null,
  mascota text,
  servicio text,
  datetime text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists reservations_datetime_idx
  on public.reservations (datetime);

grant usage on schema public to anon;
grant select, insert on table public.reservations to anon;

-- Recomendado para produccion:
-- 1. Mantener RLS activado.
-- 2. Usar SUPABASE_SERVICE_ROLE_KEY solo en el backend/Vercel, nunca en el HTML.
-- 3. Si usas service role, puedes eliminar estas politicas para anon.
alter table public.reservations enable row level security;

drop policy if exists "Allow reservation reads from backend anon key"
  on public.reservations;

drop policy if exists "Allow reservation inserts from backend anon key"
  on public.reservations;

create policy "Allow reservation reads from backend anon key"
  on public.reservations
  for select
  to anon
  using (true);

create policy "Allow reservation inserts from backend anon key"
  on public.reservations
  for insert
  to anon
  with check (true);
