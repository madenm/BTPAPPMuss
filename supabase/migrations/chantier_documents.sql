-- Documents de chantier (bons de commande, docs fournisseurs, etc.) pour calcul de rentabilité
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

create policy "Users can manage documents for own chantiers"
  on public.chantier_documents for all using (
    user_id = auth.uid()
    and chantier_id in (select id from public.chantiers where user_id = auth.uid())
  );

comment on table public.chantier_documents is 'Documents projet (bons de commande, fournisseurs) avec montant HT pour rentabilité';
