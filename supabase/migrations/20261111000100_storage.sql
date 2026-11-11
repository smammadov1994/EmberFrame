-- Media lives in one private bucket. Every object path starts with the owner's user id:
--   <user id>/<project id>/<file>
-- so a person can only ever read, add or remove files under their own folder. Nothing is public;
-- the studio hands out short-lived signed links when a file has to play in the browser.
insert into storage.buckets (id, name, public) values ('media', 'media', false) on conflict (id) do nothing;

create policy media_read on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy media_add on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy media_remove on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
