-- Kew Garden Flowers Order Manager - Database Migration
-- Run this SQL in your Supabase SQL Editor

-- Enable necessary extensions
create extension if not exists "pgcrypto";

-- 1. Create clients table (if not exists)
create table if not exists public.clients (
  id uuid default gen_random_uuid() primary key,
  client_code text unique,
  client_name text not null,
  client_phone text,
  client_email text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Create or update orders table
-- If the table exists, this will add missing columns
do $$ 
begin
  -- Add client_id if it doesn't exist
  if not exists (select 1 from information_schema.columns 
                 where table_name = 'orders' and column_name = 'client_id') then
    alter table public.orders add column client_id uuid references public.clients(id);
  end if;
  
  -- Add bouquet_type if it doesn't exist
  if not exists (select 1 from information_schema.columns 
                 where table_name = 'orders' and column_name = 'bouquet_type') then
    alter table public.orders add column bouquet_type text;
  end if;
  
  -- Add price_hkd if it doesn't exist
  if not exists (select 1 from information_schema.columns 
                 where table_name = 'orders' and column_name = 'price_hkd') then
    alter table public.orders add column price_hkd decimal(10,2);
  end if;
  
  -- Add delivery_time_slot if it doesn't exist
  if not exists (select 1 from information_schema.columns 
                 where table_name = 'orders' and column_name = 'delivery_time_slot') then
    alter table public.orders add column delivery_time_slot text;
  end if;
  
  -- Add card_message if it doesn't exist
  if not exists (select 1 from information_schema.columns 
                 where table_name = 'orders' and column_name = 'card_message') then
    alter table public.orders add column card_message text;
  end if;
end $$;

-- 3. Create bouquet_types table
create table if not exists public.bouquet_types (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  price_hkd decimal(10,2),
  description text,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Insert default bouquet types (only if table is empty)
insert into public.bouquet_types (name, price_hkd, description, sort_order)
select * from (
  values 
    ('Peony Sunrise', 1500.00, 'Elegant peonies in warm sunrise tones', 1),
    ('Lavender Mist', 1200.00, 'Delicate lavender and purple blooms', 2),
    ('Autumn Ember', 1350.00, 'Rich autumnal colors with seasonal flowers', 3),
    ('Emerald Cascade', 1600.00, 'Lush greenery with white accents', 4),
    ('Rose Quartz', 1450.00, 'Romantic pink and blush roses', 5)
) as defaults(name, price_hkd, description, sort_order)
where not exists (select 1 from public.bouquet_types limit 1);

-- 4. Create invoices table
create table if not exists public.invoices (
  id uuid default gen_random_uuid() primary key,
  invoice_number text unique not null,
  client_id uuid references public.clients(id),
  client_name text not null,
  client_email text,
  client_phone text,
  invoice_date date not null default current_date,
  due_date date,
  subtotal decimal(10,2) not null default 0,
  tax decimal(10,2) default 0,
  total decimal(10,2) not null default 0,
  status text not null default 'draft',
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  sent_at timestamp with time zone,
  paid_at timestamp with time zone,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 5. Create invoice_items table
create table if not exists public.invoice_items (
  id uuid default gen_random_uuid() primary key,
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  order_id uuid references public.orders(id),
  description text not null,
  quantity integer default 1,
  unit_price decimal(10,2) not null,
  amount decimal(10,2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 6. Create indexes for better performance
create index if not exists idx_orders_client_id on public.orders(client_id);
create index if not exists idx_orders_delivery_date on public.orders(delivery_date);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_invoices_client_id on public.invoices(client_id);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoices_invoice_date on public.invoices(invoice_date);
create index if not exists idx_invoice_items_invoice_id on public.invoice_items(invoice_id);
create index if not exists idx_invoice_items_order_id on public.invoice_items(order_id);

-- 7. Enable Row Level Security
alter table public.clients enable row level security;
alter table public.bouquet_types enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

-- 8. Create RLS Policies

-- Clients policies
drop policy if exists "Authenticated manage clients" on public.clients;
create policy "Authenticated manage clients" on public.clients
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Bouquet types policies (read-only for public, manage for authenticated)
drop policy if exists "Public read bouquet types" on public.bouquet_types;
create policy "Public read bouquet types" on public.bouquet_types
  for select
  using (is_active = true);

drop policy if exists "Authenticated manage bouquet types" on public.bouquet_types;
create policy "Authenticated manage bouquet types" on public.bouquet_types
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Invoices policies
drop policy if exists "Authenticated manage invoices" on public.invoices;
create policy "Authenticated manage invoices" on public.invoices
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Invoice items policies
drop policy if exists "Authenticated manage invoice items" on public.invoice_items;
create policy "Authenticated manage invoice items" on public.invoice_items
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 9. Create function to generate invoice numbers
create or replace function generate_invoice_number()
returns text as $$
declare
  next_number integer;
  invoice_num text;
begin
  -- Get the next invoice number based on count
  select count(*) + 1 into next_number from public.invoices;
  
  -- Format: INV-YYYYMM-0001
  invoice_num := 'INV-' || to_char(current_date, 'YYYYMM') || '-' || lpad(next_number::text, 4, '0');
  
  -- Check if it exists, if so increment
  while exists (select 1 from public.invoices where invoice_number = invoice_num) loop
    next_number := next_number + 1;
    invoice_num := 'INV-' || to_char(current_date, 'YYYYMM') || '-' || lpad(next_number::text, 4, '0');
  end loop;
  
  return invoice_num;
end;
$$ language plpgsql;

-- 10. Create trigger to auto-update updated_at timestamps
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Apply triggers
drop trigger if exists update_clients_updated_at on public.clients;
create trigger update_clients_updated_at
  before update on public.clients
  for each row
  execute function update_updated_at_column();

drop trigger if exists update_invoices_updated_at on public.invoices;
create trigger update_invoices_updated_at
  before update on public.invoices
  for each row
  execute function update_updated_at_column();

-- Migration complete!
-- You can now use the enhanced order manager with invoicing and bouquet management.


