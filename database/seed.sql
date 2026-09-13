-- ============================================================
-- Demo / seed data
-- Run AFTER schema.sql. Safe to re-run (uses ON CONFLICT guards).
-- Demo login for every seeded user: password = "password123"
-- ============================================================

-- Users --------------------------------------------------------
-- crypt()/gen_salt('bf') produces a standard $2a$ bcrypt hash that
-- bcryptjs on the Node backend can verify directly.
insert into users (username, password_hash, display_name)
values
  ('rahul', crypt('password123', gen_salt('bf')), 'Rahul'),
  ('parth', crypt('password123', gen_salt('bf')), 'Parth'),
  ('dhruv', crypt('password123', gen_salt('bf')), 'dhruv')
on conflict (username) do nothing;

-- Products & Materials ---------------------------------------------
-- type defaults to 'product' if omitted, so existing rows/tests are
-- unaffected. One 'material' row is included so you can see the
-- Product vs Material distinction and confirm materials are
-- excluded from the packing bill's product picker.
insert into products (name, type) values
  ('Plastic Material A', 'product'),
  ('Plastic Material B', 'product'),
  ('Raw HDPE Granules', 'material')
on conflict (name) do nothing;

-- Clients --------------------------------------------------------
insert into clients (name, phone, address, created_by)
select 'ABC Industries', '9876543210', 'MIDC, Pune', u.id
from users u where u.username = 'rahul'
on conflict do nothing;

insert into clients (name, phone, address, created_by)
select 'XYZ Plastics', '9998887770', 'GIDC, Ahmedabad', u.id
from users u where u.username = 'parth'
on conflict do nothing;

-- Stock entries ----------------------------------------------------
insert into stock_entries (product_id, size, weight_kg, available_kg, price_per_kg, entry_date, created_by)
select p.id, '1 inch', 300, 300, 110, current_date - 3, u.id
from products p, users u
where p.name = 'Plastic Material A' and u.username = 'rahul'
on conflict do nothing;

insert into stock_entries (product_id, size, weight_kg, available_kg, price_per_kg, entry_date, created_by)
select p.id, '2 inch', 500, 500, 120, current_date - 1, u.id
from products p, users u
where p.name = 'Plastic Material A' and u.username = 'rahul'
on conflict do nothing;

insert into stock_entries (product_id, size, weight_kg, available_kg, price_per_kg, entry_date, created_by)
select p.id, '3 inch', 150, 150, 135, current_date, u.id
from products p, users u
where p.name = 'Plastic Material B' and u.username = 'parth'
on conflict do nothing;

insert into stock_entries (product_id, size, weight_kg, available_kg, price_per_kg, entry_date, created_by)
select p.id, 'Bulk', 200, 200, 85, current_date - 2, u.id
from products p, users u
where p.name = 'Raw HDPE Granules' and u.username = 'rahul'
on conflict do nothing;

-- A sample packing bill against the "2 inch" A stock, using the
-- same atomic function the API uses, so stock math stays correct.
select create_packing_bill(
  (select id from clients where name = 'ABC Industries'),
  (select id from stock_entries se join products p on p.id = se.product_id
     where p.name = 'Plastic Material A' and se.size = '2 inch' limit 1),
  3,
  90,
  current_date,
  (select id from users where username = 'rahul')
);

-- Matching activity log entries for the seed actions above --------
insert into activity_logs (user_id, action, entity_type, entity_id, description)
select u.id, 'stock.create', 'stock', se.id,
       u.display_name || ' added ' || se.weight_kg || ' KG ' || p.name || ' (' || se.size || ')'
from stock_entries se
join products p on p.id = se.product_id
join users u on u.id = se.created_by;

insert into activity_logs (user_id, action, entity_type, entity_id, description)
select u.id, 'client.create', 'client', c.id, u.display_name || ' added client ' || c.name
from clients c
join users u on u.id = c.created_by;

insert into activity_logs (user_id, action, entity_type, entity_id, description)
select u.id, 'packing.create', 'packing', pb.id,
       u.display_name || ' created packing ' || pb.bill_number || ' (' || pb.weight_kg || ' KG)'
from packing_bills pb
join users u on u.id = pb.created_by;
