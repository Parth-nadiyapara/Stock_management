-- ============================================================
-- Migration 001
-- 1. Adds Product vs Material distinction to `products`
-- 2. Re-applies the create_packing_bill() ambiguous-column fix
--    (safe to run even if you already applied it separately)
--
-- Safe to run on your EXISTING database. Does not touch or
-- delete any existing rows. Re-runnable.
-- ============================================================

-- ------------------------------------------------------------
-- 1. products.type
-- ------------------------------------------------------------
alter table products
  add column if not exists type text not null default 'product';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_type_check'
  ) then
    alter table products
      add constraint products_type_check check (type in ('product', 'material'));
  end if;
end$$;

create index if not exists idx_products_type on products(type);

-- Every existing product/material row defaults to 'product', so
-- existing stock entries and packing bills keep working exactly
-- as before. Re-classify any of your existing raw materials, e.g.:
--
--   update products set type = 'material' where name = 'Raw HDPE Granules';

-- ------------------------------------------------------------
-- 2. create_packing_bill() - fix ambiguous column references
-- ------------------------------------------------------------
create or replace function create_packing_bill(
  p_client_id      uuid,
  p_stock_entry_id uuid,
  p_quantity       numeric,
  p_weight_kg      numeric,
  p_bill_date      date,
  p_created_by     uuid
)
returns table (
  id             uuid,
  bill_number    text,
  client_id      uuid,
  stock_entry_id uuid,
  product_id     uuid,
  size           text,
  quantity       numeric,
  weight_kg      numeric,
  bill_date      date,
  created_by     uuid,
  created_at     timestamptz
)
language plpgsql
as $$
declare
  v_available    numeric;
  v_product_id   uuid;
  v_size         text;
  v_bill_number  text;
  v_new_id       uuid;
begin
  select se.available_kg, se.product_id, se.size
    into v_available, v_product_id, v_size
    from stock_entries se
   where se.id = p_stock_entry_id
   for update;

  if not found then
    raise exception 'STOCK_NOT_FOUND';
  end if;

  if p_weight_kg <= 0 then
    raise exception 'INVALID_WEIGHT';
  end if;

  if v_available < p_weight_kg then
    raise exception 'INSUFFICIENT_STOCK';
  end if;

  update stock_entries se
     set available_kg = se.available_kg - p_weight_kg
   where se.id = p_stock_entry_id;

  v_bill_number := next_bill_number();

  insert into packing_bills as pb (
    bill_number, client_id, stock_entry_id, product_id, size,
    quantity, weight_kg, bill_date, created_by
  ) values (
    v_bill_number, p_client_id, p_stock_entry_id, v_product_id, v_size,
    p_quantity, p_weight_kg, coalesce(p_bill_date, current_date), p_created_by
  )
  returning pb.id into v_new_id;

  return query
    select pb.id, pb.bill_number, pb.client_id, pb.stock_entry_id, pb.product_id,
           pb.size, pb.quantity, pb.weight_kg, pb.bill_date, pb.created_by, pb.created_at
      from packing_bills pb
     where pb.id = v_new_id;
end;
$$;
