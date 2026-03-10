-- =============================================================================
-- INIT BDD STAGING - À exécuter en une seule fois dans Supabase SQL Editor
-- Projet : Staging TitanBTP
-- =============================================================================
-- Copie tout ce fichier, colle dans SQL Editor > New query > Run

-- ========== 1. SCHÉMA DE BASE ==========
-- (schema.sql)

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  logo_url text,
  theme_color text,
  company_name text,
  company_address text,
  company_city_postal text,
  company_phone text,
  company_email text,
  company_siret text,
  company_tva_number text,
  company_rcs text,
  company_ape text,
  company_capital text,
  insurance_name text,
  insurance_policy text,
  qualifications text,
  default_tva_rate text default '20',
  default_validity_days text default '30',
  default_conditions text,
  invoice_mentions text,
  quote_prefix text,
  invoice_prefix text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_profiles enable row level security;
create policy "Users can read own profile" on public.user_profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.user_profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.user_profiles for insert with check (auth.uid() = id);

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
create policy "Users can manage own clients" on public.clients for all using (auth.uid() = user_id);

create table if not exists public.client_form_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_client_form_links_token on public.client_form_links(token);
create index if not exists idx_client_form_links_user_id on public.client_form_links(user_id);
alter table public.client_form_links enable row level security;
create policy "Users can insert own client form links" on public.client_form_links for insert with check (auth.uid() = user_id);
create policy "Users can select own client form links" on public.client_form_links for select using (auth.uid() = user_id);

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
create policy "Users can manage own chantiers" on public.chantiers for all using (auth.uid() = user_id);

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
create policy "Users can manage own quotes" on public.quotes for all using (auth.uid() = user_id);

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
create policy "Users can select own user_tariffs" on public.user_tariffs for select using (auth.uid() = user_id);
create policy "Users can insert own user_tariffs" on public.user_tariffs for insert with check (auth.uid() = user_id);
create policy "Users can update own user_tariffs" on public.user_tariffs for update using (auth.uid() = user_id);
create policy "Users can delete own user_tariffs" on public.user_tariffs for delete using (auth.uid() = user_id);

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
create policy "Users can manage own planning notes" on public.planning_notes for all using (auth.uid() = user_id);

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
create policy "Users can manage own invoices" on public.invoices for all using (auth.uid() = user_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  payment_date date not null,
  payment_method text check (payment_method in ('virement', 'cheque', 'especes', 'carte', 'autre')),
  reference text,
  notes text,
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
create policy "Users can manage own payments" on public.payments for all using (auth.uid() = user_id);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  role text not null,
  email text not null,
  phone text,
  status text not null default 'actif' check (status in ('actif', 'inactif')),
  login_code text not null,
  can_view_dashboard boolean default false,
  can_use_estimation boolean default false,
  can_view_all_chantiers boolean default false,
  can_manage_chantiers boolean default false,
  can_view_planning boolean default false,
  can_manage_planning boolean default false,
  can_access_crm boolean default false,
  can_create_quotes boolean default false,
  can_manage_invoices boolean default false,
  can_use_ai_visualization boolean default false,
  can_manage_team boolean default false,
  can_manage_clients boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_team_members_user_id on public.team_members(user_id);
create index if not exists idx_team_members_login_code on public.team_members(login_code);
create index if not exists idx_team_members_status on public.team_members(status);
alter table public.team_members enable row level security;
create policy "Users can manage own team members" on public.team_members for all using (auth.uid() = user_id);
create policy "Anyone can read team members for login" on public.team_members for select using (true);

create table if not exists public.chantier_assignments (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(chantier_id, team_member_id)
);
create index if not exists idx_chantier_assignments_chantier_id on public.chantier_assignments(chantier_id);
create index if not exists idx_chantier_assignments_team_member_id on public.chantier_assignments(team_member_id);
alter table public.chantier_assignments enable row level security;
create policy "Users can manage assignments for own chantiers" on public.chantier_assignments for all using (
  chantier_id in (select id from chantiers where user_id = auth.uid())
);

drop function if exists get_chantiers_for_team_member(uuid);
create or replace function get_chantiers_for_team_member(p_team_member_id uuid)
returns setof chantiers language sql security definer as $$
  select c.* from chantiers c
  inner join chantier_assignments ca on ca.chantier_id = c.id
  where ca.team_member_id = p_team_member_id and c.is_deleted = false;
$$;

-- ========== 2. TRIGGER CRÉATION PROFIL À L'INSCRIPTION ==========
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ========== 3. STATUT SIGNÉ POUR DEVIS ==========
alter table public.quotes drop constraint if exists quotes_status_check;
alter table public.quotes add constraint quotes_status_check
  check (status in ('brouillon', 'envoyé', 'accepté', 'refusé', 'expiré', 'validé', 'signé'));

-- ========== 4. TABLES SIGNATURE ÉLECTRONIQUE ==========
create table if not exists public.quote_signature_links (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references public.quotes(id) on delete cascade,
  token text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  prospect_email text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists idx_quote_signature_links_quote_id on public.quote_signature_links(quote_id);
create index if not exists idx_quote_signature_links_token on public.quote_signature_links(token);
create index if not exists idx_quote_signature_links_user_id on public.quote_signature_links(user_id);
alter table public.quote_signature_links enable row level security;
drop policy if exists "Users can list own quote signature links" on public.quote_signature_links;
drop policy if exists "Users can insert own quote signature links" on public.quote_signature_links;
drop policy if exists "Users can delete own quote signature links" on public.quote_signature_links;
create policy "Users can list own quote signature links" on public.quote_signature_links for select using (auth.uid() = user_id);
create policy "Users can insert own quote signature links" on public.quote_signature_links for insert with check (auth.uid() = user_id);
create policy "Users can delete own quote signature links" on public.quote_signature_links for delete using (auth.uid() = user_id);

create table if not exists public.quote_signatures (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references public.quotes(id) on delete cascade,
  signature_token text not null unique,
  client_firstname text not null,
  client_lastname text not null,
  client_email text,
  prospect_email text,
  signature_data text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_quote_signatures_quote_id on public.quote_signatures(quote_id);
create index if not exists idx_quote_signatures_signature_token on public.quote_signatures(signature_token);
alter table public.quote_signatures enable row level security;
drop policy if exists "Anyone can insert quote signatures (public link)" on public.quote_signatures;
drop policy if exists "Users can view own quote signatures" on public.quote_signatures;
create policy "Anyone can insert quote signatures (public link)" on public.quote_signatures for insert with check (true);
create policy "Users can view own quote signatures" on public.quote_signatures for select using (
  quote_id in (select id from quotes where user_id = auth.uid())
);

-- ========== 5. COLONNES PDF SUR QUOTES ==========
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS quote_pdf_base64 TEXT NULL;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS quote_signature_rect_coords JSONB NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_pdf ON public.quotes(id) WHERE quote_pdf_base64 IS NOT NULL;

-- ========== 6. CONTACT_ID SUR QUOTES (STAGING = CLIENTS) ==========
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_contact_id ON public.quotes(contact_id);

-- ========== 7. COLONNES CRM SUR CLIENTS ==========
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMP DEFAULT NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS relance_count INTEGER DEFAULT 0;

-- ========== 8. FONCTION GÉNÉRATION NUMÉRO FACTURE ==========
create or replace function public.generate_invoice_number(p_user_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  current_year int := extract(year from current_date)::int;
  max_num int;
  next_num int;
begin
  select coalesce(max((regexp_replace(invoice_number, '^' || current_year, ''))::int), 0) into max_num
  from invoices
  where user_id = p_user_id and invoice_number ~ ('^' || current_year::text || '[0-9]+$');
  next_num := max_num + 1;
  return current_year::text || lpad(next_num::text, 6, '0');
end;
$$;
grant execute on function public.generate_invoice_number(uuid) to authenticated;
grant execute on function public.generate_invoice_number(uuid) to service_role;
grant execute on function public.generate_invoice_number(uuid) to anon;

-- ========== AI USAGE & CACHE ==========
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (current_date at time zone 'Europe/Paris')::date,
  usage_count int not null default 0 check (usage_count >= 0),
  primary key (user_id, usage_date)
);
create index if not exists idx_ai_usage_user_date on public.ai_usage(user_id, usage_date);
alter table public.ai_usage enable row level security;
create policy "Users can read own ai_usage" on public.ai_usage for select using (auth.uid() = user_id);

create table if not exists public.ai_response_cache (
  cache_key text not null,
  response_type text not null check (response_type in ('devis', 'estimation', 'photo')),
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (cache_key, response_type)
);
create index if not exists idx_ai_response_cache_created on public.ai_response_cache(created_at);

-- ========== FIN ==========
