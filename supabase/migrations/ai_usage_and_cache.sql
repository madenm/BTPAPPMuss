-- -----------------------------------------------------------------------------
-- ai_usage : quota d'utilisation IA par utilisateur et par jour
-- -----------------------------------------------------------------------------
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (current_date at time zone 'Europe/Paris')::date,
  usage_count int not null default 0 check (usage_count >= 0),
  primary key (user_id, usage_date)
);

create index if not exists idx_ai_usage_user_date on public.ai_usage(user_id, usage_date);
alter table public.ai_usage enable row level security;

create policy "Users can read own ai_usage"
  on public.ai_usage for select using (auth.uid() = user_id);

comment on table public.ai_usage is 'Quota journalier d''appels IA (devis, estimation, analyse photo) par utilisateur';

-- -----------------------------------------------------------------------------
-- ai_response_cache : cache des réponses IA pour éviter des appels redondants
-- -----------------------------------------------------------------------------
create table if not exists public.ai_response_cache (
  cache_key text not null,
  response_type text not null check (response_type in ('devis', 'estimation', 'photo')),
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (cache_key, response_type)
);

create index if not exists idx_ai_response_cache_created on public.ai_response_cache(created_at);
comment on table public.ai_response_cache is 'Cache des réponses IA (TTL 7 jours) pour devis, estimation, analyse photo';
