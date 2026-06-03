alter table public.admin_site_settings
  add column if not exists digital_print_2_copy_fee numeric(10, 2) not null default 3.00,
  add column if not exists digital_print_4_copy_fee numeric(10, 2) not null default 5.00,
  add column if not exists digital_print_6_copy_fee numeric(10, 2) not null default 7.00;

update public.admin_site_settings
set
  digital_print_2_copy_fee = coalesce(digital_print_2_copy_fee, digital_print_fee, 3.00),
  digital_print_4_copy_fee = coalesce(digital_print_4_copy_fee, 5.00),
  digital_print_6_copy_fee = coalesce(digital_print_6_copy_fee, 7.00)
where id = 'default';

alter table public.orders
  add column if not exists print_copies integer not null default 2;
