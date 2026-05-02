create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'client' check (role in ('client', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  species text,
  breed text,
  birth_date date,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.pets
  add column if not exists image_url text;

create table if not exists public.pet_records (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  title text not null,
  record_type text,
  record_date date,
  notes text,
  next_due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.pet_documents (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  uploaded_by uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  file_url text not null,
  file_name text,
  file_type text,
  source text not null default 'client' check (source in ('client', 'clinic')),
  created_at timestamptz not null default now()
);

create index if not exists pets_owner_id_idx on public.pets(owner_id);
create index if not exists pet_records_pet_id_idx on public.pet_records(pet_id);
create index if not exists pet_records_next_due_date_idx on public.pet_records(next_due_date);
create index if not exists pet_documents_pet_id_idx on public.pet_documents(pet_id);
create index if not exists pet_documents_uploaded_by_idx on public.pet_documents(uploaded_by);

alter table public.profiles enable row level security;
alter table public.pets enable row level security;
alter table public.pet_records enable row level security;
alter table public.pet_documents enable row level security;

insert into storage.buckets (id, name, public)
values
  ('pet-images', 'pet-images', false),
  ('pet-documents', 'pet-documents', false)
on conflict (id) do nothing;

update storage.buckets
set public = false
where id in ('pet-images', 'pet-documents');

create or replace function public.is_admin(user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id
      and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    'client'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.set_pet_image(pet_id uuid, image_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.pets
    where id = pet_id
      and (owner_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'No tienes permiso para cambiar la imagen de esta mascota.';
  end if;

  update public.pets
  set image_url = public.set_pet_image.image_url
  where id = pet_id;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.pets to authenticated;
grant select, insert, update, delete on public.pet_records to authenticated;
grant select, insert, update, delete on public.pet_documents to authenticated;
grant execute on function public.set_pet_image(uuid, text) to authenticated;

drop policy if exists "Clients read own profile" on public.profiles;
drop policy if exists "Admins manage profiles" on public.profiles;
drop policy if exists "Clients read own pets" on public.pets;
drop policy if exists "Admins manage pets" on public.pets;
drop policy if exists "Clients read own pet records" on public.pet_records;
drop policy if exists "Admins manage pet records" on public.pet_records;
drop policy if exists "Clients read own pet documents" on public.pet_documents;
drop policy if exists "Clients upload own pet documents" on public.pet_documents;
drop policy if exists "Clients delete own uploaded pet documents" on public.pet_documents;
drop policy if exists "Admins manage pet documents" on public.pet_documents;
drop policy if exists "Clients upload own pet images" on storage.objects;
drop policy if exists "Clients update own pet images" on storage.objects;
drop policy if exists "Admins manage pet images" on storage.objects;
drop policy if exists "Authenticated read pet images" on storage.objects;
drop policy if exists "Clients upload own pet document files" on storage.objects;
drop policy if exists "Clients delete own pet document files" on storage.objects;
drop policy if exists "Admins manage pet document files" on storage.objects;
drop policy if exists "Authenticated read pet document files" on storage.objects;

create policy "Clients read own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy "Admins manage profiles"
  on public.profiles
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Clients read own pets"
  on public.pets
  for select
  to authenticated
  using (owner_id = auth.uid());

create policy "Admins manage pets"
  on public.pets
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Clients read own pet records"
  on public.pet_records
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.pets
      where pets.id = pet_records.pet_id
        and pets.owner_id = auth.uid()
    )
  );

create policy "Admins manage pet records"
  on public.pet_records
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Clients read own pet documents"
  on public.pet_documents
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.pets
      where pets.id = pet_documents.pet_id
        and pets.owner_id = auth.uid()
    )
  );

create policy "Clients upload own pet documents"
  on public.pet_documents
  for insert
  to authenticated
  with check (
    source = 'client'
    and uploaded_by = auth.uid()
    and exists (
      select 1
      from public.pets
      where pets.id = pet_documents.pet_id
        and pets.owner_id = auth.uid()
    )
  );

create policy "Clients delete own uploaded pet documents"
  on public.pet_documents
  for delete
  to authenticated
  using (
    source = 'client'
    and uploaded_by = auth.uid()
    and exists (
      select 1
      from public.pets
      where pets.id = pet_documents.pet_id
        and pets.owner_id = auth.uid()
    )
  );

create policy "Admins manage pet documents"
  on public.pet_documents
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Authenticated read pet images"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'pet-images'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.pets
        where pets.id::text = (storage.foldername(name))[1]
          and pets.owner_id = auth.uid()
      )
    )
  );

create policy "Clients upload own pet images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'pet-images'
    and exists (
      select 1
      from public.pets
      where pets.id::text = (storage.foldername(name))[1]
        and pets.owner_id = auth.uid()
    )
  );

create policy "Clients update own pet images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'pet-images'
    and exists (
      select 1
      from public.pets
      where pets.id::text = (storage.foldername(name))[1]
        and pets.owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'pet-images'
    and exists (
      select 1
      from public.pets
      where pets.id::text = (storage.foldername(name))[1]
        and pets.owner_id = auth.uid()
    )
  );

create policy "Admins manage pet images"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'pet-images' and public.is_admin())
  with check (bucket_id = 'pet-images' and public.is_admin());

create policy "Authenticated read pet document files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'pet-documents'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.pets
        where pets.id::text = (storage.foldername(name))[1]
          and pets.owner_id = auth.uid()
      )
    )
  );

create policy "Clients upload own pet document files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'pet-documents'
    and exists (
      select 1
      from public.pets
      where pets.id::text = (storage.foldername(name))[1]
        and pets.owner_id = auth.uid()
    )
  );

create policy "Clients delete own pet document files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'pet-documents'
    and owner = auth.uid()
    and exists (
      select 1
      from public.pets
      where pets.id::text = (storage.foldername(name))[1]
        and pets.owner_id = auth.uid()
    )
  );

create policy "Admins manage pet document files"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'pet-documents' and public.is_admin())
  with check (bucket_id = 'pet-documents' and public.is_admin());

-- Para convertir una cuenta existente en veterinario/admin:
-- update public.profiles set role = 'admin' where id = 'UUID_DEL_USUARIO';
