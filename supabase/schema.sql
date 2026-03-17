-- ============================================================
-- Tominh App — Database Schema
-- Supabase (PostgreSQL)
-- ============================================================

-- 1. ENUMS
-- ------------------------------------------------------------

create type user_role as enum ('admin', 'customer');

create type order_status as enum (
  'pending',
  'confirmed',
  'shipping',
  'delivered',
  'cancelled'
);

create type payment_status as enum ('unpaid', 'paid', 'refunded');

-- 2. TABLES
-- ------------------------------------------------------------

-- Profiles (linked to auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'customer',
  full_name text not null default '',
  phone text,
  address text,
  created_at timestamptz not null default now()
);

-- Categories
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references categories(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Products
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  price numeric(12,2) not null default 0,
  compare_price numeric(12,2),
  images text[] not null default '{}',
  stock integer not null default 0,
  sku text,
  category_id uuid references categories(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Orders
create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  status order_status not null default 'pending',
  total numeric(12,2) not null default 0,
  shipping_address text,
  shipping_phone text,
  shipping_name text,
  payment_status payment_status not null default 'unpaid',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Order Items
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity integer not null default 1,
  unit_price numeric(12,2) not null
);

-- Inventory Logs
create table inventory_logs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  change_amount integer not null,
  reason text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 3. INDEXES
-- ------------------------------------------------------------

create index idx_products_category_id on products(category_id);
create index idx_products_is_active on products(is_active);
create index idx_orders_user_id on orders(user_id);
create index idx_orders_status on orders(status);
create index idx_orders_created_at on orders(created_at);
create index idx_inventory_logs_product_id on inventory_logs(product_id);

-- 4. HELPER FUNCTION: check if current user is admin
-- ------------------------------------------------------------

create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

-- 5. ROW LEVEL SECURITY
-- ------------------------------------------------------------

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table inventory_logs enable row level security;

-- profiles --
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Admin can view all profiles"
  on profiles for select
  using (is_admin());

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Admin can update all profiles"
  on profiles for update
  using (is_admin());

-- Allow trigger to insert profiles
create policy "Service can insert profiles"
  on profiles for insert
  with check (auth.uid() = id);

-- categories --
create policy "Anyone can read categories"
  on categories for select
  using (true);

create policy "Admin can insert categories"
  on categories for insert
  with check (is_admin());

create policy "Admin can update categories"
  on categories for update
  using (is_admin());

create policy "Admin can delete categories"
  on categories for delete
  using (is_admin());

-- products --
create policy "Anyone can read active products"
  on products for select
  using (is_active = true or is_admin());

create policy "Admin can insert products"
  on products for insert
  with check (is_admin());

create policy "Admin can update products"
  on products for update
  using (is_admin());

create policy "Admin can delete products"
  on products for delete
  using (is_admin());

-- orders --
create policy "Customers can view own orders"
  on orders for select
  using (auth.uid() = user_id);

create policy "Admin can view all orders"
  on orders for select
  using (is_admin());

create policy "Customers can create own orders"
  on orders for insert
  with check (auth.uid() = user_id);

create policy "Admin can update orders"
  on orders for update
  using (is_admin());

-- order_items --
create policy "Users can view own order items"
  on order_items for select
  using (
    exists (
      select 1 from orders
      where orders.id = order_items.order_id
        and (orders.user_id = auth.uid() or is_admin())
    )
  );

create policy "Users can insert own order items"
  on order_items for insert
  with check (
    exists (
      select 1 from orders
      where orders.id = order_items.order_id
        and orders.user_id = auth.uid()
    )
  );

create policy "Admin can update order items"
  on order_items for update
  using (is_admin());

create policy "Admin can delete order items"
  on order_items for delete
  using (is_admin());

-- inventory_logs --
create policy "Admin can read inventory logs"
  on inventory_logs for select
  using (is_admin());

create policy "Admin can insert inventory logs"
  on inventory_logs for insert
  with check (is_admin());

-- 6. TRIGGER: auto-create profile on signup
-- ------------------------------------------------------------

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    'customer',
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user();

-- 7. AUTO-UPDATE updated_at
-- ------------------------------------------------------------

create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_products_updated_at
  before update on products
  for each row
  execute function update_updated_at();

create trigger set_orders_updated_at
  before update on orders
  for each row
  execute function update_updated_at();
