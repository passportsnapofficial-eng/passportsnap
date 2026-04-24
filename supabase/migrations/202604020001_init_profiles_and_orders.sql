create extension if not exists pgcrypto;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  phone text,
  role text not null default 'user',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.orders (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  order_date timestamptz not null default timezone('utc', now()),
  status text not null,
  subtotal numeric(10, 2) not null default 0,
  premium_retouch boolean not null default false,
  premium_fee numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  payment_currency text not null default 'USD',
  payment_channel text,
  payment_gateway_response text,
  payment_reference text not null unique,
  payment_verified_at timestamptz,
  service_summary text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row
execute function public.set_current_timestamp_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    'user'
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

insert into public.profiles (id, email, full_name, phone, role)
select
  users.id,
  coalesce(users.email, ''),
  nullif(users.raw_user_meta_data ->> 'full_name', ''),
  nullif(users.raw_user_meta_data ->> 'phone', ''),
  'user'
from auth.users as users
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Profiles can view own profile" on public.profiles;
create policy "Profiles can view own profile"
on public.profiles
for select
to authenticated
using (auth.uid() is not null and auth.uid() = id);

drop policy if exists "Profiles can insert own profile" on public.profiles;
create policy "Profiles can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() is not null and auth.uid() = id);

drop policy if exists "Profiles can update own profile" on public.profiles;
create policy "Profiles can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() is not null and auth.uid() = id)
with check (auth.uid() is not null and auth.uid() = id);

drop policy if exists "Orders can view own orders" on public.orders;
create policy "Orders can view own orders"
on public.orders
for select
to authenticated
using (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "Orders can insert own orders" on public.orders;
create policy "Orders can insert own orders"
on public.orders
for insert
to authenticated
with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "Orders can update own orders" on public.orders;
create policy "Orders can update own orders"
on public.orders
for update
to authenticated
using (auth.uid() is not null and auth.uid() = user_id)
with check (auth.uid() is not null and auth.uid() = user_id);
