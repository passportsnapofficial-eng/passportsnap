alter table public.orders
  add column if not exists photo_package text not null default 'digital',
  add column if not exists print_package_fee numeric(10, 2) not null default 0,
  add column if not exists compliance_check boolean not null default false,
  add column if not exists compliance_fee numeric(10, 2) not null default 0,
  add column if not exists photo_retouching boolean not null default false,
  add column if not exists photo_retouching_fee numeric(10, 2) not null default 0;

alter table public.admin_site_settings
  add column if not exists digital_print_fee numeric(10, 2) not null default 0,
  add column if not exists compliance_check_fee numeric(10, 2) not null default 5.95,
  add column if not exists photo_retouching_fee numeric(10, 2) not null default 3.95;

alter table public.admin_review_requests
  drop constraint if exists admin_review_requests_request_type_check;

alter table public.admin_review_requests
  add column if not exists fulfilled_image_url text,
  add constraint admin_review_requests_request_type_check
    check (request_type in ('manual_review', 'premium_retouch', 'compliance_check', 'photo_retouching'));
