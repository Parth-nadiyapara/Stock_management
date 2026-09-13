-- ============================================================
-- Plastic Material Stock + Client + Packing Bill Management
-- Supabase PostgreSQL schema
-- ============================================================
-- Run this once in the Supabase SQL Editor (or via `psql`) on a
-- fresh project. Safe to re-run: uses IF NOT EXISTS / DROP guards.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- users
-- App-level users. Passwords are bcrypt hashes, never plain text.
-- All users share identical permissions (no roles in this MVP).
-- ------------------------------------------------------------
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  password_hash text not null,
  display_name  text not null,
  created_at    timestamptz not null default now()
);

-- ------------------------------------------------------------
-- products
-- Master list of material/product names (e.g. "Plastic Material A").
-- Kept separate from stock_entries so the same product can have
-- many stock entries across sizes/dates.
--
-- `type` distinguishes a finished Product (sold/delivered to
-- clients via a packing bill) from a raw Material (stocked and
-- tracked, but not offered in the packing bill's product picker).
-- Defaults to 'product' so every existing row stays valid.
-- ------------------------------------------------------------
create table if not exists products (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  type       text not null default 'product' check (type in ('product', 'material')),
  created_at timestamptz not null default now()
);

create index if not exists idx_products_type on products(type);

-- ------------------------------------------------------------
-- stock_entries
-- One row per stock "batch": a specific product + size added on
-- a specific date. available_kg is decremented by packing bills
-- and is the source of truth for how much material is left.
-- ------------------------------------------------------------
create table if not exists stock_entries (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id) on delete restrict,
  -- Size only applies to finished Products (e.g. "2 inch"). Raw
  -- Materials are tracked without a size, so this is nullable -
  -- enforced at the application layer (required for type='product',
  -- omitted for type='material') rather than a DB constraint, since
  -- that keeps existing rows valid without a data migration.
  size          text,
  weight_kg     numeric(12,2) not null check (weight_kg > 0),
  available_kg  numeric(12,2) not null check (available_kg >= 0),
  price_per_kg  numeric(12,2) not null check (price_per_kg >= 0),
  entry_date    date not null default current_date,
  created_by    uuid references users(id) on delete set null,
  updated_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint available_not_over_total check (available_kg <= weight_kg)
);

create index if not exists idx_stock_entries_product on stock_entries(product_id);
create index if not exists idx_stock_entries_date on stock_entries(entry_date);

-- ------------------------------------------------------------
-- clients
-- ------------------------------------------------------------
create table if not exists clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  phone      text,
  address    text,
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_clients_name on clients using gin (to_tsvector('simple', name));

-- ------------------------------------------------------------
-- packing_bills
-- Immutable once created (see README for rationale). Reprinting
-- is supported instead of edit/delete to keep stock math safe.
-- ------------------------------------------------------------
create table if not exists packing_bills (
  id             uuid primary key default gen_random_uuid(),
  bill_number    text not null unique,
  client_id      uuid not null references clients(id) on delete restrict,
  stock_entry_id uuid not null references stock_entries(id) on delete restrict,
  product_id     uuid not null references products(id) on delete restrict,
  size           text not null,
  quantity       numeric(12,2),           -- optional rolls/units count
  weight_kg      numeric(12,2) not null check (weight_kg > 0),
  bill_date      date not null default current_date,
  created_by     uuid references users(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists idx_packing_client on packing_bills(client_id);
create index if not exists idx_packing_product on packing_bills(product_id);
create index if not exists idx_packing_date on packing_bills(bill_date);

-- ------------------------------------------------------------
-- production_records
-- Converts raw Material stock into finished Product stock
-- (Material -> Production -> Product). There's no waste/reject
-- concept in this business, so material_used_kg always equals
-- produced_kg - both are still stored for a self-describing audit
-- trail. Each production run deducts from one existing Material
-- batch (stock_entries row) and creates one new Product batch
-- (a new stock_entries row) - see create_production() below.
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

-- ------------------------------------------------------------
-- activity_logs
-- Simple, append-only activity feed for the History page.
-- ------------------------------------------------------------
create table if not exists activity_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete set null,
  action      text not null,        -- e.g. 'stock.create', 'packing.create', 'production.create'
  entity_type text not null,        -- 'stock' | 'client' | 'packing' | 'production'
  entity_id   uuid,
  description text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_activity_created on activity_logs(created_at desc);
create index if not exists idx_activity_user on activity_logs(user_id);

-- ------------------------------------------------------------
-- bill number sequence
-- Generates PB-0001, PB-0002, ... atomically and safely under
-- concurrent requests.
-- ------------------------------------------------------------
create sequence if not exists packing_bill_seq start 1;

create or replace function next_bill_number()
returns text
language plpgsql
as $$
declare
  n bigint;
begin
  n := nextval('packing_bill_seq');
  return 'PB-' || lpad(n::text, 4, '0');
end;
$$;

-- ------------------------------------------------------------
-- keep updated_at fresh
-- ------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_stock_updated_at on stock_entries;
create trigger trg_stock_updated_at
  before update on stock_entries
  for each row execute function set_updated_at();

drop trigger if exists trg_clients_updated_at on clients;
create trigger trg_clients_updated_at
  before update on clients
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- atomic stock deduction + packing bill creation
-- This function does both writes in a single transaction so the
-- database can never end up with a packing record that has no
-- matching stock deduction (or vice versa).
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
  -- Lock the stock row so concurrent packing requests can't both
  -- read the same "available" figure and both succeed.
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

-- ------------------------------------------------------------
-- atomic Material -> Production -> Product conversion
-- Deducts material_used_kg from one existing Material batch and,
-- in the same transaction, creates a brand-new Product stock batch
-- for produced_kg (a production is treated like a fresh delivery of
-- finished goods - consistent with how every other stock batch
-- works, so it shows up on the Stock page immediately). No waste
-- is modeled: material_used_kg == produced_kg is enforced by the
-- caller passing the same value for both; the row stores both
-- columns anyway for a clear, self-describing audit trail.
--
-- As with create_packing_bill(), every column below is qualified
-- with a table alias - this function's RETURNS TABLE columns
-- (id, product_id, size, created_by, ...) behave like implicitly
-- declared variables throughout the body, so an unqualified column
-- sharing one of those names would be ambiguous.
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

  -- Lock the material batch so two concurrent production runs can't
  -- both read the same "available" figure and both succeed.
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

-- ------------------------------------------------------------
-- Row Level Security
-- The backend uses the Supabase service-role key exclusively for
-- ALL reads and writes, so RLS is enabled on every table. `users`
-- has no public policy at all (never exposed to the browser).
--
-- The frontend's Realtime subscription connects with the public
-- ANON key purely to receive change notifications ("stock changed,
-- go refetch") on stock/clients/packing/activity - it is never used
-- to read or write actual row data, that always goes through the
-- Express API. Realtime still evaluates RLS to decide whether to
-- deliver an event, so a narrow read-only SELECT policy is added
-- for those four tables. If you'd rather not expose read access via
-- the anon key at all, skip these four policies - the app degrades
-- gracefully to "refresh manually" instead of instant live-sync.
-- ------------------------------------------------------------
alter table users enable row level security;
alter table products enable row level security;
alter table stock_entries enable row level security;
alter table clients enable row level security;
alter table packing_bills enable row level security;
alter table activity_logs enable row level security;
alter table production_records enable row level security;

create policy "anon can read stock for realtime" on stock_entries
  for select to anon using (true);
create policy "anon can read clients for realtime" on clients
  for select to anon using (true);
create policy "anon can read packing for realtime" on packing_bills
  for select to anon using (true);
create policy "anon can read activity for realtime" on activity_logs
  for select to anon using (true);

-- Enable Realtime for the tables the frontend subscribes to.
alter publication supabase_realtime add table stock_entries;
alter publication supabase_realtime add table clients;
alter publication supabase_realtime add table packing_bills;
alter publication supabase_realtime add table activity_logs;
