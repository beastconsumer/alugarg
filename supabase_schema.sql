-- Supabase schema for Aluga Aluga
-- Run this in Supabase SQL Editor

create extension if not exists "pgcrypto";

-- Helper: admin check without RLS recursion
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- Users table
create table if not exists public.users (
  id uuid primary key default auth.uid(),
  name text not null default '',
  phone text not null default '',
  avatar_url text not null default '',
  cpf text not null default '',
  email text not null default '',
  birth_date date,
  role text not null default 'user',
  created_at timestamptz not null default now()
);

alter table public.users add column if not exists cpf text not null default '';
alter table public.users add column if not exists email text not null default '';
alter table public.users add column if not exists birth_date date;
alter table public.users add column if not exists avatar_url text not null default '';

alter table public.users enable row level security;

drop policy if exists "Users manage own profile" on public.users;
drop policy if exists "Admins read all users" on public.users;

create policy "Users manage own profile"
on public.users
for all
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Admins read all users"
on public.users
for select
using (public.is_admin());

-- Login helper (phone-based claim for current session user).
-- NOTE: For production, replace this flow with real OTP auth.
create or replace function public.claim_user_by_phone(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_target public.users%rowtype;
  v_phone_norm text;
begin
  if v_uid is null then
    return jsonb_build_object('found', false, 'reason', 'not_authenticated');
  end if;

  v_phone_norm := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');

  if v_phone_norm = '' then
    return jsonb_build_object('found', false, 'reason', 'invalid_phone');
  end if;

  select *
  into v_target
  from public.users u
  where regexp_replace(coalesce(u.phone, ''), '[^0-9]', '', 'g') = v_phone_norm
  order by u.created_at desc
  limit 1;

  if v_target.id is null then
    return jsonb_build_object('found', false, 'reason', 'not_found');
  end if;

  -- Keep ownership consistent across sessions: migrate rows to current auth uid.
  if v_target.id <> v_uid then
    update public.properties
    set owner_id = v_uid
    where owner_id = v_target.id;

    if to_regclass('public.bookings') is not null then
      update public.bookings
      set renter_id = v_uid
      where renter_id = v_target.id;

      update public.bookings
      set owner_id = v_uid
      where owner_id = v_target.id;
    end if;

    if to_regclass('public.owner_reviews') is not null then
      update public.owner_reviews
      set renter_id = v_uid
      where renter_id = v_target.id;

      update public.owner_reviews
      set owner_id = v_uid
      where owner_id = v_target.id;
    end if;
  end if;

  insert into public.users (id, name, phone, avatar_url, cpf, email, birth_date, role, created_at)
  values (
    v_uid,
    coalesce(v_target.name, ''),
    coalesce(v_target.phone, p_phone),
    coalesce(v_target.avatar_url, ''),
    coalesce(v_target.cpf, ''),
    coalesce(v_target.email, ''),
    v_target.birth_date,
    coalesce(v_target.role, 'user'),
    now()
  )
  on conflict (id) do update
    set name = excluded.name,
        phone = excluded.phone,
        avatar_url = excluded.avatar_url,
        cpf = excluded.cpf,
        email = excluded.email,
        birth_date = excluded.birth_date,
        role = excluded.role;

  -- Remove old profile row after migration to avoid duplicate phone identities.
  if v_target.id <> v_uid then
    delete from public.users where id = v_target.id;
  end if;

  return jsonb_build_object(
    'found', true,
    'source_id', v_target.id::text,
    'role', v_target.role
  );
end;
$$;

grant execute on function public.claim_user_by_phone(text) to anon, authenticated;

-- Login helper for phone/email + password flow:
-- resolve account email by phone, then app uses signInWithPassword(email, senha).
create or replace function public.get_login_email_by_phone(p_phone text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone_norm text;
  v_email text;
begin
  v_phone_norm := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');

  if v_phone_norm = '' then
    return null;
  end if;

  select lower(u.email)
  into v_email
  from public.users u
  where regexp_replace(coalesce(u.phone, ''), '[^0-9]', '', 'g') = v_phone_norm
    and coalesce(u.email, '') <> ''
  order by u.created_at desc
  limit 1;

  return v_email;
end;
$$;

grant execute on function public.get_login_email_by_phone(text) to anon, authenticated;

-- Properties table
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  title text not null,
  description text not null,
  price integer not null,
  rent_type text not null,
  bedrooms integer not null,
  bathrooms integer not null,
  garage_spots integer not null default 0,
  pet_friendly boolean not null default false,
  verified boolean not null default false,
  status text not null default 'pending',
  photos text[] not null default '{}',
  location jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  views_count integer not null default 0
);

alter table public.properties add column if not exists garage_spots integer not null default 0;

create index if not exists properties_status_created_at_idx on public.properties (status, created_at desc);
create index if not exists properties_owner_created_at_idx on public.properties (owner_id, created_at desc);

alter table public.properties enable row level security;

drop policy if exists "Public read approved" on public.properties;
drop policy if exists "Owners manage own properties" on public.properties;
drop policy if exists "Admins manage all properties" on public.properties;

create policy "Public read approved"
on public.properties
for select
using (status = 'approved');

create policy "Owners manage own properties"
on public.properties
for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "Admins manage all properties"
on public.properties
for all
using (public.is_admin())
with check (public.is_admin());

-- Bookings table
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  property_title text not null default '',
  renter_id uuid not null,
  owner_id uuid not null,
  check_in_date timestamptz not null,
  check_out_date timestamptz not null,
  units integer not null default 1,
  base_amount integer not null default 0,
  client_fee_amount integer not null default 0,
  owner_fee_amount integer not null default 0,
  total_paid_by_renter integer not null default 0,
  owner_payout_amount integer not null default 0,
  status text not null default 'pending_payment',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_units_positive check (units >= 1)
);

create index if not exists bookings_renter_created_at_idx on public.bookings (renter_id, created_at desc);
create index if not exists bookings_owner_created_at_idx on public.bookings (owner_id, created_at desc);
create index if not exists bookings_property_dates_idx on public.bookings (property_id, check_in_date, check_out_date);

alter table public.bookings enable row level security;

drop policy if exists "Renters create own bookings" on public.bookings;
drop policy if exists "Renters read own bookings" on public.bookings;
drop policy if exists "Renters update own bookings" on public.bookings;
drop policy if exists "Owners read own bookings" on public.bookings;
drop policy if exists "Owners update own bookings" on public.bookings;
drop policy if exists "Admins manage all bookings" on public.bookings;

create policy "Renters create own bookings"
on public.bookings
for insert
with check (auth.uid() = renter_id);

create policy "Renters read own bookings"
on public.bookings
for select
using (auth.uid() = renter_id);

create policy "Renters update own bookings"
on public.bookings
for update
using (auth.uid() = renter_id)
with check (auth.uid() = renter_id);

create policy "Owners read own bookings"
on public.bookings
for select
using (auth.uid() = owner_id);

create policy "Owners update own bookings"
on public.bookings
for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "Admins manage all bookings"
on public.bookings
for all
using (public.is_admin())
with check (public.is_admin());

-- Owner reviews after stay
create table if not exists public.owner_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique,
  property_id uuid not null,
  renter_id uuid not null,
  owner_id uuid not null,
  rating integer not null default 5,
  tags text[] not null default '{}',
  comment text not null default '',
  created_at timestamptz not null default now(),
  constraint owner_reviews_rating_range check (rating between 1 and 5)
);

create index if not exists owner_reviews_owner_created_at_idx on public.owner_reviews (owner_id, created_at desc);
create index if not exists owner_reviews_booking_idx on public.owner_reviews (booking_id);

alter table public.owner_reviews enable row level security;

drop policy if exists "Renters insert own reviews" on public.owner_reviews;
drop policy if exists "Authenticated read reviews" on public.owner_reviews;
drop policy if exists "Admins manage reviews" on public.owner_reviews;

create policy "Renters insert own reviews"
on public.owner_reviews
for insert
with check (auth.uid() = renter_id);

create policy "Authenticated read reviews"
on public.owner_reviews
for select
using (auth.uid() is not null);

create policy "Admins manage reviews"
on public.owner_reviews
for all
using (public.is_admin())
with check (public.is_admin());

-- Storage policies (bucket: property-images)
-- Create the bucket manually in Supabase Storage as PUBLIC.
drop policy if exists "Public read property images" on storage.objects;
drop policy if exists "Users upload to own folder" on storage.objects;
drop policy if exists "Users update own files" on storage.objects;
drop policy if exists "Users delete own files" on storage.objects;

create policy "Public read property images"
on storage.objects
for select
using (bucket_id = 'property-images');

create policy "Users upload to own folder"
on storage.objects
for insert
with check (
  bucket_id = 'property-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users update own files"
on storage.objects
for update
using (
  bucket_id = 'property-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users delete own files"
on storage.objects
for delete
using (
  bucket_id = 'property-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);
