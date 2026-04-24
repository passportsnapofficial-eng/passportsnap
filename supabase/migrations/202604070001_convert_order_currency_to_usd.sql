alter table public.orders
alter column payment_currency set default 'USD';

update public.orders
set payment_currency = 'USD'
where payment_currency is null
   or upper(payment_currency) <> 'USD';
