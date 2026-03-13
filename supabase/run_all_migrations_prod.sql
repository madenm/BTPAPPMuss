-- =============================================================================
-- Script unique : toutes les migrations pour aligner la PROD avec staging
-- Exécuter dans Supabase Dashboard → Projet PRODUCTION → SQL Editor → New query → Coller → Run
--
-- Compatible prod SANS table "prospects" : les blocs [3]/[4] et [13] ne s'exécutent
-- que si la table prospects existe (renommage prospects → clients). Si votre prod
-- a toujours eu "clients", aucun problème au premier run.
-- =============================================================================

-- [1] create_user_profile_on_signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- [2] user_profiles_settings_columns
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS company_tva_number text,
  ADD COLUMN IF NOT EXISTS company_rcs text,
  ADD COLUMN IF NOT EXISTS company_ape text,
  ADD COLUMN IF NOT EXISTS company_capital text,
  ADD COLUMN IF NOT EXISTS insurance_name text,
  ADD COLUMN IF NOT EXISTS insurance_policy text,
  ADD COLUMN IF NOT EXISTS qualifications text,
  ADD COLUMN IF NOT EXISTS default_tva_rate text DEFAULT '20',
  ADD COLUMN IF NOT EXISTS default_validity_days text DEFAULT '30',
  ADD COLUMN IF NOT EXISTS default_conditions text,
  ADD COLUMN IF NOT EXISTS invoice_mentions text,
  ADD COLUMN IF NOT EXISTS quote_prefix text,
  ADD COLUMN IF NOT EXISTS invoice_prefix text;

-- [2b] admin_codes (codes admin par utilisateur)
create table if not exists public.admin_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  code text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_admin_codes_user_id on public.admin_codes(user_id);
create index if not exists idx_admin_codes_code on public.admin_codes(code);
alter table public.admin_codes enable row level security;
drop policy if exists "Users can manage own admin_codes" on public.admin_codes;
create policy "Users can manage own admin_codes" on public.admin_codes for all using (auth.uid() = user_id);

-- [2c] user_email_connections (connexion email Gmail/Outlook pour envoi)
create table if not exists public.user_email_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'outlook')),
  from_email text,
  updated_at timestamptz not null default now()
);
alter table public.user_email_connections enable row level security;
drop policy if exists "Users can manage own user_email_connections" on public.user_email_connections;
create policy "Users can manage own user_email_connections" on public.user_email_connections for all using (auth.uid() = user_id);

-- [3] et [4] : rename/merge prospects -> clients (uniquement si la table prospects existe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'prospects') THEN
    ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_contact_id_fkey;
    DROP TABLE IF EXISTS client_form_links CASCADE;
    DROP TABLE IF EXISTS clients CASCADE;
    ALTER TABLE prospects RENAME TO clients;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS street_address TEXT DEFAULT NULL;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS postal_code TEXT DEFAULT NULL;
    ALTER TABLE clients ADD COLUMN IF NOT EXISTS city TEXT DEFAULT NULL;
    ALTER TABLE quotes ADD CONSTRAINT quotes_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES clients(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS clients_user_id_idx ON clients(user_id);
  END IF;
END $$;

-- [5] add_contact_id_to_quotes_staging (si [3]/[4] non exécutés, la colonne peut déjà exister)
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_contact_id ON public.quotes(contact_id);

-- [6] add_signed_status_to_quotes
alter table public.quotes drop constraint if exists quotes_status_check;
alter table public.quotes add constraint quotes_status_check
  check (status in ('brouillon', 'envoyé', 'accepté', 'refusé', 'expiré', 'validé', 'signé'));

-- [7] quote_signatures
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
create policy "Users can view own quote signatures" on public.quote_signatures for select using (quote_id in (select id from quotes where user_id = auth.uid()));

-- [8] store_quote_pdf
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS quote_pdf_base64 TEXT NULL;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS quote_signature_rect_coords JSONB NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_pdf ON public.quotes(id) WHERE quote_pdf_base64 IS NOT NULL;

-- [9] client_form_links
create table if not exists public.client_form_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_client_form_links_token on public.client_form_links(token);
create index if not exists idx_client_form_links_user_id on public.client_form_links(user_id);
alter table public.client_form_links enable row level security;
drop policy if exists "Users can insert own client form links" on public.client_form_links;
create policy "Users can insert own client form links" on public.client_form_links for insert with check (auth.uid() = user_id);
drop policy if exists "Users can select own client form links" on public.client_form_links;
create policy "Users can select own client form links" on public.client_form_links for select using (auth.uid() = user_id);

-- [10] chantier_documents
create table if not exists public.chantier_documents (
  id uuid primary key default gen_random_uuid(),
  chantier_id uuid not null references public.chantiers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('bon_commande', 'doc_fournisseur', 'autre', 'image')),
  file_path text not null,
  file_name text not null,
  amount_ht numeric,
  created_at timestamptz not null default now()
);
create index if not exists idx_chantier_documents_chantier_id on public.chantier_documents(chantier_id);
create index if not exists idx_chantier_documents_user_id on public.chantier_documents(user_id);
alter table public.chantier_documents enable row level security;
drop policy if exists "Users can manage documents for own chantiers" on public.chantier_documents;
create policy "Users can manage documents for own chantiers" on public.chantier_documents for all using (
  user_id = auth.uid() and chantier_id in (select id from public.chantiers where user_id = auth.uid())
);

-- [11] user_tariffs
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
drop policy if exists "Users can select own user_tariffs" on public.user_tariffs;
drop policy if exists "Users can insert own user_tariffs" on public.user_tariffs;
drop policy if exists "Users can update own user_tariffs" on public.user_tariffs;
drop policy if exists "Users can delete own user_tariffs" on public.user_tariffs;
create policy "Users can select own user_tariffs" on public.user_tariffs for select using (auth.uid() = user_id);
create policy "Users can insert own user_tariffs" on public.user_tariffs for insert with check (auth.uid() = user_id);
create policy "Users can update own user_tariffs" on public.user_tariffs for update using (auth.uid() = user_id);
create policy "Users can delete own user_tariffs" on public.user_tariffs for delete using (auth.uid() = user_id);

-- Fix category check to match app (catégories en minuscules + accents)
alter table public.user_tariffs drop constraint if exists user_tariffs_category_check;
alter table public.user_tariffs add constraint user_tariffs_category_check check (category in ('matériau', 'service', 'main-d''œuvre', 'location', 'sous-traitance', 'transport', 'équipement', 'fourniture', 'autre'));

-- [12] generate_invoice_number
create or replace function public.generate_invoice_number(p_user_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare current_year int := extract(year from current_date)::int; max_num int; next_num int;
begin
  select coalesce(max((regexp_replace(invoice_number, '^' || current_year, ''))::int), 0) into max_num
  from invoices where user_id = p_user_id and invoice_number ~ ('^' || current_year::text || '[0-9]+$');
  next_num := max_num + 1;
  return current_year::text || lpad(next_num::text, 6, '0');
end; $$;
grant execute on function public.generate_invoice_number(uuid) to authenticated;
grant execute on function public.generate_invoice_number(uuid) to service_role;
grant execute on function public.generate_invoice_number(uuid) to anon;

-- [12b] estimations (demandes d'estimation IA / formulaire)
create table if not exists public.estimations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  client_email text,
  client_phone text,
  address text,
  postal_code varchar(20),
  city text,
  name text not null,
  type varchar(100),
  surface numeric,
  complexity varchar(50),
  site_access varchar(50),
  description text,
  materials text,
  desired_deadline varchar(50),
  client_budget numeric,
  notes text,
  photo_urls text[],
  estimated_duration varchar(50),
  estimated_workers integer,
  estimated_materials jsonb,
  estimated_costs jsonb,
  estimated_total numeric,
  estimated_margin numeric,
  recommendations jsonb,
  assumptions text[],
  adjusted_values jsonb,
  status varchar(50),
  analysis_method varchar(50),
  analysis_confidence numeric,
  created_chantier_id uuid references public.chantiers(id) on delete set null,
  created_quote_id uuid references public.quotes(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists idx_estimations_user_id on public.estimations(user_id);
create index if not exists idx_estimations_client_id on public.estimations(client_id);
create index if not exists idx_estimations_created_at on public.estimations(created_at);
alter table public.estimations enable row level security;
drop policy if exists "Users can manage own estimations" on public.estimations;
create policy "Users can manage own estimations" on public.estimations for all using (auth.uid() = user_id);

-- [12c] invoice_numbering (séquence numéro facture par utilisateur, si utilisée)
create table if not exists public.invoice_numbering (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_number bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.invoice_numbering enable row level security;
drop policy if exists "Users can manage own invoice_numbering" on public.invoice_numbering;
create policy "Users can manage own invoice_numbering" on public.invoice_numbering for all using (auth.uid() = user_id);

-- [13] crm_prospect_enhancements (uniquement si la table prospects existe)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'prospects') THEN
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS linked_quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS linked_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMPTZ;
    ALTER TABLE prospects ADD COLUMN IF NOT EXISTS last_action_type TEXT;
    ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_stage_check;
    ALTER TABLE prospects ADD CONSTRAINT prospects_stage_check CHECK (
      stage IN ('all', 'quote', 'quote_followup1', 'quote_followup2', 'invoice', 'invoice_followup1', 'invoice_followup2', 'won', 'lost')
    );
  END IF;
END $$;

-- [14] add_crm_columns_to_clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'all';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_action_type TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS linked_quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS linked_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

-- [15] add_missing_crm_columns_to_clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_email_sent_at TIMESTAMP DEFAULT NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS relance_count INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes text;

-- [15b] chantiers: colonne notes_avancement si manquante
ALTER TABLE public.chantiers ADD COLUMN IF NOT EXISTS notes_avancement text;

-- [16] ai_usage_and_cache
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (current_date at time zone 'Europe/Paris')::date,
  usage_count int not null default 0 check (usage_count >= 0),
  primary key (user_id, usage_date)
);
create index if not exists idx_ai_usage_user_date on public.ai_usage(user_id, usage_date);
alter table public.ai_usage enable row level security;
drop policy if exists "Users can read own ai_usage" on public.ai_usage;
create policy "Users can read own ai_usage" on public.ai_usage for select using (auth.uid() = user_id);

create table if not exists public.ai_response_cache (
  cache_key text not null,
  response_type text not null check (response_type in ('devis', 'estimation', 'photo')),
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (cache_key, response_type)
);
create index if not exists idx_ai_response_cache_created on public.ai_response_cache(created_at);

-- [17] team_management
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
drop policy if exists "Users can manage own team members" on public.team_members;
create policy "Users can manage own team members" on public.team_members for all using (auth.uid() = user_id);
drop policy if exists "Anyone can read team members for login" on public.team_members;
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
drop policy if exists "Users can manage assignments for own chantiers" on public.chantier_assignments;
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

-- [17b] team_invitations (liens d'invitation membres équipe)
create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_member_id uuid references public.team_members(id) on delete cascade,
  email text not null,
  token text not null unique,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_team_invitations_user_id on public.team_invitations(user_id);
create index if not exists idx_team_invitations_team_member_id on public.team_invitations(team_member_id);
create index if not exists idx_team_invitations_token on public.team_invitations(token);
alter table public.team_invitations enable row level security;
drop policy if exists "Users can manage own team_invitations" on public.team_invitations;
create policy "Users can manage own team_invitations" on public.team_invitations for all using (auth.uid() = user_id);
drop policy if exists "Anyone can read team_invitations by token for invite page" on public.team_invitations;
create policy "Anyone can read team_invitations by token for invite page" on public.team_invitations for select using (true);

-- [18] storage_uploads_bucket (évite "Bucket not found" pour documents projet)
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do update set public = true;
drop policy if exists "Users can upload in own folder" on storage.objects;
drop policy if exists "Users can read own files" on storage.objects;
drop policy if exists "Users can update own files" on storage.objects;
drop policy if exists "Users can delete own files" on storage.objects;
create policy "Users can upload in own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can read own files" on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can update own files" on storage.objects for update to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users can delete own files" on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
