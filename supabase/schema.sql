-- =============================================================================
-- Schéma Supabase pour TitanBtp
-- Exécuter ce script dans Supabase : SQL Editor > New query > Coller > Run
-- =============================================================================

-- Extensions utiles (déjà activées par défaut sur Supabase)
-- create extension if not exists "uuid-ossp";

-- -----------------------------------------------------------------------------
-- user_profiles (profil utilisateur après auth)
-- -----------------------------------------------------------------------------
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  logo_url text,
  theme_color text,
  company_address text,
  company_city_postal text,
  company_phone text,
  company_email text,
  company_siret text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "Users can read own profile"
  on public.user_profiles for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.user_profiles for update using (auth.uid() = id);
create policy "Users can insert own profile"
  on public.user_profiles for insert with check (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- clients
-- -----------------------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  street_address text,
  postal_code text,
  city text,
  is_deleted boolean default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_clients_user_id on public.clients(user_id);
alter table public.clients enable row level security;

create policy "Users can manage own clients"
  on public.clients for all using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- client_form_links (liens partageables pour formulaire client public)
-- -----------------------------------------------------------------------------
create table if not exists public.client_form_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_form_links_token on public.client_form_links(token);
create index if not exists idx_client_form_links_user_id on public.client_form_links(user_id);
alter table public.client_form_links enable row level security;

create policy "Users can insert own client form links"
  on public.client_form_links for insert with check (auth.uid() = user_id);

create policy "Users can select own client form links"
  on public.client_form_links for select using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- chantiers
-- -----------------------------------------------------------------------------
create table if not exists public.chantiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nom text not null,
  client_name text not null,
  client_id uuid references public.clients(id) on delete set null,
  date_debut date not null,
  date_fin date,
  duree text not null,
  images jsonb default '[]',
  statut text not null check (statut in ('planifié', 'en cours', 'terminé')),
  notes text,
  type_chantier text,
  notes_avancement text,
  montant_devis numeric,
  is_deleted boolean default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_chantiers_user_id on public.chantiers(user_id);
alter table public.chantiers enable row level security;

create policy "Users can manage own chantiers"
  on public.chantiers for all using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- quotes (devis)
-- -----------------------------------------------------------------------------
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chantier_id uuid references public.chantiers(id) on delete set null,
  client_name text,
  client_email text,
  client_phone text,
  client_address text,
  project_type text,
  project_description text,
  total_ht numeric not null default 0,
  total_ttc numeric not null default 0,
  status text not null check (status in ('brouillon', 'envoyé', 'accepté', 'refusé', 'expiré', 'validé')),
  validity_days int,
  items jsonb default '[]',
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_quotes_user_id on public.quotes(user_id);
create index if not exists idx_quotes_chantier_id on public.quotes(chantier_id);
alter table public.quotes enable row level security;

create policy "Users can manage own quotes"
  on public.quotes for all using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- user_tariffs (tarifs / listes de prix par utilisateur pour devis IA)
-- -----------------------------------------------------------------------------
create table if not exists public.user_tariffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  category text not null default 'autre' check (category in ('matériau', 'service', 'main-d''œuvre', 'location', 'sous-traitance', 'transport', 'équipement', 'fourniture', 'autre')),
  unit text not null default 'u',
  price_ht numeric not null check (price_ht >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_tariffs_user_id on public.user_tariffs(user_id);
alter table public.user_tariffs enable row level security;

create policy "Users can select own user_tariffs"
  on public.user_tariffs for select using (auth.uid() = user_id);
create policy "Users can insert own user_tariffs"
  on public.user_tariffs for insert with check (auth.uid() = user_id);
create policy "Users can update own user_tariffs"
  on public.user_tariffs for update using (auth.uid() = user_id);
create policy "Users can delete own user_tariffs"
  on public.user_tariffs for delete using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- planning_notes (notes du planning / jour)
-- -----------------------------------------------------------------------------
create table if not exists public.planning_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_date date not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, note_date)
);

create index if not exists idx_planning_notes_user_date on public.planning_notes(user_id, note_date);
alter table public.planning_notes enable row level security;

create policy "Users can manage own planning notes"
  on public.planning_notes for all using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- invoices (factures)
-- -----------------------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_number text not null,
  quote_id uuid references public.quotes(id) on delete set null,
  chantier_id uuid references public.chantiers(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null,
  client_email text,
  client_phone text,
  client_address text,
  invoice_date date not null,
  due_date date not null,
  payment_terms text not null default '',
  items jsonb not null default '[]',
  subtotal_ht numeric not null default 0,
  tva_amount numeric not null default 0,
  total_ttc numeric not null default 0,
  status text not null check (status in ('brouillon', 'envoyée', 'payée', 'annulée', 'partiellement_payée')),
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoices_user_id on public.invoices(user_id);
alter table public.invoices enable row level security;

create policy "Users can manage own invoices"
  on public.invoices for all using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- payments (paiements liés aux factures OU revenus libres)
-- -----------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  payment_date date not null,
  payment_method text check (payment_method in ('virement', 'cheque', 'especes', 'carte', 'autre')),
  reference text,
  notes text,
  -- Revenus sans facture (optionnel)
  quote_id uuid references public.quotes(id) on delete set null,
  chantier_id uuid references public.chantiers(id) on delete set null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_payments_user_id on public.payments(user_id);
create index if not exists idx_payments_invoice_id on public.payments(invoice_id);
create index if not exists idx_payments_payment_date on public.payments(payment_date);
alter table public.payments enable row level security;

create policy "Users can manage own payments"
  on public.payments for all using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Commentaire
-- -----------------------------------------------------------------------------
comment on table public.user_profiles is 'Profil utilisateur (nom, logo, adresse société)';
comment on table public.clients is 'Clients (user_id = propriétaire)';
comment on table public.chantiers is 'Chantiers (user_id = propriétaire)';
comment on table public.quotes is 'Devis (user_id = propriétaire)';
comment on table public.user_tariffs is 'Tarifs utilisateur (matériaux, services) pour génération devis IA';
comment on table public.planning_notes is 'Note du jour par date (user_id = propriétaire)';
comment on table public.invoices is 'Factures (user_id = propriétaire)';
comment on table public.payments is 'Paiements factures ou revenus (user_id = propriétaire)';
