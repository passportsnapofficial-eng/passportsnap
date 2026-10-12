-- Admin switch: when the hat / glasses / face-mask check cannot reach a
-- verdict, true asks the customer to confirm before checkout (safe default),
-- false lets the photo pass on the automatic result alone.
alter table public.admin_site_settings
  add column if not exists customer_confirmation_required boolean not null default true;
