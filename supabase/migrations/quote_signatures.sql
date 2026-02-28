-- =============================================================================
-- Migration: Quote Signatures - Système de signature électronique pour devis
-- =============================================================================

-- Table pour les liens de signature (tokens générés lors de l'envoi)
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

create policy "Users can list own quote signature links"
  on public.quote_signature_links for select using (auth.uid() = user_id);
create policy "Users can insert own quote signature links"
  on public.quote_signature_links for insert with check (auth.uid() = user_id);
create policy "Users can delete own quote signature links"
  on public.quote_signature_links for delete using (auth.uid() = user_id);

-- Table pour enregistrer les signatures réelles (données du client + signature)
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

create policy "Anyone can insert quote signatures (public link)"
  on public.quote_signatures for insert with check (true);
create policy "Users can view own quote signatures"
  on public.quote_signatures for select using (
    quote_id in (select id from quotes where user_id = auth.uid())
  );

-- Mettre à jour le statut du devis quand il est signé (via trigger ou application logic)
comment on table public.quote_signature_links is 'Liens de signature unique (token) generés lors de l''envoi email d''un devis';
comment on table public.quote_signatures is 'Enregistrements des signatures, données client + image signature (base64)';
