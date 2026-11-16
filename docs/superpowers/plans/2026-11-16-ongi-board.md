# 온기보드 (Ongi Board) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build **온기보드 (Ongi Board)**, a Setlog-style self-development photo check-in full-stack app using Next.js (App Router, TypeScript), Node's built-in `node:sqlite`, and the Cozy Daylight design system, structured cleanly for future Capacitor iOS/Android packaging.

**Architecture:** Pure domain rules (`src/lib/domain.ts`) sit cleanly separate from SQLite persistence (`src/lib/db.ts`, `src/lib/repository.ts`), Next.js REST API handlers (`src/app/api/**`), and mobile-first UI screens (`src/app/**`, `src/components/**`). Camera capture uses a dedicated `src/lib/camera-adapter.ts` module (`getUserMedia` + `<canvas>` timestamp stamping with a live-canvas fallback when camera hardware is unavailable) so Capacitor's native camera plugin can swap in later without UI rewrites.

**Tech Stack:** Next.js 15+ (App Router), React 19, TypeScript, Node.js v26 (`node:sqlite` `DatabaseSync`), Vitest, Tailwind/CSS Modules & CSS Custom Properties, Capacitor configuration (`capacitor.config.ts`).

**Spec:** `/Users/yubin/Projects/ongi-board/docs/superpowers/specs/2026-11-16-ongi-board-design.md`

## Global Constraints

- **Project Root**: `/Users/yubin/Projects/ongi-board` (do not write source files outside this directory).
- **No Mandatory Todos / No Group Chat**: Zero personal todo-list features and zero multi-user free-text chat rooms.
- **No Gallery Upload**: Never render `<input type="file">` anywhere in the camera or check-in flow; only live in-app camera capture + canvas fallback is permitted.
- **Single-Room Immersion**: On `/rooms/[id]`, never render a top switcher to jump directly to another room; return to `/` via `‹ 목록으로`.
- **Cozy Daylight Visual Standard**: Use `#F4EDE2` Warm Oat canvas with SVG grain overlay, `#FAF6F0` Warm Milk app background, `#FFFDF9` Cream Ivory surfaces, `#EE6348` Persimmon Coral, `#F2A93B` Marigold Honey, `#4F9866` Clover Sage, `#281F1A` Espresso Ink, `Pretendard Variable` × `Fraunces` typography, and unified 2px rounded-stroke inline SVG icons (zero decorative emojis).
- **Zero Native C++ SQLite Addons**: Use Node v26 built-in `node:sqlite` (`DatabaseSync`) so installation and execution require no native compilation.

## Review Focus

1. **Same-day duplicate streak increment**: Multiple members checking in or completing a room on the same day `D` must never increment `rooms.streak_days` more than once (`rooms.last_completed_date === D` guard).
2. **Capacity & duplicate join guard**: Attempting to join a room already at `max_capacity` or already joined by `user_me` must fail cleanly with HTTP `409` without creating duplicate `room_members` rows.
3. **Weekly rest-pass limit**: Attempting to use a second rest pass (`status = 'rest'`) in the same Monday–Sunday week within the same room must fail cleanly with HTTP `400`.
4. **Once-per-day check-in exclusivity**: Submitting both a photo check-in and a rest pass (or two photo check-ins) on the same day in the same room must be rejected with HTTP `409`.
5. **3-day inactive eviction boundaries & host transfer**: Eviction evaluates only completed past days (`D-3, D-2, D-1`), never evicts the last remaining member of a room, protects `is_current_user = 1` in demo sync while supporting full testing via pure domain logic, and transfers `is_host = 1` to the earliest-joined remaining member if a host is evicted.

---

### Task 1: Project Setup & Pure Domain Engine

**Files:**
- Create: `/Users/yubin/Projects/ongi-board/package.json`
- Create: `/Users/yubin/Projects/ongi-board/tsconfig.json`
- Create: `/Users/yubin/Projects/ongi-board/next.config.ts`
- Create: `/Users/yubin/Projects/ongi-board/vitest.config.ts`
- Create: `/Users/yubin/Projects/ongi-board/.gitignore`
- Create: `/Users/yubin/Projects/ongi-board/src/types/ongi.ts`
- Create: `/Users/yubin/Projects/ongi-board/src/lib/domain.ts`
- Test: `/Users/yubin/Projects/ongi-board/tests/domain.test.ts`

**Interfaces:**
- Produces (`src/types/ongi.ts`):
  - `RoomCapacity = 2 | 4 | 6`
  - `CheckinStatus = 'photo' | 'rest'`
  - `LayoutMode = 'single' | 'split-2' | 'split-3' | 'grid-2x2' | 'grid-2x3'`
  - `Room`, `RoomMember`, `DailyCheckin`, `RoomSummary`, `RoomDetailResponse`, `AlbumResponse`
- Produces (`src/lib/domain.ts`):
  - `getTodayKst(now?: Date): string`
  - `shiftDate(dateStr: string, deltaDays: number): string`
  - `getMondayOfWeek(dateStr: string): string`
  - `resolveBoardLayout(memberCount: number): LayoutMode`
  - `computeCompletionStats(memberCount: number, completedCount: number): { completedCount: number; totalCount: number; percent: number; isComplete: boolean }`
  - `computeNextRoomStreak(params: { currentStreak: number; lastCompletedDate: string | null; today: string; isRoomCompleteToday: boolean }): { streakDays: number; lastCompletedDate: string | null }`
  - `computeNextMemberStreak(params: { currentStreak: number; lastActiveDate: string | null; today: string }): number`
  - `evaluateInactiveEvictions(params: { members: RoomMember[]; today: string; protectCurrentUser?: boolean }): { kept: RoomMember[]; evictedIds: string[]; newHostMemberId: string | null }`
  - `sortExploreRooms<T extends { memberCount: number; maxCapacity: number; streakDays: number }>(rooms: T[]): T[]`

- [ ] **Step 1: Initialize project configuration files and install dependencies**

Create `package.json`, `tsconfig.json`, `next.config.ts` (including `images: { unoptimized: true }` and `serverExternalPackages: []`), `vitest.config.ts`, and `.gitignore` (`node_modules`, `.next`, `data/*.db`, `out`). Install `next`, `react`, `react-dom`, `typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `vitest`, `@vitejs/plugin-react` via `npm install`.

- [ ] **Step 2: Create shared TypeScript types in `src/types/ongi.ts`**

Define exact interfaces for `Room`, `RoomMember`, `DailyCheckin`, `RoomSummary` (includes `id`, `title`, `tag`, `category`, `maxCapacity`, `memberCount`, `streakDays`, `completedCount`, `completionPercent`, `myStatusToday: 'pending' | 'photo' | 'rest'`, `previewTiles`, `restPassesLeftThisWeek`), `RoomDetailResponse` (includes `room`, `members`, `checkins`, `selectedDate`, `availableDates`, `layoutMode`, `completion`, `restPassesLeftThisWeek`, `sameTagInspiration`), and `AlbumResponse`.

- [ ] **Step 3: Write the failing domain tests in `tests/domain.test.ts`**

Write tests covering:
- `resolveBoardLayout`: `1 -> 'single'`, `2 -> 'split-2'`, `3 -> 'split-3'`, `4 -> 'grid-2x2'`, `5 -> 'grid-2x3'`, `6 -> 'grid-2x3'`.
- `computeCompletionStats`: `(4, 3) -> 75%`, `(2, 2) -> 100%`, `(3, 1) -> 33%`, `(0, 0) -> 0%`.
- `computeNextRoomStreak`:
  - Review Focus #1: calling on same `today` when `lastCompletedDate === today` keeps `streakDays` unchanged (never increments twice on the same day).
  - Completing today when `lastCompletedDate === shiftDate(today, -1)` increments `streakDays` by 1.
  - Missing yesterday (`lastCompletedDate < shiftDate(today, -1)`) resets `streakDays` to `1` on completion.
- `evaluateInactiveEvictions`:
  - Review Focus #5: member with `joined_at <= D-3` and `last_active_date < D-3` is evicted, while `joined_at > D-3` (joined within 3 days) or `last_active_date >= D-3` is kept.
  - Review Focus #5: single remaining member in a room is NEVER evicted even if inactive for >3 days.
  - Review Focus #5: when an evicted member has `isHost === true`, `newHostMemberId` points to the earliest `joinedAt` among `kept` members and `kept` reflects updated `isHost`.
  - When `protectCurrentUser` is `true`, `isCurrentUser === true` is kept; when `false`, `isCurrentUser` follows normal eviction rules.
- `sortExploreRooms`: rooms with 1 open slot (`maxCapacity - memberCount === 1`) sort first, then other under-capacity rooms (`memberCount < maxCapacity`), with higher `streakDays` breaking ties.

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run tests/domain.test.ts`
Expected: FAIL (`Cannot find module '../src/lib/domain'`).

- [ ] **Step 5: Implement `src/lib/domain.ts` and re-run tests**

Implement all pure date, layout, completion, streak, eviction, and explore-sorting functions cleanly with zero side effects.
Run: `npx vitest run tests/domain.test.ts`
Expected: PASS (all assertions green).

- [ ] **Step 6: Commit**

```bash
git init && git add package.json tsconfig.json next.config.ts vitest.config.ts .gitignore src/types/ongi.ts src/lib/domain.ts tests/domain.test.ts
git commit -m "chore: setup Next.js + Vitest and implement pure domain engine"
```

---

### Task 2: SQLite Database Layer & Seed Data (`node:sqlite`)

**Files:**
- Create: `/Users/yubin/Projects/ongi-board/src/lib/db.ts`
- Create: `/Users/yubin/Projects/ongi-board/src/lib/seed-data.ts`
- Create: `/Users/yubin/Projects/ongi-board/src/lib/repository.ts`
- Test: `/Users/yubin/Projects/ongi-board/tests/repository.test.ts`

**Interfaces:**
- Consumes (`src/types/ongi.ts`, `src/lib/domain.ts`)
- Produces (`src/lib/db.ts`):
  - `getDb(overridePath?: string): DatabaseSync` (reads `process.env.ONGI_DB_PATH` or defaults to `path.join(process.cwd(), 'data', 'ongi.db')`, creates tables `rooms`, `room_members`, `daily_checkins`, and triggers `seedDatabaseIfEmpty(db, today)`)
  - `closeAndResetDbCache(): void`
- Produces (`src/lib/repository.ts`):
  - `listRoomsOverview(params?: { today?: string; query?: string; filter?: string }): { myRooms: RoomSummary[]; exploreRooms: RoomSummary[]; weekRhythm: { label: string; date: string; done: boolean; isToday: boolean }[] }`
  - `createRoom(input: { title: string; tag: string; category?: string; maxCapacity: RoomCapacity }, today?: string): RoomDetailResponse`
  - `getRoomDetail(roomId: string, selectedDate?: string, today?: string): RoomDetailResponse | null`
  - `joinRoom(roomId: string, today?: string): { ok: true; room: RoomDetailResponse } | { ok: false; status: 404 | 409; error: string }`
  - `submitPhotoCheckin(roomId: string, input: { imageData: string; note: string; timestampLabel?: string }, today?: string): { ok: true; checkin: DailyCheckin; room: RoomDetailResponse } | { ok: false; status: 400 | 404 | 409; error: string }`
  - `submitRestPass(roomId: string, today?: string): { ok: true; checkin: DailyCheckin; room: RoomDetailResponse } | { ok: false; status: 400 | 404 | 409; error: string }`
  - `toggleCheckinLike(checkinId: string): { ok: true; checkin: DailyCheckin } | { ok: false; status: 404; error: string }`
  - `getAlbumEntries(params?: { month?: string; roomId?: string; today?: string }): AlbumResponse`

- [ ] **Step 1: Write the failing repository tests in `tests/repository.test.ts`**

Using a temporary SQLite path via `process.env.ONGI_DB_PATH` per test, write tests verifying:
- Auto-seeding creates 3 joined rooms (`저녁 운동 메이트` at 75%, `밤 10시 차분한 독서방` at 100%, `퇴근 후 사이드 작업실` at 33%) plus 4 explore rooms (with 1-slot-left, 2/4, and 1/4 rooms) and past 3-day history records.
- `createRoom` creates the room with normalized `#tag`, inserts `user_me` as `is_host = 1`, and returns `layoutMode: 'single'`.
- Review Focus #2: `joinRoom` succeeds when `memberCount < maxCapacity`, returns `{ status: 409 }` when room is already full (`maxCapacity`) or when `user_me` is already a member.
- Review Focus #1 & #4: `submitPhotoCheckin` on `저녁 운동 메이트` increases completion from `75%` to `100%` and increments `streakDays` from `12` to `13`; calling `submitPhotoCheckin` or `submitRestPass` a second time on the same day returns `{ status: 409 }`.
- Review Focus #3: `submitRestPass` succeeds once in a Monday–Sunday week (marking slot `'rest'`), and calling `submitRestPass` a second time in another day of the same Monday–Sunday week in the same room returns `{ status: 400 }`.
- `toggleCheckinLike` toggles `likedByMe` and updates `likesCount` persistently.
- `getAlbumEntries` returns all `user_me` photo & rest check-ins filterable by `YYYY-MM` and `roomId`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/repository.test.ts`
Expected: FAIL (`Cannot find module '../src/lib/repository'`).

- [ ] **Step 3: Implement `src/lib/db.ts`, `src/lib/seed-data.ts`, and `src/lib/repository.ts`**

- In `src/lib/db.ts`: use `new DatabaseSync(dbPath)` from `node:sqlite`, create `rooms`, `room_members`, `daily_checkins` with foreign keys and unique index on `(room_id, member_id, checkin_date)`.
- In `src/lib/seed-data.ts`: provide high-craft inline SVG-rendered photographic/editorial data-URLs OR verified Unsplash URLs with warm fallback for seeded tiles so zero broken images occur offline or online. Seed the exact 3 joined rooms + 4 explore rooms (including an active 1-person room `#아침루틴` so users can also test the 1-person same-tag strip upon joining/creating!).
- In `src/lib/repository.ts`: run `syncRoomEvictions(db, roomId, today)` during `listRoomsOverview` / `getRoomDetail` using `evaluateInactiveEvictions`, enforce weekly Monday–Sunday rest-pass limit (`getMondayOfWeek(today)`), enforce 1 check-in per day per room, and update `rooms.streak_days` + `rooms.last_completed_date` via `computeNextRoomStreak`.

- [ ] **Step 4: Run repository tests to verify they pass**

Run: `npx vitest run tests/repository.test.ts`
Expected: PASS (all assertions green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts src/lib/seed-data.ts src/lib/repository.ts tests/repository.test.ts
git commit -m "feat: add node:sqlite database layer, seed data, and domain repository"
```

---

### Task 3: Next.js App Router REST API Routes

**Files:**
- Create: `/Users/yubin/Projects/ongi-board/src/app/api/rooms/route.ts`
- Create: `/Users/yubin/Projects/ongi-board/src/app/api/rooms/[id]/route.ts`
- Create: `/Users/yubin/Projects/ongi-board/src/app/api/rooms/[id]/join/route.ts`
- Create: `/Users/yubin/Projects/ongi-board/src/app/api/rooms/[id]/checkin/route.ts`
- Create: `/Users/yubin/Projects/ongi-board/src/app/api/rooms/[id]/rest/route.ts`
- Create: `/Users/yubin/Projects/ongi-board/src/app/api/checkins/[id]/like/route.ts`
- Create: `/Users/yubin/Projects/ongi-board/src/app/api/album/route.ts`
- Test: `/Users/yubin/Projects/ongi-board/tests/api.test.ts`

**Interfaces:**
- Consumes (`src/lib/repository.ts`)
- Produces HTTP JSON endpoints:
  - `GET /api/rooms?query=&filter=` -> `200 { myRooms, exploreRooms, weekRhythm }`
  - `POST /api/rooms` (`{ title, tag, category?, maxCapacity }`) -> `201 { room }` | `400`
  - `GET /api/rooms/[id]?date=YYYY-MM-DD` -> `200 RoomDetailResponse` | `404`
  - `POST /api/rooms/[id]/join` -> `200 { room }` | `404` | `409`
  - `POST /api/rooms/[id]/checkin` (`{ imageData, note, timestampLabel? }`) -> `201 { checkin, room }` | `400` | `404` | `409`
  - `POST /api/rooms/[id]/rest` -> `201 { checkin, room }` | `400` | `404` | `409`
  - `POST /api/checkins/[id]/like` -> `200 { checkin }` | `404`
  - `GET /api/album?month=YYYY-MM&roomId=` -> `200 AlbumResponse`

- [ ] **Step 1: Write failing API handler tests in `tests/api.test.ts`**

Import the Next.js route handlers directly and invoke them with `new Request(...)` and `{ params: Promise.resolve({ id }) }` against a temp `ONGI_DB_PATH`:
- Test `GET /api/rooms` returns 200 with seeded rooms and `weekRhythm`.
- Test `POST /api/rooms` validates missing `title` (`400`) and creates a valid room (`201`).
- Test `POST /api/rooms/[id]/join` returns `409` when full (`밤 10시 차분한 독서방` 2/2) or already joined (`저녁 운동 메이트`), and `200` for an open explore room.
- Test `POST /api/rooms/[id]/checkin` rejects empty `imageData` (`400`), accepts valid capture (`201`), and rejects a second submission on the same day (`409`).
- Test `POST /api/rooms/[id]/rest` succeeds once (`201`), and rejects same-day photo check-in (`409`) or second rest pass in the same week (`400`).
- Test `POST /api/checkins/[id]/like` toggles likes (`200`) and returns `404` for unknown ID.
- Test `GET /api/album` returns monthly and room-filtered entries (`200`).

- [ ] **Step 2: Run API tests to verify they fail**

Run: `npx vitest run tests/api.test.ts`
Expected: FAIL (`Cannot find module '../src/app/api/rooms/route'`).

- [ ] **Step 3: Implement all 7 API route handlers**

Implement clean input validation, JSON parsing guards, and exact HTTP status codes (`200`, `201`, `400`, `404`, `409`) across all 7 route files. Ensure `export const dynamic = 'force-dynamic';` is set on GET routes so Next.js never statically caches dynamic SQLite state.

- [ ] **Step 4: Run API tests to verify they pass**

Run: `npx vitest run tests/api.test.ts`
Expected: PASS (all assertions green).

- [ ] **Step 5: Commit**

```bash
git add src/app/api tests/api.test.ts
git commit -m "feat: implement Next.js App Router REST API routes and tests"
```

---

### Task 4: Cozy Daylight UI Screens & Live Camera Stamp Modal

**Files:**
- Create: `/Users/yubin/Projects/ongi-board/src/app/layout.tsx`
- Create: `/Users/yubin/Projects/ongi-board/src/app/globals.css`
- Create: `/Users/yubin/Projects/ongi-board/src/lib/camera-adapter.ts`
- Create: `/Users/yubin/Projects/ongi-board/src/components/Icons.tsx`
- Create: `/Users/yubin/Projects/ongi-board/src/components/BottomNav.tsx`
- Create: `/Users/yubin/Projects/ongi-board/src/components/MiniPolaroid.tsx`
- Create: `/Users/yubin/Projects/ongi-board/src/components/LiveCameraModal.tsx`
- Create: `/Users/yubin/Projects/ongi-board/src/components/HomeClient.tsx`
- Create: `/Users/yubin/Projects/ongi-board/src/app/page.tsx`
- Create: `/Users/yubin/Projects/ongi-board/src/components/RoomBoardClient.tsx`
- Create: `/Users/yubin/Projects/ongi-board/src/app/rooms/[id]/page.tsx`
- Create: `/Users/yubin/Projects/ongi-board/src/components/ExploreClient.tsx`
- Create: `/Users/yubin/Projects/ongi-board/src/app/explore/page.tsx`
- Create: `/Users/yubin/Projects/ongi-board/src/components/AlbumClient.tsx`
- Create: `/Users/yubin/Projects/ongi-board/src/app/album/page.tsx`

**Interfaces:**
- Consumes API endpoints (`GET/POST /api/rooms`, `GET /api/rooms/[id]`, `POST /api/rooms/[id]/join`, `POST /api/rooms/[id]/checkin`, `POST /api/rooms/[id]/rest`, `POST /api/checkins/[id]/like`, `GET /api/album`) and initial server-rendered data from `src/lib/repository.ts`.
- Produces (`src/lib/camera-adapter.ts`):
  - `captureFromStreamWithStamp(videoEl: HTMLVideoElement | null, meta: { roomTitle: string; tag: string; timestampLabel: string }): string` (draws live video frame or warm textured fallback frame onto `<canvas>`, burns subtle corner timestamp + tag stamp, exports JPEG data URL `image/jpeg` at `0.84` quality).

- [ ] **Step 1: Set up `src/app/layout.tsx`, `src/app/globals.css`, and `src/components/Icons.tsx`**

Configure `Pretendard Variable` + `Fraunces` fonts, Cozy Daylight CSS custom properties (`#F4EDE2`, `#FAF6F0`, `#FFFDF9`, `#EE6348`, `#F2A93B`, `#4F9866`, `#281F1A`), SVG fractalNoise paper grain overlay, responsive mobile app shell (`max-width: 430px` centered on desktop with warm shadow framing, full-bleed on mobile), and 2px rounded-stroke SVG icon set (`HomeIcon`, `CompassIcon`, `AlbumIcon`, `CameraIcon`, `FlameIcon`, `CheckIcon`, `HeartIcon`, `CloudIcon`, `CalendarIcon`, `ChevronLeftIcon`, `SearchIcon`, `PlusIcon`).

- [ ] **Step 2: Build `src/lib/camera-adapter.ts` and `src/components/LiveCameraModal.tsx`**

Implement live camera streaming via `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })` with proper track cleanup on close/unmount, plus automatic graceful fallback to a cozy live-preview canvas mode (clearly marked `"카메라 미연결 · 프리뷰 스냅샷 모드"`) if permission is denied or no webcam exists. Never render `<input type="file">`. Include 1-line note input (`maxLength={40}`) and tactile shutter button calling `POST /api/rooms/[id]/checkin`.

- [ ] **Step 3: Build Screen 1 (`src/app/page.tsx` + `HomeClient.tsx` + `MiniPolaroid.tsx` + `BottomNav.tsx`)**

Server component reads `listRoomsOverview()` directly so first paint is instant; `HomeClient` renders greeting header, Monday–Sunday rhythm strip, joined room cards with variable mini polaroid previews, today's completion bar, and status badges linking to `/rooms/[id]`.

- [ ] **Step 4: Build Screen 2 (`src/app/rooms/[id]/page.tsx` + `RoomBoardClient.tsx`)**

Single-room immersion view (no room-switcher tabs). Renders `‹ 목록으로`, `Day N 함께하는 중`, calendar date-history drawer (`🗓️` switching `GET /api/rooms/[id]?date=...`), **우리 방 온기 카드** (completion `%` + member avatar bubbles), variable 1–6 slot polaroid grid (`single` | `split-2` | `split-3` | `grid-2x2` | `grid-2x3`), clickable heart reactions (`POST /api/checkins/[id]/like`), camera slot opening `LiveCameraModal`, `오늘은 쉬어가기` button calling `POST /api/rooms/[id]/rest`, and for 1-person rooms, the subtle same-tag inspiration strip below the board.

- [ ] **Step 5: Build Screen 3 (`src/app/explore/page.tsx` + `ExploreClient.tsx`) and Screen 4 (`src/app/album/page.tsx` + `AlbumClient.tsx`)**

- `/explore`: Live keyword search + tag filter chips (`전체`, `한 자리 남았어요`, `#운동·산책`, `#독서·글쓰기`, `#드로잉·취미`, `#공부·작업`), under-capacity priority room list with `함께하기` (`POST /api/rooms/[id]/join` -> redirect to `/rooms/[id]`), and `+ 새로운 다정한 방 만들기` bottom sheet (`POST /api/rooms` -> redirect to `/rooms/[id]`).
- `/album`: Month selector + room filter chips + calendar grid showing thumbnails / rest-pass badges + modal lightbox on day click.

- [ ] **Step 6: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Exit code 0 with zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/app src/components src/lib/camera-adapter.ts
git commit -m "feat: build Cozy Daylight UI screens, live camera stamp modal, and album"
```

---

### Task 5: Capacitor Config, Full Test Suite & Production Build Verification

**Files:**
- Create: `/Users/yubin/Projects/ongi-board/capacitor.config.ts`
- Create: `/Users/yubin/Projects/ongi-board/README.md`

**Interfaces:**
- Consumes the complete Next.js project from Tasks 1–4.

- [ ] **Step 1: Add `capacitor.config.ts` and `README.md`**

Create `capacitor.config.ts` (`appId: 'com.ongiboard.app'`, `appName: '온기보드'`, `webDir: 'out'`, plus `server.url` documentation for live API mode vs mobile wrapper) and `README.md` documenting local run (`npm run dev`), test (`npm test`), production build (`npm run build`), and iOS/Android Capacitor wrapping steps.

- [ ] **Step 2: Run full automated test suite**

Run: `npx vitest run`
Expected: PASS across `tests/domain.test.ts`, `tests/repository.test.ts`, and `tests/api.test.ts` (zero skipped or failed tests).

- [ ] **Step 3: Run TypeScript check and Next.js production build**

Run: `npx tsc --noEmit && npm run build`
Expected: Clean TypeScript check and `.next` production build with zero errors.

- [ ] **Step 4: Verify live running server routes**

Start `npm run start` briefly, verify `GET /`, `GET /explore`, `GET /album`, `GET /api/rooms`, and `GET /api/album` all return HTTP `200` with expected HTML/JSON content, then stop the verification server cleanly.

- [ ] **Step 5: Commit**

```bash
git add capacitor.config.ts README.md
git commit -m "chore: add Capacitor mobile packaging config and project documentation"
```
