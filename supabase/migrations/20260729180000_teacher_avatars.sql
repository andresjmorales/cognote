-- Teacher profile photos: public-by-URL Storage + avatar_url on teachers.

alter table public.teachers
  add column if not exists avatar_url text;

comment on column public.teachers.avatar_url is
  'Public URL for the teacher profile photo (Storage avatars bucket).';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Object keys: <teacher-id>/avatar.webp (upserted on replace)
drop policy if exists avatars_storage_select on storage.objects;
drop policy if exists avatars_storage_insert on storage.objects;
drop policy if exists avatars_storage_update on storage.objects;
drop policy if exists avatars_storage_delete on storage.objects;

create policy avatars_storage_select on storage.objects
  for select
  using (bucket_id = 'avatars');

create policy avatars_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_storage_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
