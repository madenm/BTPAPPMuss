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

comment on table public.user_tariffs is 'Tarifs utilisateur (matériaux, services) pour génération devis IA';
