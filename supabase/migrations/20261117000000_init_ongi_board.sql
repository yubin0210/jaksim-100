-- Ongi Board Production Schema, RLS Policies, Atomic RPCs & Storage Setup

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nickname TEXT NOT NULL,
  avatar_initial TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rooms (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  tag TEXT NOT NULL,
  category TEXT NOT NULL,
  max_capacity INTEGER NOT NULL CHECK (max_capacity IN (2, 4, 6)),
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_completed_date TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.room_members (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  avatar_initial TEXT NOT NULL,
  is_host BOOLEAN NOT NULL DEFAULT false,
  member_streak_days INTEGER NOT NULL DEFAULT 0,
  last_active_date TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  member_id TEXT REFERENCES public.room_members(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_nickname TEXT NOT NULL,
  author_avatar_initial TEXT NOT NULL,
  checkin_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('photo', 'rest')),
  image_data TEXT,
  note TEXT NOT NULL DEFAULT '',
  timestamp_label TEXT NOT NULL,
  likes_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id, checkin_date)
);

CREATE TABLE IF NOT EXISTS public.checkin_likes (
  checkin_id TEXT NOT NULL REFERENCES public.daily_checkins(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (checkin_id, user_id)
);

-- Indexes for foreign keys and hot query filters
CREATE INDEX IF NOT EXISTS idx_rooms_created_by ON public.rooms(created_by);
CREATE INDEX IF NOT EXISTS idx_room_members_room_id ON public.room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user_id ON public.room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_room_members_room_active ON public.room_members(room_id, is_active);
CREATE INDEX IF NOT EXISTS idx_daily_checkins_room_date ON public.daily_checkins(room_id, checkin_date);
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date ON public.daily_checkins(user_id, checkin_date);
CREATE INDEX IF NOT EXISTS idx_daily_checkins_member_id ON public.daily_checkins(member_id);
CREATE INDEX IF NOT EXISTS idx_checkin_likes_user_id ON public.checkin_likes(user_id);

-- Auto-create profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw_nick TEXT;
  v_nickname TEXT;
  v_initial TEXT;
BEGIN
  v_raw_nick := COALESCE(
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'nickname'), ''),
    NULLIF(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), ''),
    '온기메이트'
  );
  v_nickname := LEFT(v_raw_nick, 12);
  v_initial := LEFT(v_nickname, 1);

  INSERT INTO public.profiles (id, email, nickname, avatar_initial)
  VALUES (NEW.id, COALESCE(NEW.email, ''), v_nickname, v_initial)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        nickname = EXCLUDED.nickname,
        avatar_initial = EXCLUDED.avatar_initial;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Keep daily_checkins.likes_count atomically synced with checkin_likes
CREATE OR REPLACE FUNCTION public.sync_checkin_likes_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkin_id TEXT;
BEGIN
  v_checkin_id := COALESCE(NEW.checkin_id, OLD.checkin_id);
  UPDATE public.daily_checkins
  SET likes_count = (
    SELECT COUNT(*)::INTEGER
    FROM public.checkin_likes
    WHERE checkin_id = v_checkin_id
  )
  WHERE id = v_checkin_id;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER on_checkin_likes_changed
  AFTER INSERT OR DELETE ON public.checkin_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_checkin_likes_count();

-- Row-Level Security Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY "rooms_select_authenticated"
  ON public.rooms FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "rooms_insert_own"
  ON public.rooms FOR INSERT TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "room_members_select_authenticated"
  ON public.room_members FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "room_members_insert_self"
  ON public.room_members FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "daily_checkins_select_authenticated"
  ON public.daily_checkins FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "daily_checkins_insert_member"
  ON public.daily_checkins FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.room_members rm
      WHERE rm.room_id = daily_checkins.room_id
        AND rm.user_id = (SELECT auth.uid())
        AND rm.is_active = true
    )
  );

CREATE POLICY "checkin_likes_select_authenticated"
  ON public.checkin_likes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "checkin_likes_insert_own"
  ON public.checkin_likes FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "checkin_likes_delete_own"
  ON public.checkin_likes FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Atomic SECURITY DEFINER RPCs for cross-user eviction, capacity-safe join, and streak updates
CREATE OR REPLACE FUNCTION public.apply_room_eviction(
  p_room_id TEXT,
  p_evicted_ids TEXT[],
  p_new_host_id TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff TEXT;
  v_total INTEGER;
  v_eligible_count INTEGER;
  v_remaining_host_exists BOOLEAN;
  v_fallback_host TEXT;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF p_evicted_ids IS NULL OR COALESCE(array_length(p_evicted_ids, 1), 0) = 0 THEN
    RETURN;
  END IF;

  PERFORM 1 FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_total
  FROM public.room_members
  WHERE room_id = p_room_id AND is_active = true;

  IF v_total <= 1 THEN
    RETURN;
  END IF;

  v_cutoff := to_char(((NOW() AT TIME ZONE 'Asia/Seoul')::date - 3), 'YYYY-MM-DD');

  SELECT COUNT(*)::INTEGER INTO v_eligible_count
  FROM public.room_members
  WHERE room_id = p_room_id
    AND is_active = true
    AND id = ANY(p_evicted_ids)
    AND joined_at <= v_cutoff
    AND last_active_date < v_cutoff;

  IF v_eligible_count = 0 OR (v_total - v_eligible_count) < 1 THEN
    RETURN;
  END IF;

  UPDATE public.room_members
  SET is_active = false,
      is_host = false
  WHERE room_id = p_room_id
    AND is_active = true
    AND id = ANY(p_evicted_ids)
    AND joined_at <= v_cutoff
    AND last_active_date < v_cutoff;

  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = p_room_id AND is_active = true AND is_host = true
  ) INTO v_remaining_host_exists;

  IF NOT v_remaining_host_exists THEN
    IF p_new_host_id IS NOT NULL THEN
      UPDATE public.room_members
      SET is_host = true
      WHERE id = p_new_host_id AND room_id = p_room_id AND is_active = true;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.room_members
      WHERE room_id = p_room_id AND is_active = true AND is_host = true
    ) INTO v_remaining_host_exists;

    IF NOT v_remaining_host_exists THEN
      SELECT id INTO v_fallback_host
      FROM public.room_members
      WHERE room_id = p_room_id AND is_active = true
      ORDER BY joined_at ASC, id ASC
      LIMIT 1;

      IF v_fallback_host IS NOT NULL THEN
        UPDATE public.room_members SET is_host = true WHERE id = v_fallback_host;
      END IF;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_room_atomic(
  p_room_id TEXT,
  p_member_id TEXT,
  p_today TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_profile RECORD;
  v_max_capacity INTEGER;
  v_count INTEGER;
BEGIN
  v_uid := (SELECT auth.uid());
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'status', 401, 'error', '로그인이 필요해요.');
  END IF;

  SELECT max_capacity INTO v_max_capacity
  FROM public.rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'status', 404, 'error', '방을 찾을 수 없어요.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = p_room_id AND user_id = v_uid AND is_active = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'status', 409, 'error', '이미 참여 중인 방이에요.');
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.room_members
  WHERE room_id = p_room_id AND is_active = true;

  IF v_count >= v_max_capacity THEN
    RETURN jsonb_build_object('ok', false, 'status', 409, 'error', '방 정원이 모두 찼어요.');
  END IF;

  SELECT nickname, avatar_initial INTO v_profile
  FROM public.profiles
  WHERE id = v_uid;

  INSERT INTO public.room_members (
    id, room_id, user_id, nickname, avatar_initial,
    is_host, member_streak_days, last_active_date, joined_at, is_active
  )
  VALUES (
    p_member_id,
    p_room_id,
    v_uid,
    COALESCE(v_profile.nickname, '온기메이트'),
    COALESCE(v_profile.avatar_initial, '온'),
    v_count = 0,
    0,
    p_today,
    p_today,
    true
  )
  ON CONFLICT (room_id, user_id) DO UPDATE
    SET nickname = EXCLUDED.nickname,
        avatar_initial = EXCLUDED.avatar_initial,
        is_host = EXCLUDED.is_host,
        member_streak_days = 0,
        last_active_date = EXCLUDED.last_active_date,
        joined_at = EXCLUDED.joined_at,
        is_active = true;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_checkin_streak(
  p_room_id TEXT,
  p_member_id TEXT,
  p_member_streak INTEGER,
  p_today TEXT,
  p_room_streak INTEGER,
  p_last_completed_date TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := (SELECT auth.uid());
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  UPDATE public.room_members
  SET member_streak_days = p_member_streak,
      last_active_date = p_today
  WHERE id = p_member_id
    AND room_id = p_room_id
    AND user_id = v_uid
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_a_room_member';
  END IF;

  IF p_last_completed_date IS NOT NULL THEN
    UPDATE public.rooms
    SET streak_days = p_room_streak,
        last_completed_date = p_last_completed_date
    WHERE id = p_room_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_checkin_likes_count() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.apply_room_eviction(TEXT, TEXT[], TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_room_eviction(TEXT, TEXT[], TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.join_room_atomic(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_room_atomic(TEXT, TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.apply_checkin_streak(TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_checkin_streak(TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT) TO authenticated;

-- Storage bucket for live camera JPEG check-ins
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'checkins',
  'checkins',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "checkins_storage_select_public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'checkins');

CREATE POLICY "checkins_storage_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'checkins'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

CREATE POLICY "checkins_storage_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'checkins'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
