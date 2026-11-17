# 온기보드 (Ongi Board) Supabase Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert **온기보드 (Ongi Board)** from a local single-user SQLite demo into a production-deployable multi-user service backed by Supabase Auth (`HttpOnly` SSR cookie sessions), Supabase PostgreSQL (RLS + atomic `SECURITY DEFINER` RPCs), and Supabase Storage (`checkins` bucket), with zero fake seed data.

**Architecture:** `src/lib/domain.ts` remains the pure, side-effect-free rule engine for layouts, completion percentages, streaks, and 3-day inactive eviction. `src/lib/repository.ts` becomes an async multi-user data layer built around an `OngiStore` adapter interface (`SupabaseOngiStore` in production using `@supabase/ssr` + `checkins` Storage uploads + atomic Postgres RPCs; `InMemoryOngiStore` for deterministic offline Vitest integration tests), while `src/middleware.ts` and `src/lib/auth.ts` enforce authenticated access across SSR pages and REST API routes.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, `@supabase/supabase-js`, `@supabase/ssr`, Supabase PostgreSQL & Storage, Vitest, Cozy Daylight Design System, Capacitor config.

**Spec:** `/Users/yubin/Projects/ongi-board/docs/superpowers/specs/2026-11-17-ongi-board-supabase-design.md`

## Global Constraints

- **Project Root**: `/Users/yubin/Projects/ongi-board` (do not write source files outside this directory).
- **No Fake Seed Data**: Remove `src/lib/db.ts` and `src/lib/seed-data.ts`; never auto-seed fake rooms or dummy members in production.
- **No Client-Supplied `userId` / No `service_role` in App Runtime**: Derive the authenticated user exclusively via `supabase.auth.getUser()` on the server using `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **No Gallery Upload**: Never render `<input type="file">` anywhere; in production (`NEXT_PUBLIC_ALLOW_CAMERA_FALLBACK !== 'true'`), enforce live `getUserMedia` camera capture in `LiveCameraModal.tsx` and disable shutter upload when camera is unavailable or denied.
- **Cozy Daylight Visual Standard**: Preserve `#F4EDE2` Warm Oat canvas, `#FAF6F0` Warm Milk shell, `#FFFDF9` Cream Ivory surfaces, `#EE6348` Persimmon Coral, `#F2A93B` Marigold Honey, `#4F9866` Clover Sage, `#281F1A` Espresso Ink, `Pretendard Variable` × `Fraunces` typography, and 2px rounded-stroke inline SVG icons (zero decorative emojis).
- **Single-Room Immersion & Non-Member Preview**: Keep `/rooms/[id]` free of top room-switcher tabs; allow authenticated non-members to preview rooms and toggle likes while showing a join CTA (`함께하기`) instead of member-only check-in/rest controls.

## Review Focus

1. **Unauthenticated route & API isolation**: Unauthenticated requests to `/api/rooms/**`, `/api/checkins/**`, or `/api/album` must return HTTP `401` JSON rather than redirecting or falling back to a default user; page requests must redirect to `/auth` via `src/middleware.ts`. *(Tested in Task 3)*
2. **Post-eviction `/album`, `weekRhythm`, & past-date preservation**: Evicting a member after 3 inactive days (`protectCurrentUser: false`) must set `daily_checkins.member_id = NULL` without deleting their past check-ins, keeping `/album` entries, `weekRhythm` activity dots, and past-date room board tiles intact. *(Tested in Task 2)*
3. **Same-day re-join & weekly rest-pass tracking per `(room_id, user_id, checkin_date)`**: If a user checks in or uses a rest pass, gets evicted or leaves, and re-joins the same room within the same day or Monday–Sunday week, duplicate same-day check-ins (`409`) and second weekly rest passes (`400`) must still be rejected. *(Tested in Task 2)*
4. **Non-member preview vs active member board rendering**: Visiting `/rooms/[id]` as an authenticated non-member must render `isJoined: false`, allow heart toggles, hide `"오늘은 쉬어가기"` and empty-slot camera buttons, and expose a working `"함께하기"` join action when slots remain. *(Tested in Task 4)*
5. **Production camera fallback guard & binary image validation**: When `NEXT_PUBLIC_ALLOW_CAMERA_FALLBACK !== 'true'` and `getUserMedia` fails, `LiveCameraModal` must disable shutter submission; server `POST /api/rooms/[id]/checkin` must reject non-JPEG/PNG data URLs or payloads > 3MB with `400`. *(Tested in Task 3 & Task 4)*

---

### Task 1: Supabase Project Provisioning, Schema Migration, RLS & Storage Setup

**Files:**
- Create: `/Users/yubin/Projects/ongi-board/supabase/migrations/20261117000000_init_ongi_board.sql`
- Create: `/Users/yubin/Projects/ongi-board/.env.example`
- Create: `/Users/yubin/Projects/ongi-board/.env.local` (gitignored via `.env*.local`)
- Modify: `/Users/yubin/Projects/ongi-board/package.json`

**Interfaces:**
- Produces Supabase cloud project `ongi-board` (`ap-northeast-2`, org `nsvxmftapnwaxnyhvnwo`) with tables `profiles`, `rooms`, `room_members`, `daily_checkins`, `checkin_likes`, triggers `on_auth_user_created` and `sync_checkin_likes_count`, RPCs `apply_room_eviction`, `join_room_atomic`, `apply_checkin_streak`, and public Storage bucket `checkins`.

- [ ] **Step 1: Install Supabase packages**

Run: `npm install @supabase/supabase-js @supabase/ssr`
Expected: `package.json` and `package-lock.json` include `@supabase/supabase-js` and `@supabase/ssr`.

- [ ] **Step 2: Provision Supabase project `ongi-board` via MCP**

Call `supabase_mcp:create_project` with `name: "ongi-board"`, `region: "ap-northeast-2"`, `organization_id: "nsvxmftapnwaxnyhvnwo"`. Poll `supabase_mcp:get_project` until `status === "ACTIVE_HEALTHY"`, then fetch `get_project_url` and `get_publishable_keys`.

- [ ] **Step 3: Write `.env.example` and `.env.local`**

- `.env.example`: document `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and optional `NEXT_PUBLIC_ALLOW_CAMERA_FALLBACK=false`.
- `.env.local`: populate `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from step 2, plus `NEXT_PUBLIC_ALLOW_CAMERA_FALLBACK=false`.

- [ ] **Step 4: Write SQL migration `/Users/yubin/Projects/ongi-board/supabase/migrations/20261117000000_init_ongi_board.sql`**

Include:
- Tables: `public.profiles`, `public.rooms`, `public.room_members`, `public.daily_checkins` (`member_id TEXT REFERENCES public.room_members(id) ON DELETE SET NULL`, `author_nickname`, `author_avatar_initial`, `UNIQUE (room_id, user_id, checkin_date)`), `public.checkin_likes`.
- Indexes on `room_members(room_id)`, `room_members(user_id)`, `daily_checkins(room_id, checkin_date)`, `daily_checkins(user_id, checkin_date)`.
- `handle_new_user()` trigger on `auth.users` and `sync_checkin_likes_count()` trigger on `public.checkin_likes`.
- RLS policies on all 5 tables using `(SELECT auth.uid())` (with `SET search_path = public` on all `SECURITY DEFINER` functions).
- Atomic `SECURITY DEFINER` RPCs:
  - `public.apply_room_eviction(p_room_id TEXT, p_evicted_ids TEXT[], p_new_host_id TEXT) RETURNS void`
  - `public.join_room_atomic(p_room_id TEXT, p_member_id TEXT, p_today TEXT) RETURNS JSONB` (locks room `FOR UPDATE`, validates duplicate join & capacity `< max_capacity`, inserts `room_members` row for `auth.uid()`)
  - `public.apply_checkin_streak(p_room_id TEXT, p_member_id TEXT, p_member_streak INTEGER, p_today TEXT, p_room_streak INTEGER, p_last_completed_date TEXT) RETURNS void`
- Storage bucket `checkins` (`public = true`, `file_size_limit = 5242880`, allowed MIME `image/jpeg`, `image/png`, `image/webp`) and `storage.objects` policies allowing public `SELECT` on `checkins` and owner-folder `(storage.foldername(name))[1] = (SELECT auth.uid())::text` `INSERT`/`DELETE`.

- [ ] **Step 5: Apply migration and verify database state**

Call `supabase_mcp:apply_migration` with `name: "init_ongi_board"` and verify with `supabase_mcp:list_tables` and `supabase_mcp:execute_sql` (`SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'checkins'`).
Expected: All 5 tables, triggers, RPCs, and `checkins` bucket exist.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .env.example supabase/migrations/20261117000000_init_ongi_board.sql
git commit -m "feat: provision Supabase schema, RLS policies, atomic RPCs, and Storage bucket"
```

---

### Task 2: Types, Supabase SSR Clients, Middleware & Multi-User Repository

**Files:**
- Modify: `/Users/yubin/Projects/ongi-board/src/types/ongi.ts`
- Create: `/Users/yubin/Projects/ongi-board/src/lib/supabase/client.ts`
- Create: `/Users/yubin/Projects/ongi-board/src/lib/supabase/server.ts`
- Create: `/Users/yubin/Projects/ongi-board/src/lib/supabase/middleware.ts`
- Create: `/Users/yubin/Projects/ongi-board/src/middleware.ts`
- Create: `/Users/yubin/Projects/ongi-board/src/lib/store-memory.ts`
- Create: `/Users/yubin/Projects/ongi-board/src/lib/store-supabase.ts`
- Modify: `/Users/yubin/Projects/ongi-board/src/lib/repository.ts`
- Remove: `/Users/yubin/Projects/ongi-board/src/lib/db.ts`, `/Users/yubin/Projects/ongi-board/src/lib/seed-data.ts`
- Test: `/Users/yubin/Projects/ongi-board/tests/repository.test.ts`

**Interfaces:**
- Produces (`src/types/ongi.ts`):
  - `UserProfile = { id: string; email: string; nickname: string; avatarInitial: string }`
  - `DailyCheckin.memberId: string | null`, `DailyCheckin.userId: string`
  - `RoomDetailResponse.isJoined: boolean`
- Produces (`src/lib/supabase/client.ts`, `server.ts`, `middleware.ts`):
  - `createBrowserSupabaseClient()`
  - `createServerSupabaseClient(): Promise<SupabaseClient>`
  - `updateSession(request: NextRequest): Promise<NextResponse>`
- Produces (`src/lib/repository.ts`):
  - `OngiStore` interface (consumed by repository functions and implemented by `SupabaseOngiStore` and `InMemoryOngiStore`)
  - Async multi-user exports:
    - `listRoomsOverview(user: UserProfile, params?: { today?: string; query?: string; filter?: string }, store?: OngiStore): Promise<{ myRooms: RoomSummary[]; exploreRooms: RoomSummary[]; weekRhythm: WeekRhythmDay[] }>`
    - `createRoom(user: UserProfile, input: { title: string; tag: string; category?: string; maxCapacity: RoomCapacity }, today?: string, store?: OngiStore): Promise<RoomDetailResponse>`
    - `getRoomDetail(user: UserProfile, roomId: string, selectedDate?: string, today?: string, store?: OngiStore): Promise<RoomDetailResponse | null>`
    - `joinRoom(user: UserProfile, roomId: string, today?: string, store?: OngiStore): Promise<{ ok: true; room: RoomDetailResponse } | { ok: false; status: 404 | 409; error: string }>`
    - `submitPhotoCheckin(user: UserProfile, roomId: string, input: { imageData: string; note?: string; timestampLabel?: string }, today?: string, store?: OngiStore): Promise<{ ok: true; checkin: DailyCheckin; room: RoomDetailResponse } | { ok: false; status: 400 | 404 | 409; error: string }>`
    - `submitRestPass(user: UserProfile, roomId: string, today?: string, store?: OngiStore): Promise<{ ok: true; checkin: DailyCheckin; room: RoomDetailResponse } | { ok: false; status: 400 | 404 | 409; error: string }>`
    - `toggleCheckinLike(user: UserProfile, checkinId: string, store?: OngiStore): Promise<{ ok: true; checkin: DailyCheckin } | { ok: false; status: 404; error: string }>`
    - `getAlbumEntries(user: UserProfile, params?: { month?: string; roomId?: string; today?: string }, store?: OngiStore): Promise<AlbumResponse>`

- [ ] **Step 1: Update `src/types/ongi.ts` and write failing multi-user repository tests in `tests/repository.test.ts`**

Write tests using `createInMemoryOngiStore()` verifying:
- Empty initial state (`myRooms: []`, `exploreRooms: []`, `weekRhythm` has 7 false days) with zero fake seeds.
- Multi-user room creation, explore discovery, `409` full/duplicate join, `isJoined` flag on `getRoomDetail`.
- Photo check-in decoding (`data:image/jpeg;base64,...`) stored as a URL (`https://...` or `/mock-storage/...`), invalid image format/oversize rejected with `400`, 100% completion streak increment guarded against duplicate same-day increments.
- Review Focus #2: 3-day inactive eviction (`protectCurrentUser: false`) removes inactive member from `members`, transfers `isHost`, preserves evicted user's `/album` entries, `weekRhythm` activity dot, and past-date room board tiles.
- Review Focus #3: User who checks in or uses a rest pass, is evicted on a later day within the same week (or re-joins same day), cannot submit a duplicate check-in (`409`) or second weekly rest pass (`400`).
- Multi-user likes: `userA` and `userB` independently toggle `likedByMe` while sharing `likesCount`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/repository.test.ts`
Expected: FAIL (`Cannot find module '@/lib/store-memory'` / signature mismatch).

- [ ] **Step 3: Implement `src/lib/supabase/*`, `src/middleware.ts`, `src/lib/store-memory.ts`, `src/lib/store-supabase.ts`, and async `src/lib/repository.ts`**

- Implement `createBrowserSupabaseClient`, `createServerSupabaseClient`, and `updateSession` in `src/lib/supabase/*`.
- Implement `src/middleware.ts` matching all app/API routes except `/_next/*`, `/favicon.ico`, and `/api/auth/*`: unauthenticated page requests redirect to `/auth`; authenticated `/auth` redirects to `/`; unauthenticated `/api/*` returns `401 { error: '로그인이 필요해요.' }`.
- Implement `SupabaseOngiStore` calling Supabase tables, `storage.from('checkins').upload(...)`, and RPCs `apply_room_eviction`, `join_room_atomic`, `apply_checkin_streak`.
- Implement `InMemoryOngiStore` mirroring exact PostgreSQL/Storage constraints (`UNIQUE (room_id, user_id, checkin_date)`, `ON DELETE SET NULL`, `checkin_likes` per user, 3MB JPEG/PNG data-URL validation).
- Refactor `src/lib/repository.ts` to validate JPEG/PNG base64 payloads, run `evaluateInactiveEvictions({ members, today, protectCurrentUser: false })`, compute historical check-in boards for past dates, and map `UserProfile` cleanly.
- Remove `src/lib/db.ts` and `src/lib/seed-data.ts`.

- [ ] **Step 4: Run repository & domain tests to verify they pass**

Run: `npx vitest run tests/domain.test.ts tests/repository.test.ts`
Expected: PASS (all assertions green).

- [ ] **Step 5: Commit**

```bash
git add -A src/types/ongi.ts src/lib src/middleware.ts tests/repository.test.ts
git commit -m "feat: replace SQLite demo layer with Supabase SSR, middleware, and multi-user repository"
```

---

### Task 3: Auth Helper, Auth Routes & Protected REST API Handlers

**Files:**
- Create: `/Users/yubin/Projects/ongi-board/src/lib/auth.ts`
- Create: `/Users/yubin/Projects/ongi-board/src/app/api/auth/signup/route.ts`
- Create: `/Users/yubin/Projects/ongi-board/src/app/api/auth/login/route.ts`
- Create: `/Users/yubin/Projects/ongi-board/src/app/api/auth/logout/route.ts`
- Modify: `/Users/yubin/Projects/ongi-board/src/app/api/rooms/route.ts`
- Modify: `/Users/yubin/Projects/ongi-board/src/app/api/rooms/[id]/route.ts`
- Modify: `/Users/yubin/Projects/ongi-board/src/app/api/rooms/[id]/join/route.ts`
- Modify: `/Users/yubin/Projects/ongi-board/src/app/api/rooms/[id]/checkin/route.ts`
- Modify: `/Users/yubin/Projects/ongi-board/src/app/api/rooms/[id]/rest/route.ts`
- Modify: `/Users/yubin/Projects/ongi-board/src/app/api/checkins/[id]/like/route.ts`
- Modify: `/Users/yubin/Projects/ongi-board/src/app/api/album/route.ts`
- Test: `/Users/yubin/Projects/ongi-board/tests/api.test.ts`

**Interfaces:**
- Consumes (`src/lib/repository.ts`, `src/lib/supabase/server.ts`)
- Produces (`src/lib/auth.ts`):
  - `getAuthenticatedUser(): Promise<UserProfile | null>` (reads verified `supabase.auth.getUser()` and `profiles` row; returns `null` when unauthenticated)
  - `requireAuthenticatedUser(): Promise<{ user: UserProfile } | { response: Response }>` (returns `401` JSON `{ error: '로그인이 필요해요.' }` when `null`)
- Produces Auth endpoints:
  - `POST /api/auth/signup` (`{ email, password, nickname }`) -> `201 { user, needsEmailConfirmation }` | `400` | `409`
  - `POST /api/auth/login` (`{ email, password }`) -> `200 { user }` | `400` | `401`
  - `POST /api/auth/logout` -> `200 { ok: true }`

- [ ] **Step 1: Write failing multi-user & auth-guard API tests in `tests/api.test.ts`**

Mock `@/lib/auth` (`getAuthenticatedUser`) and wire a shared `InMemoryOngiStore` via `@/lib/repository` helper (`setTestStoreOverride(store)` / `resetTestStoreOverride()`):
- Review Focus #1: When `getAuthenticatedUser` returns `null`, `GET /api/rooms`, `POST /api/rooms`, `GET /api/rooms/[id]`, `POST /api/rooms/[id]/join`, `POST /api/rooms/[id]/checkin`, `POST /api/rooms/[id]/rest`, `POST /api/checkins/[id]/like`, and `GET /api/album` all return HTTP `401`.
- Multi-user workflow: User A creates a 2-person room (`201`), User B views room detail (`isJoined: false`), likes/joins (`200`), User A and User B submit JPEG photo check-ins (`201`, Review Focus #5 rejects malformed `imageData` with `400`), room hits 100% completion and `streakDays === 1`, and `/api/album` returns only the caller's own check-ins.

- [ ] **Step 2: Run API tests to verify they fail**

Run: `npx vitest run tests/api.test.ts`
Expected: FAIL (`Cannot find module '@/lib/auth'`).

- [ ] **Step 3: Implement `src/lib/auth.ts`, `/api/auth/*`, and update all 7 REST API routes**

- Implement `getAuthenticatedUser()` and Korean auth error mapping in `src/lib/auth.ts`.
- Implement `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout` using `createServerSupabaseClient()`.
- Update all 7 existing route handlers to `await requireAuthenticatedUser()`, pass `user` to async `repository.ts` functions, and support `setTestStoreOverride` cleanly for unit tests.

- [ ] **Step 4: Run API tests to verify they pass**

Run: `npx vitest run tests/api.test.ts`
Expected: PASS (all assertions green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/repository.ts src/app/api tests/api.test.ts
git commit -m "feat: add Supabase authentication endpoints and 401 guards across REST API"
```

---

### Task 4: Cozy Daylight `/auth` Screen, Non-Member Preview UI & Production Camera Guard

**Files:**
- Create: `/Users/yubin/Projects/ongi-board/src/components/AuthClient.tsx`
- Create: `/Users/yubin/Projects/ongi-board/src/app/auth/page.tsx`
- Modify: `/Users/yubin/Projects/ongi-board/src/app/page.tsx`
- Modify: `/Users/yubin/Projects/ongi-board/src/components/HomeClient.tsx`
- Modify: `/Users/yubin/Projects/ongi-board/src/app/rooms/[id]/page.tsx`
- Modify: `/Users/yubin/Projects/ongi-board/src/components/RoomBoardClient.tsx`
- Modify: `/Users/yubin/Projects/ongi-board/src/components/LiveCameraModal.tsx`
- Modify: `/Users/yubin/Projects/ongi-board/src/app/explore/page.tsx`
- Modify: `/Users/yubin/Projects/ongi-board/src/app/album/page.tsx`
- Test: `/Users/yubin/Projects/ongi-board/tests/ui-guards.test.ts`

**Interfaces:**
- Consumes `getAuthenticatedUser()` (redirects to `/auth` if `null` as defense-in-depth alongside middleware), async `repository.ts` functions, `/api/auth/*`, `/api/rooms/**`.
- Produces Cozy Daylight `/auth` login/signup UI, `HomeClient` user nickname + logout button, `RoomBoardClient` non-member preview mode + historical former-member tile display, and `LiveCameraModal` production camera enforcement (`NEXT_PUBLIC_ALLOW_CAMERA_FALLBACK !== 'true'`).

- [ ] **Step 1: Write failing unit/component guard tests in `tests/ui-guards.test.ts`**

Test extracted helper predicates used by `RoomBoardClient` and `LiveCameraModal`:
- `resolveRoomBoardFooterState({ isJoined, memberCount, maxCapacity, myStatusOnSelectedDate, restPassesLeftThisWeek, isToday })`:
  - Review Focus #4: when `isJoined === false` and `memberCount < maxCapacity`, returns `'joinable-preview'`; when full, returns `'full-preview'`.
- `isCameraShutterAllowed({ cameraMode, allowFallback })`:
  - Review Focus #5: returns `true` only when `cameraMode === 'live'`, or when `cameraMode === 'fallback' && allowFallback === true`; returns `false` in production when `cameraMode !== 'live'`.

- [ ] **Step 2: Run guard tests to verify they fail**

Run: `npx vitest run tests/ui-guards.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `/auth` screen and update Server Pages + Client Components**

- Build `AuthClient.tsx` + `src/app/auth/page.tsx`: Cozy Daylight card with 로그인 / 회원가입 tabs, nickname (`2~12` chars), email, password (`>= 6` chars), error banner, confirmation-email state if `needsEmailConfirmation === true`, and redirect to `/` on success.
- Update `src/app/page.tsx` & `HomeClient.tsx`: pass `userProfile` (`nickname`), render nickname badge + `로그아웃` button calling `POST /api/auth/logout` -> `router.push('/auth')`.
- Update `src/app/rooms/[id]/page.tsx` & `RoomBoardClient.tsx`:
  - Support `detail.isJoined`: when `!detail.isJoined`, show non-member preview footer with `함께하기` button (`POST /api/rooms/[id]/join`) or full-room preview notice instead of `"오늘은 쉬어가기"`.
  - When viewing past dates (`!isToday`), render tiles for historical check-ins whose `memberId === null` or whose `memberId` is no longer in `detail.members` (`authorNickname`, `authorAvatarInitial`) so evicted members' past check-ins remain visible.
- Update `LiveCameraModal.tsx`: enforce `isCameraShutterAllowed` (`allowFallback = process.env.NEXT_PUBLIC_ALLOW_CAMERA_FALLBACK === 'true'`). In production without a live camera, show `"실시간 카메라 연결이 필요해요"` guidance, a `"카메라 다시 연결"` retry button, and disable shutter capture.
- Update `src/app/explore/page.tsx` and `src/app/album/page.tsx` to `await getAuthenticatedUser()` and pass `user` to async `repository.ts` methods.

- [ ] **Step 4: Run tests and TypeScript check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All test suites pass and `tsc --noEmit` exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/app src/components tests/ui-guards.test.ts
git commit -m "feat: add Cozy Daylight /auth screen, non-member preview UI, and production camera guard"
```

---

### Task 5: Production Build, Security Advisors, End-to-End Verification & Push

**Files:**
- Modify: `/Users/yubin/Projects/ongi-board/README.md`

- [ ] **Step 1: Update `README.md` with Supabase setup & Vercel deployment instructions**

Document `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ALLOW_CAMERA_FALLBACK`, Supabase migration/Storage bucket setup, and Vercel/Capacitor deployment steps.

- [ ] **Step 2: Run Supabase security & performance advisors**

Call `supabase_mcp:get_advisors` (`type: "security"` and `type: "performance"`) on the `ongi-board` project. Fix any missing `RLS` or `search_path` warning if reported.

- [ ] **Step 3: Run full Vitest suite, TypeScript check, and Next.js production build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: 100% tests pass, 0 TypeScript errors, clean `.next` production build.

- [ ] **Step 4: Verify live production server routes & Supabase auth round-trip**

Start `npm start` on a verification port, verify:
- Unauthenticated `GET /` redirects (`307` -> `/auth`), `GET /auth` returns `200`, `GET /api/rooms` returns `401`.
- Authenticated flow via Supabase Auth test user (sign up/login -> `GET /` `200` empty state -> `POST /api/rooms` `201` -> `POST /api/rooms/[id]/checkin` uploads JPEG to Supabase Storage `checkins` bucket -> `GET /api/album` returns the entry -> clean up test user/data afterwards so production DB starts completely clean!).
Stop the verification server cleanly.

- [ ] **Step 5: Commit and push to GitHub**

```bash
git add README.md
git commit -m "docs: update README with Supabase production deployment guide"
git push origin main
```

---

## Self-Review Check
- **Spec coverage**: Covers all sections of `2026-11-17-ongi-board-supabase-design.md` (5 PostgreSQL tables, triggers, RLS, 3 atomic `SECURITY DEFINER` RPCs, Storage `checkins` bucket, `@supabase/ssr` middleware & `/auth`, removal of `db.ts`/`seed-data.ts`, post-eviction preservation, non-member preview, production live-camera enforcement, and `.env.example`/deployment docs).
- **Type consistency**: `UserProfile`, `OngiStore`, `DailyCheckin.memberId: string | null`, `RoomDetailResponse.isJoined`, and async repository signatures align across Tasks 2, 3, and 4.
- **Review Focus coverage**: All 5 review focus failure modes are pinned directly to tests in Tasks 2, 3, and 4.
