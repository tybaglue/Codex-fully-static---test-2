# KGF Orders · Static Supabase Frontend

A minimal, mobile-first florist order manager you can deploy on GitHub Pages. The UI is fully
static (HTML/CSS/JS) and connects straight to Supabase for authentication and database needs.

## Features

- **Manual order capture** – Add, edit, or delete orders from the dashboard, optimised for
  quick updates on mobile.
- **Client intake form** – Share a public order form (`order.html`) that saves requests
  directly into the Supabase `orders` table.
- **Status tracking** – View orders by status (All, Unfulfilled, Fulfilled) and toggle
  completion states in a couple of taps.
- **Client overview** – Automatically grouped client list with the most recent order handy.
- **Delivery calendar** – Upcoming deliveries laid out in a simple agenda list.
- **Optional email auth** – Flip on Supabase magic-link authentication when you are ready to
  restrict access to the dashboard.

## Directory structure

```
├─ index.html          # Florist dashboard
├─ order.html          # Shareable client order form
├─ styles.css          # Shared styling (brand-aligned, mobile-first)
├─ js/
│  ├─ app.js           # Dashboard logic (orders, clients, calendar)
│  ├─ order-form.js    # Client form submission handler
│  ├─ config.js        # Supabase credentials (placeholder values)
│  └─ config.example.js
└─ README.md
```

## 1. Supabase setup

1. **Create a new Supabase project.** Copy the project URL and the public anon key for later.
2. **Create the `orders` table`** (SQL below). Adjust field lengths to your preference.
   ```sql
   create table if not exists public.orders (
     id uuid default gen_random_uuid() primary key,
     client_name text not null,
     client_phone text not null,
     client_email text,
     delivery_date date,
     delivery_address text not null,
     order_details text not null,
     internal_notes text,
     status text not null default 'pending',
     submission_source text default 'manual',
     created_at timestamp with time zone default timezone('utc'::text, now())
   );
   ```
   > If you see an error about `gen_random_uuid`, enable the `pgcrypto` extension from the
   > Supabase dashboard (`Database → Extensions`).
3. **Enable Row Level Security** on `orders` and add these starter policies:
   - `Allow public insert for client form`
     ```sql
     create policy "Public insert" on public.orders
       for insert
       with check (true);
     ```
   - `Authenticated read/update/delete`
     ```sql
     create policy "Authenticated manage" on public.orders
       for all
       using (auth.role() = 'authenticated')
       with check (auth.role() = 'authenticated');
     ```
   Tighten the public insert policy later (e.g., only allow `submission_source = 'client_form'`).
4. (Optional) **Enable Email OTP auth** if you want dashboard sign-in. Update
   `ALLOWED_EMAIL_DOMAINS` in `js/config.js` to restrict who can log in.

## 2. Configure the frontend

1. Duplicate `js/config.example.js` → `js/config.js` (already present with placeholders).
2. Replace the placeholder values with your Supabase credentials:
   ```js
   export const SUPABASE_URL = "https://<project>.supabase.co";
   export const SUPABASE_ANON_KEY = "<public-anon-key>";
   export const ENABLE_AUTH = false; // flip to true when ready
   export const ALLOWED_EMAIL_DOMAINS = ["kewgardenflowers.com"];
   ```
3. (Optional) expose these via `window.SUPABASE_URL` etc. inside GitHub Pages if you prefer
   injecting from Secrets.

> ℹ️ Until you update the config values, the UI will load but will display a toast reminding you
> to supply Supabase credentials.

## 3. Deploy to GitHub Pages

1. Commit the repository to GitHub.
2. In **Settings → Pages**, choose the `main` branch and `/ (root)` directory.
3. Wait for Pages to publish, then visit `https://<username>.github.io/<repo>/index.html`.
4. Share `https://<username>.github.io/<repo>/order.html` with clients. The dashboard includes a
   “Copy client order link” button for convenience.

## 4. Using the dashboard

- **Manual orders**: tap “Add manual order”, fill in the details, and save. Tap any card to
  edit or toggle status.
- **Client list**: auto-compiles based on phone/email—tap a client to jump to their latest
  order.
- **Calendar**: sorted list of all orders with a delivery date.
- **Auth**: when `ENABLE_AUTH` is `true`, users must request a magic link before accessing the
  dashboard. Use Supabase Auth logs to monitor sign-ins.

## 5. Roadmap ideas

- Sync delivery dates to Google Calendar via a Supabase Edge Function.
- Generate invoices from orders (Zoho Books integration or PDF templates).
- Add product presets, bouquet recipes, or cost tracking fields.

Enjoy your streamlined florist workflow! 🌿
