-- Table et politiques pour les liens partageables formulaire client.
-- À exécuter dans le projet Supabase utilisé par l'app (même projet que VITE_SUPABASE_URL dans .env).
-- Dans le dashboard : https://supabase.com/dashboard → choisir le bon projet → SQL Editor → New query → Run.

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
create policy "Users can insert own client form links"
  on public.client_form_links for insert with check (auth.uid() = user_id);

drop policy if exists "Users can select own client form links" on public.client_form_links;
create policy "Users can select own client form links"
  on public.client_form_links for select using (auth.uid() = user_id);
