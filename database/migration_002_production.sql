-- ============================================================
-- Migration 002
-- Adds the Material -> Production -> Product feature.
--
-- Safe to run on your EXISTING database. Does not touch or
-- delete any existing rows. Re-runnable.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Materials no longer require a Size.
--    Existing rows (including existing Material batches that
--    already have a size string) are left exactly as they are -
--    this only relaxes the constraint for new rows going forward.
-- ------------------------------------------------------------
alter table stock_entries alter column size drop not null;

-- ------------------------------------------------------------
-- 2. production_records table
-- ------------------------------------------------------------
create table if not exists production_records (
  id                      uuid primary key default gen_random_uuid(),
  material_stock_entry_id uuid not null references stock_entries(id) on delete restrict,
  material_id             uuid not null references products(id) on delete restrict,
  product_id              uuid not null references products(id) on delete restrict,
  product_stock_entry_id  uuid not null references stock_entries(id) on delete restrict,
  size                    text not null,
  material_used_kg        numeric(12,2) not null check (material_used_kg > 0),
  produced_kg             numeric(12,2) not null check (produced_kg > 0),
  production_date         date not null default current_date,
  created_by              uuid references users(id) on delete set null,
  created_at              timestamptz not null default now()
);

create index if not exists idx_production_material on production_records(material_id);
create index if not exists idx_production_product on production_records(product_id);
create index if not exists idx_production_date on production_records(production_date);

alter table production_records enable row level security;

-- ------------------------------------------------------------
-- 3. create_production() - atomic Material -> Product conversion
-- ------------------------------------------------------------
create or replace function create_production(
  p_material_stock_entry_id uuid,
  p_product_id              uuid,
  p_size                    text,
  p_quantity_kg             numeric,
  p_price_per_kg            numeric,
  p_production_date         date,
  p_created_by              uuid
)
returns table (
  id                      uuid,
  material_stock_entry_id uuid,
  material_id             uuid,
  product_id              uuid,
  product_stock_entry_id  uuid,
  size                    text,
  material_used_kg        numeric,
  produced_kg             numeric,
  production_date         date,
  created_by              uuid,
  created_at              timestamptz
)
language plpgsql
as $$
declare
  v_available      numeric;
  v_material_id    uuid;
  v_material_type  text;
  v_product_type   text;
  v_new_stock_id   uuid;
  v_new_id         uuid;
begin
  if p_quantity_kg <= 0 then
    raise exception 'INVALID_QUANTITY';
  end if;

  if p_size is null or btrim(p_size) = '' then
    raise exception 'SIZE_REQUIRED';
  end if;

  select se.available_kg, se.product_id, p.type
    into v_available, v_material_id, v_material_type
    from stock_entries se
    join products p on p.id = se.product_id
   where se.id = p_material_stock_entry_id
   for update;

  if not found then
    raise exception 'MATERIAL_NOT_FOUND';
  end if;

  if v_material_type <> 'material' then
    raise exception 'NOT_A_MATERIAL';
  end if;

  if v_available < p_quantity_kg then
    raise exception 'INSUFFICIENT_MATERIAL';
  end if;

  select p.type into v_product_type from products p where p.id = p_product_id;

  if v_product_type is null then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  if v_product_type <> 'product' then
    raise exception 'NOT_A_PRODUCT';
  end if;

  update stock_entries se
     set available_kg = se.available_kg - p_quantity_kg
   where se.id = p_material_stock_entry_id;

  insert into stock_entries as se (
    product_id, size, weight_kg, available_kg, price_per_kg, entry_date, created_by
  ) values (
    p_product_id, p_size, p_quantity_kg, p_quantity_kg, coalesce(p_price_per_kg, 0),
    coalesce(p_production_date, current_date), p_created_by
  )
  returning se.id into v_new_stock_id;

  insert into production_records as pr (
    material_stock_entry_id, material_id, product_id, product_stock_entry_id, size,
    material_used_kg, produced_kg, production_date, created_by
  ) values (
    p_material_stock_entry_id, v_material_id, p_product_id, v_new_stock_id, p_size,
    p_quantity_kg, p_quantity_kg, coalesce(p_production_date, current_date), p_created_by
  )
  returning pr.id into v_new_id;

  return query
    select pr.id, pr.material_stock_entry_id, pr.material_id, pr.product_id, pr.product_stock_entry_id,
           pr.size, pr.material_used_kg, pr.produced_kg, pr.production_date, pr.created_by, pr.created_at
      from production_records pr
     where pr.id = v_new_id;
end;
$$;
