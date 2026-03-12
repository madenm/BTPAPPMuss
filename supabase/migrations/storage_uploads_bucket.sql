-- Bucket "uploads" pour fichiers projet (images chantier, documents, etc.)
-- Les chemins sont de la forme : {user_id}/chantiers/{chantier_id}/...

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do update set public = true;

-- RLS : les utilisateurs authentifiés peuvent uniquement gérer leurs propres fichiers (premier segment du path = auth.uid())
drop policy if exists "Users can upload in own folder" on storage.objects;
drop policy if exists "Users can read own files" on storage.objects;
drop policy if exists "Users can update own files" on storage.objects;
drop policy if exists "Users can delete own files" on storage.objects;

create policy "Users can upload in own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can read own files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update own files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
