BEGIN;

-- The board and discovery previews share published photographs with signed-in members.
UPDATE storage.buckets SET public = false WHERE id = 'checkins';

DROP POLICY IF EXISTS checkins_storage_select_public ON storage.objects;
CREATE POLICY checkins_storage_select_authenticated
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'checkins' AND (
    (storage.foldername(name))[1] = (SELECT auth.uid())::text
    OR EXISTS (
      SELECT 1 FROM public.daily_checkins c
      WHERE c.id = split_part(storage.filename(name), '.', 1)
        AND c.status = 'photo'
        AND c.user_id::text = (storage.foldername(name))[1]
        AND c.room_id = (storage.foldername(name))[2]
    )
  ));

-- Room membership and check-in rows already carry the public nickname and initial.
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

COMMIT;
