-- Local only: do not run until owner approves schema deployment.
-- Adds order snapshots and a bulk order RPC for the cart.
begin;

alter table public.orders add column if not exists payment_method text not null default 'cod';
alter table public.orders add column if not exists bosta_status text;
alter table public.orders add column if not exists bosta_delivery_id text;
alter table public.orders add column if not exists bosta_tracking_number text;
alter table public.orders add column if not exists bosta_business_reference text;
alter table public.orders add column if not exists bosta_last_event jsonb;
alter table public.orders add column if not exists bosta_created_at timestamptz;
alter table public.orders add column if not exists bosta_webhook_at timestamptz;
alter table public.orders add column if not exists customer_access_token text;
alter table public.site_settings add column if not exists bosta_default_package_type text not null default 'SMALL';

create unique index if not exists orders_customer_access_token_unique
  on public.orders (customer_access_token)
  where customer_access_token is not null;

create or replace function public.create_order_with_stock_bulk(p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id bigint;
  item jsonb;
  product_id bigint;
  quantity integer;
  current_product public.products%rowtype;
  requested_price numeric;
  actual_price numeric;
  access_token text;
begin
  if p_order is null
     or jsonb_typeof(p_order->'items') <> 'array'
     or jsonb_array_length(p_order->'items') = 0
     or nullif(trim(p_order->>'customer_name'), '') is null
     or not (p_order->>'customer_phone' ~ '^01[0125][0-9]{8}$')
     or nullif(trim(p_order->>'governorate'), '') is null
     or length(trim(coalesce(p_order->>'address', ''))) < 5 then
    raise exception 'invalid order';
  end if;

  for item in select value from jsonb_array_elements(p_order->'items') loop
    product_id := nullif(item->>'product_id', '')::bigint;
    quantity := greatest(1, coalesce((item->>'qty')::integer, 1));
    select * into current_product from public.products where id = product_id for update;
    if not found or current_product.is_active is distinct from true or coalesce(current_product.stock, 0) < quantity then
      raise exception 'product unavailable or insufficient stock';
    end if;
    requested_price := coalesce((item->>'price')::numeric, 0);
    actual_price := coalesce(nullif(current_product.sale_price, 0), current_product.price, 0);
    if requested_price <> actual_price then
      raise exception 'product price changed';
    end if;
  end loop;

  for item in select value from jsonb_array_elements(p_order->'items') loop
    product_id := nullif(item->>'product_id', '')::bigint;
    quantity := greatest(1, coalesce((item->>'qty')::integer, 1));
    update public.products
       set stock = stock - quantity, updated_at = now()
     where id = product_id;
  end loop;

  access_token := encode(gen_random_bytes(18), 'hex');
  insert into public.orders (
    customer_name, customer_phone, governorate, area, address,
    subtotal, shipping_fee, total, items, status, payment_method,
    customer_access_token
  ) values (
    p_order->>'customer_name', p_order->>'customer_phone', p_order->>'governorate',
    p_order->>'area', p_order->>'address',
    coalesce((p_order->>'subtotal')::numeric, 0),
    coalesce((p_order->>'shipping_fee')::numeric, 0),
    coalesce((p_order->>'total')::numeric, 0),
    p_order->'items', 'جديد', 'cod', access_token
  ) returning id into new_id;

  return jsonb_build_object('order_id', new_id, 'access_token', access_token);
end;
$$;

revoke all on function public.create_order_with_stock_bulk(jsonb) from public;
grant execute on function public.create_order_with_stock_bulk(jsonb) to anon, authenticated;

commit;
