create table if not exists public.admin_order_archive (
  id text primary key,
  payment_reference text unique,
  customer_email text,
  customer_name text,
  order_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists admin_order_archive_set_updated_at on public.admin_order_archive;
create trigger admin_order_archive_set_updated_at
before update on public.admin_order_archive
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.admin_order_archive enable row level security;
