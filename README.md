# Plastic Material Manager

A small, focused stock + client + packing-bill management system for a plastic
material business. Built as an MVP: five main pages, real multi-user
collaboration, and stock math that can never go wrong.

## What's inside

- **Dashboard** — available stock, today's activity, low-stock warnings, recent bills
- **Stock** — add/edit/delete stock batches, search & filter, low-stock badges
- **Clients** — add/edit/delete clients, view a client's packing history
- **Packing** — create a packing bill against a stock batch, save & print, reprint later
- **History** — a simple activity feed of who did what and when

Every user shares the same permissions (no roles). Records track `created_by`
/ `updated_by` / timestamps so the UI can show "Added by Rahul". Multiple
people can use the app at once and see each other's changes live via Supabase
Realtime.

## Tech stack

| Layer     | Choice                                   |
|-----------|-------------------------------------------|
| Frontend  | React + Vite + Tailwind CSS + Lucide icons |
| Backend   | Node.js + Express                         |
| Database  | Supabase (PostgreSQL)                     |
| Realtime  | Supabase Realtime (Postgres change feed)  |
| Auth      | Username/password, bcrypt + JWT in an httpOnly cookie |

```
project-root/
  client/     React frontend (Vite)
  server/     Express API
  database/   schema.sql + seed.sql
```

## Key design decisions (and why)

- **Packing bills are immutable.** There's no edit/delete for a packing bill.
  Once material leaves via a packing bill, changing or deleting that record
  after the fact is where stock math tends to go wrong in small systems like
  this (partial edits, forgotten reversals, double-deductions). Instead, bills
  can be **reprinted** any time from the Packing page or a client's history.
  If a bill was genuinely a mistake, the practical fix is a new stock entry
  (a correction) rather than silently rewriting history — this also keeps the
  activity log honest.
- **Stock deduction and bill creation happen in one atomic database
  transaction** (`create_packing_bill` in `schema.sql`), with the stock row
  locked (`FOR UPDATE`) during the check. Two users packing from the same
  batch at the same moment can't both succeed and push stock negative — the
  second request is correctly rejected if there isn't enough left.
- **All Supabase access goes through the Express backend using the service
  role key.** The browser never sees that key. The frontend's Supabase client
  uses only the public anon key, and only to listen for realtime change
  events (not to read/write real data) — see the RLS section below.
- **Products are created on the fly** when you type a new name while adding
  stock, so there's no separate "manage products" screen to maintain.
- Kept deliberately simple: no accounting, GST, payments, or supplier
  modules, and no role-based permissions, per the brief.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), create a new project.
2. In **Project Settings → API**, copy:
   - `Project URL` → used as `SUPABASE_URL` (backend) and `VITE_SUPABASE_URL` (frontend)
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (backend **only**, never the frontend)
   - `anon public` key → `VITE_SUPABASE_ANON_KEY` (frontend, safe to expose)

## 2. Run the database scripts

In the Supabase dashboard, open **SQL Editor**:

1. Paste the full contents of `database/schema.sql` and run it.
2. Paste the full contents of `database/seed.sql` and run it.

This creates all tables, the atomic packing function, RLS policies, and adds
demo data (see below).

## 3. Configure environment variables

**Backend** — copy `server/.env.example` to `server/.env` and fill in:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=some-long-random-string
PORT=4000
CORS_ORIGIN=http://localhost:5173
LOW_STOCK_THRESHOLD_KG=50
```

**Frontend** — copy `client/.env.example` to `client/.env`:

```
VITE_API_URL=http://localhost:4000/api
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

(If you skip the two `VITE_SUPABASE_*` values, the app still works perfectly
— it just won't live-refresh automatically when another user makes a change;
you'd refresh the page to see updates instead.)

## 4. Start the backend

```
cd server
npm install
npm run dev
```

API runs at `http://localhost:4000`.

## 5. Start the frontend

```
cd client
npm install
npm run dev
```

App runs at `http://localhost:5173`.

## 6. Log in

Demo users (seeded by `seed.sql`), all with password **`password123`**:

- `rahul`
- `parth`
- `admin`

## 7. Test the stock flow

1. Log in as `rahul`.
2. Go to **Stock → Add stock**: Product "Plastic Material A", Size "2 inch",
   Weight 500, Price 120, Date today.
3. Confirm it appears with **Available: 500 KG**.

## 8. Test packing + printing

1. Go to **Clients → Add client**: "ABC Industries".
2. Go to **Packing → New packing bill**: Client "ABC Industries", Product
   "Plastic Material A", Size "2 inch", Quantity 3, Weight 90, Date today.
3. Click **Save & Print** — the bill saves, gets a number like `PB-0002`,
   the print dialog opens, and the printed page shows only the bill (no app
   navigation).
4. Back on **Stock**, confirm available stock is now **410 KG**.
5. Try packing 1000 KG from the same batch — it should be rejected with
   "Insufficient stock available", and nothing should change.
6. Open **History** and confirm the packing action is logged under Rahul's name.

## 9. Test multi-user realtime sync

1. Open a second browser (or incognito window) and log in as `parth`.
2. In the first window, add stock or create a packing bill.
3. The second window's Dashboard/Stock/Packing pages should update within a
   moment, without a manual refresh.

## 10. Test the mobile layout

Resize the browser (or open on a phone) — the app switches to a compact
header, bottom navigation bar, full-width cards instead of tables, and a
floating add button, rather than a shrunk desktop layout.

## API overview

```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/dashboard

GET    /api/stock
POST   /api/stock
PUT    /api/stock/:id
DELETE /api/stock/:id
GET    /api/stock/products/all

GET    /api/clients
POST   /api/clients
GET    /api/clients/:id
PUT    /api/clients/:id
DELETE /api/clients/:id

GET    /api/packing
POST   /api/packing
GET    /api/packing/:id

GET    /api/activity
```

All routes except `/api/auth/login` and `/api/health` require a valid session
cookie.

## Notes on Row Level Security

The backend always uses the Supabase **service role** key, which bypasses
RLS, so every real read/write is enforced by the Express API's own validation
— not by RLS. RLS is still enabled on every table for defense in depth. Four
tables (`stock_entries`, `clients`, `packing_bills`, `activity_logs`) have a
read-only `select` policy for the `anon` role, which exists solely so the
frontend's Realtime subscription (connected with the public anon key) is
allowed to receive change notifications. The frontend never reads business
data directly from Supabase — every actual data read/write goes through the
Express API.
