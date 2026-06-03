create table if not exists public.admin_site_settings (
  id text primary key,
  premium_retouch_fee numeric(10, 2) not null default 7.99 check (premium_retouch_fee >= 0),
  watermark_text text not null default 'PASSPORTSNAP',
  watermark_enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_document_settings (
  document_id text primary key,
  price numeric(10, 2) not null check (price >= 0),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_review_requests (
  id text primary key,
  target_id text not null,
  user_key text,
  user_email text,
  customer_name text not null,
  document_label text not null,
  transaction_reference text not null,
  request_type text not null check (request_type in ('manual_review', 'premium_retouch')),
  status text not null default 'requested' check (status in ('requested', 'queued', 'in_progress', 'completed', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assignee text,
  note text,
  fulfillment_note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

drop trigger if exists admin_site_settings_set_updated_at on public.admin_site_settings;
create trigger admin_site_settings_set_updated_at
before update on public.admin_site_settings
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists admin_document_settings_set_updated_at on public.admin_document_settings;
create trigger admin_document_settings_set_updated_at
before update on public.admin_document_settings
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists admin_review_requests_set_updated_at on public.admin_review_requests;
create trigger admin_review_requests_set_updated_at
before update on public.admin_review_requests
for each row
execute function public.set_current_timestamp_updated_at();

insert into public.admin_site_settings (id, premium_retouch_fee, watermark_text, watermark_enabled)
values ('default', 7.99, 'PASSPORTSNAP', true)
on conflict (id) do nothing;

insert into public.admin_document_settings (document_id, price, is_active, display_order)
values
  ('us-passport', 12.95, true, 0),
  ('us-baby-passport', 12.95, true, 1),
  ('canada-passport', 15.99, true, 2),
  ('uk-passport', 12.99, true, 3),
  ('schengen-visa', 12.99, true, 4),
  ('india-passport', 13.99, true, 5),
  ('japan-visa', 14.99, true, 6),
  ('china-passport', 13.99, true, 7)
on conflict (document_id) do nothing;

alter table public.admin_site_settings enable row level security;
alter table public.admin_document_settings enable row level security;
alter table public.admin_review_requests enable row level security;
