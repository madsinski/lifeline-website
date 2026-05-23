-- =============================================================
-- beta_feedback screenshots.
--
-- When a tester opens the floating feedback bubble, the RN client
-- captures the underlying screen via react-native-view-shot and
-- uploads it here. Stored privately; only the original tester +
-- admin staff can read.
--
-- Path convention: <user_id>/<feedback_id>.png
-- =============================================================

alter table public.beta_feedback
  add column if not exists screenshot_storage_path text;

-- Bucket: beta-feedback-screenshots (private).
insert into storage.buckets (id, name, public)
values ('beta-feedback-screenshots', 'beta-feedback-screenshots', false)
on conflict (id) do nothing;

-- Storage policies: user reads + writes inside their own folder;
-- admin staff manages everything.
drop policy if exists "user read own beta feedback screenshot" on storage.objects;
create policy "user read own beta feedback screenshot" on storage.objects
  for select using (
    bucket_id = 'beta-feedback-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "user write own beta feedback screenshot" on storage.objects;
create policy "user write own beta feedback screenshot" on storage.objects
  for insert with check (
    bucket_id = 'beta-feedback-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "admin manage beta feedback screenshots" on storage.objects;
create policy "admin manage beta feedback screenshots" on storage.objects
  for all using (
    bucket_id = 'beta-feedback-screenshots' and is_admin_staff()
  ) with check (
    bucket_id = 'beta-feedback-screenshots' and is_admin_staff()
  );

notify pgrst, 'reload schema';
