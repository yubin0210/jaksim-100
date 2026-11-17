# 온기보드(Ongi Board) 상용 배포용 Supabase 전환 설계 명세서

작성일: 2026-11-17  
프로젝트 경로: `/Users/yubin/Projects/ongi-board`  
선행 설계서: `/Users/yubin/Projects/ongi-board/docs/superpowers/specs/2026-11-16-ongi-board-design.md`

---

## 1. 기획 의도 및 배경 (Intent & Why)

기존 MVP(`/Users/yubin/Projects/ongi-board`)는 로컬 단일 파일 DB(`node:sqlite`, `data/ongi.db`)와 고정 사용자(`user_me`, `'나'`), 그리고 첫 접속 시 자동 생성되는 가상 시드 데이터(`지훈`, `서연` 등 예시 멤버 및 7개 예시 방)로 구성된 데모 프로토타입이다.

실제 사용자에게 배포해 상용 서비스로 운영하려면 다음 한계를 반드시 해결해야 한다.
1. **데이터 영속성 및 다중 접속 한계**: Vercel 등 서버리스/컨테이너 배포 환경에서는 로컬 SQLite 파일이 재배포·스케일링 시 초기화된다.
2. **실제 사용자 식별 및 보안 부재**: 모든 접속자가 동일 계정(`user_me`)을 공유하므로 다중 사용자 협업 보드와 개인 앨범을 분리할 수 없고, 사칭·무단 수정 방지가 불가능하다.
3. **이미지 저장 구조 한계**: 촬영 사진(Base64 JPEG)을 DB 텍스트 컬럼에 직접 누적하면 DB 용량과 조회 지연이 급증한다.
4. **가짜 예시 데이터 제거**: 상용 환경에서는 시드 데이터를 자동 주입하지 않고, 실제 가입한 사용자가 개설한 방과 실제 촬영 인증만 쌓여야 한다.

본 설계는 기존에 검증된 순수 도메인 규칙(`src/lib/domain.ts`)과 Cozy Daylight UI를 유지하면서, 백엔드를 **Supabase (Auth + PostgreSQL + Storage)** 기반의 상용 아키텍처로 전환하는 것을 목표로 한다.

---

## 2. 목표 / 비목표 / 안티골 (Goals, Non-Goals, Anti-Goals)

### 목표 (Goals)
1. **Supabase 신규 프로젝트 프로비저닝**: `yubin` 조직(`nsvxmftapnwaxnyhvnwo`)에 서울 리전(`ap-northeast-2`) 신규 프로젝트 `ongi-board`를 생성하고 DB 스키마·트리거·RLS 정책·Storage 버킷을 구축한다.
2. **상용 표준 인증·세션 보안 구축**: `@supabase/ssr` + `@supabase/supabase-js` 기반으로 이메일·비밀번호 회원가입/로그인/로그아웃, `HttpOnly` 보안 쿠키 세션 갱신(`src/middleware.ts`), Cozy Daylight `/auth` 화면 및 API 미인증 차단(`401 Unauthorized`)을 구현한다.
3. **다중 사용자 PostgreSQL 데이터 계층 전환**: 가짜 시드 자동 생성을 제거하고, `profiles`, `rooms`, `room_members`, `daily_checkins`, `checkin_likes` 5개 테이블로 다중 사용자 방 참여, 하트 리액션, 3일 미인증 잠수 정리(`protectCurrentUser: false`)를 처리한다.
4. **인증 사진 클라우드 스토리지 분리**: 인앱 카메라 캡처 JPEG 이미지를 서버에서 디코딩해 Supabase Storage 버킷(`checkins`)에 업로드하고, DB에는 Public URL만 저장한다.
5. **무중단 도메인 규칙 계승 및 배포 준비**: `src/lib/domain.ts`의 핵심 규칙(가변 1~6인 보드 레이아웃, 당일 중복 연속일수 증가 방지, 주 1회 월~일 휴식권, 3일 잠수 퇴장 및 방장 승계)을 그대로 유지하고, `.env.example` 및 배포 가이드를 정비한다.

### 비목표 (Non-Goals)
- **결제·유료 구독 기능**: 멤버십 과금 및 결제 모듈은 이번 범위에 포함하지 않는다.
- **네이티브 푸시 알림(FCM/APNs)**: 모바일 푸시 발송 인프라는 추후 Capacitor 네이티브 패키징 단계에서 다룬다.
- **관리자 백오피스 웹**: 운영자용 별도 대시보드는 구축하지 않는다(Supabase 대시보드로 대체).

### 안티골 (Anti-Goals)
- **클라이언트 전달 `userId` 신뢰 금지**: API 및 서버 컴포넌트는 요청 본문의 사용자 ID를 받지 않으며, 반드시 `supabase.auth.getUser()`로 검증된 세션 사용자만 식별한다.
- **갤러리 업로드 허용 금지**: 상용 전환 후에도 `<input type="file">` 기반 갤러리 불러오기는 절대 허용하지 않는다.
- **단체 채팅방화 금지**: 자유 텍스트 채팅 기능 없이 사진 + 1줄 한마디 + 하트 리액션 원칙을 지킨다.

---

## 3. 검토한 구현 방식 (Approaches)

| 방식 | 구성 | 장점 | 트레이드오프 |
| :--- | :--- | :--- | :--- |
| **방식 A (선택)** | **Supabase Auth + PostgreSQL + Storage 풀스택 통합 + Next.js 서버 도메인 엔진 유지** | 인증 보안(`HttpOnly` 쿠키·RLS), DB 영속성, 이미지 스토리지 분리를 모두 상용 표준으로 갖추면서 기존 `domain.ts` 로직과 API 계약을 그대로 재사용 가능 | Supabase 스키마/RLS/Storage 설정 및 환경변수(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) 구성 필요 |
| **방식 B** | Supabase PostgreSQL만 사용 + 자체 쿠키 인증 + Base64 DB 저장 | Supabase Storage·Auth 설정을 건너뛸 수 있음 | 사진 누적 시 DB 성능 저하가 빠르고, 비밀번호 재설정·소셜 로그인 확장이 어려움 |
| **방식 C** | Next.js API 없이 브라우저에서 Supabase 직접 호출 | 서버 라우트 코드량 감소 | `domain.ts`의 복합 규칙(3일 잠수 승계, 주 1회 휴식권, 당일 스트릭 계산)을 PostgreSQL 함수/트리거로 전면 재구현해야 하며 클라이언트 조작 위험 증가 |

**선택 이유**: 상용 배포 안정성과 사진 저장 확장성을 확보하면서도 이미 테스트로 검증된 Next.js API + `domain.ts` 아키텍처를 그대로 활용할 수 있는 **방식 A**를 채택한다.

---

## 4. 상세 아키텍처 및 데이터·보안 명세

### 4.1 Supabase PostgreSQL 스키마 (`public`)

1. **`profiles`** (사용자 공개 프로필 — `auth.users` 연동)
   - `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
   - `email TEXT NOT NULL`
   - `nickname TEXT NOT NULL` (2~12자)
   - `avatar_initial TEXT NOT NULL` (닉네임 첫 글자)
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - **자동 생성 트리거 (`on_auth_user_created`)**: `auth.users`에 `INSERT` 발생 시 `SECURITY DEFINER` 함수 `public.handle_new_user()`가 `raw_user_meta_data->>'nickname'`(미지정 시 이메일 `@` 앞부분)과 `avatar_initial`을 추출해 `profiles`에 자동 삽입한다.

2. **`rooms`** (자기계발 방)
   - `id TEXT PRIMARY KEY` (예: `room-<8hex>`)
   - `title TEXT NOT NULL`
   - `tag TEXT NOT NULL`
   - `category TEXT NOT NULL` (`'exercise' | 'reading' | 'drawing' | 'study'`)
   - `max_capacity INTEGER NOT NULL CHECK (max_capacity IN (2, 4, 6))`
   - `streak_days INTEGER NOT NULL DEFAULT 0`
   - `last_completed_date TEXT` (`YYYY-MM-DD`, nullable)
   - `created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

3. **`room_members`** (방 참여 멤버)
   - `id TEXT PRIMARY KEY` (예: `mem-<8hex>`)
   - `room_id TEXT NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE`
   - `user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`
   - `nickname TEXT NOT NULL`
   - `avatar_initial TEXT NOT NULL`
   - `is_host BOOLEAN NOT NULL DEFAULT false`
   - `member_streak_days INTEGER NOT NULL DEFAULT 0`
   - `last_active_date TEXT NOT NULL` (`YYYY-MM-DD`)
   - `joined_at TEXT NOT NULL` (`YYYY-MM-DD`)
   - `UNIQUE (room_id, user_id)`

4. **`daily_checkins`** (일일 인증 및 휴식 스티커)
   - `id TEXT PRIMARY KEY` (예: `chk-<8hex>`)
   - `room_id TEXT NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE`
   - `member_id TEXT REFERENCES public.room_members(id) ON DELETE SET NULL` (3일 미인증 자동 퇴장으로 `room_members` 행이 삭제되어도 과거 인증 사진과 내 앨범 기록은 영구 보존)
   - `user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`
   - `author_nickname TEXT NOT NULL` (인증 시점 닉네임 스냅샷 — 퇴장 후에도 과거 날짜 포스터에 표시)
   - `author_avatar_initial TEXT NOT NULL` (인증 시점 아바타 이니셜 스냅샷)
   - `checkin_date TEXT NOT NULL` (`YYYY-MM-DD`)
   - `status TEXT NOT NULL CHECK (status IN ('photo', 'rest'))`
   - `image_data TEXT` (`status = 'photo'`일 때 Supabase Storage Public URL, `'rest'`일 때 `NULL`)
   - `note TEXT NOT NULL DEFAULT ''`
   - `timestamp_label TEXT NOT NULL`
   - `likes_count INTEGER NOT NULL DEFAULT 0`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - `UNIQUE (room_id, user_id, checkin_date)` (동일 방에서 같은 날 퇴장 후 재참여하더라도 하루 1회 인증 제한 유지)

5. **`checkin_likes`** (다중 사용자 하트 리액션 조인 테이블)
   - `checkin_id TEXT NOT NULL REFERENCES public.daily_checkins(id) ON DELETE CASCADE`
   - `user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - `PRIMARY KEY (checkin_id, user_id)`
   - **카운트 동기화 트리거 (`sync_checkin_likes_count`)**: `checkin_likes`의 `INSERT` / `DELETE` 시 `SECURITY DEFINER` 트리거가 `daily_checkins.likes_count`를 원자적으로 재계산·갱신한다. 이를 통해 다중 사용자가 동시에 좋아요를 눌러도 경쟁 상태나 권한 우회가 발생하지 않는다.

---

### 4.2 Row-Level Security (RLS), 원자적 RPC & Storage 보안 정책

모든 테이블에 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`를 적용하고 `authenticated` 역할 기준으로 최소 권한 정책을 설정한다.

- **`profiles`**:
  - `SELECT`: 인증된 사용자 전체 조회 가능(방 멤버 닉네임·이니셜 표시용).
  - `UPDATE`: `id = (SELECT auth.uid())`인 본인 프로필만 수정 가능.
- **`rooms`**:
  - `SELECT`: 인증된 사용자 전체 조회 가능(방 탐색, 미리보기 및 동일 태그 영감 스트립 표시).
  - `INSERT`: `created_by = (SELECT auth.uid())`인 경우 생성 가능.
- **`room_members`**:
  - `SELECT`: 인증된 사용자 전체 조회 가능(정원·참여 인원 확인).
  - `INSERT`: `user_id = (SELECT auth.uid())`인 본인 합류만 허용.
- **`daily_checkins`**:
  - `SELECT`: 인증된 사용자 전체 조회 가능(방 보드 미리보기, 내 앨범, 1인 방 동일 태그 영감 스트립).
  - `INSERT`: `user_id = (SELECT auth.uid())`이고 해당 방의 참여 멤버인 경우에만 등록 가능.
- **`checkin_likes`**:
  - `SELECT`: 인증된 사용자 전체 조회 가능(`likedByMe` 판별용).
  - `INSERT` / `DELETE`: `user_id = (SELECT auth.uid())`인 본인 리액션만 추가·취소 가능(미참여 방 미리보기에서의 하트 리액션 포함).
- **원자적 상태 전이용 `SECURITY DEFINER` RPC (`authenticated` 전용 실행 권한)** `[설계자 기본값 결정]`:
  - `domain.ts`의 순수 도메인 규칙(`evaluateInactiveEvictions`, `computeNextRoomStreak`, `computeNextMemberStreak`)을 서버 단일 진실 원천으로 유지하면서, `/explore`·`/join`의 크로스 유저 잠수 정리와 동시 가입/연속일수 갱신을 RLS 충돌 및 `service_role` 키 노출 없이 안전하게 반영하기 위해 다음 RPC를 둔다.
  - `apply_room_eviction(p_room_id TEXT, p_evicted_ids TEXT[], p_new_host_id TEXT)`: 잠수 멤버 목록 삭제 및 방장(`is_host`) 승계를 단일 트랜잭션으로 반영(DB 내에서도 방의 마지막 1인 보호 및 미활동 조건 재검증).
  - `join_room_atomic(p_room_id TEXT, p_member_id TEXT, p_today TEXT)`: `rooms` 행을 `FOR UPDATE`로 잠근 뒤 중복 참여 여부(`409`)와 현재 인원 < `max_capacity`(`409`)를 원자적으로 검증하고 현재 인증 사용자(`auth.uid()`)의 `room_members` 행을 삽입.
  - `apply_checkin_streak(p_room_id TEXT, p_member_id TEXT, p_member_streak INTEGER, p_today TEXT, p_room_streak INTEGER, p_last_completed_date TEXT)`: 체크인 등록 직후 멤버·방 연속일수 및 `last_active_date`를 원자적으로 갱신.
- **Storage 버킷 (`checkins`)**:
  - 버킷명: `checkins` (`public: true`, 허용 MIME: `image/jpeg`, `image/png`, `image/webp`, 파일 크기 상한 `5MB`).
  - 저장 경로 규칙: `{user_id}/{room_id}/{checkin_id}.jpg`
  - `storage.objects` 정책:
    - `SELECT`: `bucket_id = 'checkins'` 공개 읽기 허용.
    - `INSERT` / `DELETE`: `bucket_id = 'checkins'`이면서 `(storage.foldername(name))[1] = (SELECT auth.uid())::text`인 본인 폴더 경로에만 허용.

---

### 4.3 인증 흐름, 미들웨어 및 화면 변화 `[설계자 기본값 결정]`

1. **인증 미들웨어 (`src/middleware.ts`)** `[설계자 기본값 결정]`
   - 모든 요청에서 `@supabase/ssr` `createServerClient`를 통해 쿠키 세션을 갱신(`supabase.auth.getUser()`)한다.
   - 미로그인 사용자가 페이지(`/`, `/rooms/**`, `/explore`, `/album`)에 접근하면 `/auth`로 리다이렉트한다.
   - 이미 로그인한 사용자가 `/auth`에 접근하면 `/`로 리다이렉트한다.
   - 미로그인 사용자가 API(`/api/rooms/**`, `/api/checkins/**`, `/api/album`)를 호출하면 리다이렉트 대신 HTTP `401 { error: '로그인이 필요해요.' }` JSON을 반환한다.

2. **인증 화면 (`/auth`)** `[설계자 기본값 결정]`
   - Cozy Daylight 디자인 시스템(`#F4EDE2` Warm Oat, `#FAF6F0` Warm Milk, `#FFFDF9` Cream Ivory, `#EE6348` Persimmon Coral, 이모지 미사용 2px 선형 SVG 아이콘)을 그대로 따르는 전용 로그인/회원가입 화면을 추가한다.
   - **로그인 탭**: 이메일 + 비밀번호 입력, 로그인 성공 시 `/`로 이동.
   - **회원가입 탭**: 닉네임(2~12자) + 이메일 + 비밀번호(6자 이상) 입력 후 `supabase.auth.signUp({ email, password, options: { data: { nickname } } })` 호출.
   - **가입 직후 세션 처리** `[설계자 기본값 결정]`: 상용 배포 초기 진입 장벽을 낮추기 위해 Supabase Auth 설정에서 이메일 인증 대기 없이 즉시 세션을 발급받거나(`session` 존재 시 즉시 `/` 이동), 이메일 인증이 켜져 `session === null`인 경우에도 화면에 친절한 인증 메일 확인 안내 문구를 표시하도록 양쪽을 모두 지원한다.

3. **기존 4개 화면 및 카메라 모달의 상용 전환**
   - **홈 (`/`, [HomeClient.tsx](file:///Users/yubin/Projects/ongi-board/src/components/HomeClient.tsx))**: 상단 헤더에 로그인한 사용자 닉네임(`profile.nickname`)과 `로그아웃` 버튼을 추가한다. 참여 방이 0개인 신규 가입자에게는 기존 빈 상태 UI("아직 참여 중인 자기계발 방이 없어요" → "다정한 방 찾아보기")가 자연스럽게 안내된다. 주간 흐름(`weekRhythm`)은 `room_members` 조인 없이 `daily_checkins`를 `user_id`로 직접 조회해 퇴장한 방의 과거 활동일도 유지한다.
   - **방 내부 (`/rooms/[id]`, [RoomBoardClient.tsx](file:///Users/yubin/Projects/ongi-board/src/components/RoomBoardClient.tsx))**:
     - **비참여자 미리보기 모드**: 로그인한 모든 사용자가 미참여 방 보드를 미리보기로 열람하고 하트 리액션을 누를 수 있다. 단, 현재 사용자가 방 멤버가 아닌 경우(`!isJoined`) 멤버 전용 하단 문구와 `"오늘은 쉬어가기"` 버튼을 숨기고, 빈자리가 있으면 **`함께하기`** 가입 버튼을(정원이 다 찬 경우 `"정원이 모두 찬 방이에요 (미리보기 중)"` 안내를) 표시한다.
     - **과거 날짜 퇴장 멤버 기록 보존**: 오늘 날짜 보드는 현재 활성 멤버 슬롯만 표시하지만, 과거 날짜(`selectedDate !== today`) 보드는 당시 인증을 남겼던 퇴장 멤버의 기록(`author_nickname`, `author_avatar_initial`)도 함께 보존해 합동 포스터가 깨지지 않도록 렌더링한다.
   - **방 탐색 (`/explore`, [ExploreClient.tsx](file:///Users/yubin/Projects/ongi-board/src/components/ExploreClient.tsx))**: 모든 가입 유저가 빈자리 방을 탐색하고 자유 `#태그`로 새 방을 만들거나 기존 미달 방에 합류할 수 있다.
   - **내 앨범 (`/album`, [AlbumClient.tsx](file:///Users/yubin/Projects/ongi-board/src/components/AlbumClient.tsx))**: `room_members` 조인 없이 `daily_checkins`를 `user_id` 기준으로 직접 조회하므로, 이후 3일 미인증으로 특정 방에서 자동 퇴장되더라도 내가 찍었던 인증 사진과 휴식 스티커 기록은 개인 앨범과 Storage에 그대로 보존된다.
   - **인앱 실시간 카메라 강제 ([LiveCameraModal.tsx](file:///Users/yubin/Projects/ongi-board/src/components/LiveCameraModal.tsx))**:
     - 상용 배포 환경에서는 실제 `getUserMedia` 카메라 스트림이 연결된 경우에만 셔터 촬영 및 인증 업로드를 허용한다. 카메라가 없거나 권한이 차단된 경우 셔터를 비활성화하고, 권한 허용 안내, `카메라 다시 연결` 버튼, 및 휴식권 사용 안내를 표시한다.
     - 기존 가상 프리뷰 캔버스 스냅샷 폴백(`paintWarmAmbientPreview`)은 개발·테스트 환경 플래그(`NEXT_PUBLIC_ALLOW_CAMERA_FALLBACK=true`)가 명시된 경우에만 활성화되도록 제한한다.

4. **인앱 카메라 업로드 및 도메인 규칙 변경점**
   - `POST /api/rooms/[id]/checkin`: 클라이언트(`LiveCameraModal.tsx`)가 전달한 `data:image/jpeg;base64,...` 문자열을 서버에서 검증(`Buffer.from(..., 'base64')`, 최대 3MB)한 뒤 `supabase.storage.from('checkins').upload(...)`로 업로드하고, 얻은 Public URL을 `daily_checkins.image_data`에 저장한다.
   - 하루 1회 인증 중복 체크 및 주 1회(월~일) 휴식권 사용 횟수(`countRestPassesUsedThisWeek`)는 모두 `(room_id, user_id, checkin_date)` 기준으로 판정한다.
   - `RoomMember.userId`는 `string` UUID로 사용하며, `isCurrentUser`는 DB 컬럼이 아니라 서버 조회 시 `member.user_id === currentUser.id` 비교로 동적 계산한다.
   - 상용 환경의 3일 잠수 멤버 자동 정리(`syncRoomEvictions`)는 `evaluateInactiveEvictions({ members, today, protectCurrentUser: false })`로 동작해 본인 포함 모든 멤버에게 공정하게 적용된다(마지막 1인 보호 및 방장 승계 규칙은 동일).

5. **환경변수 및 테스트 전략** `[설계자 기본값 결정]`
   - 필수 공개 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`.env.local` 및 `.env.example`에 명세; `service_role` 키는 브라우저·Next 앱 런타임에 노출하지 않고 RLS + 최소 `SECURITY DEFINER` RPC로만 동작). 선택적 개발용 플래그: `NEXT_PUBLIC_ALLOW_CAMERA_FALLBACK` (상용 미설정/`false`).
   - **테스트 격리**: 순수 도메인 테스트(`tests/domain.test.ts`)는 그대로 유지하고, 저장소·API 테스트(`tests/repository.test.ts`, `tests/api.test.ts`)는 외부 네트워크나 실제 클라우드 DB 상태를 오염시키지 않도록 인메모리/모의 Supabase 어댑터 또는 순수 데이터 매핑 계층 테스트로 검증한다. 배포 전에는 실제 Supabase 프로젝트에 대한 마이그레이션 적용·타입 생성·빌드·실제 로그인/업로드 연동 확인을 별도로 실행한다.

---

## 5. 구현자 재량 영역 (What's Left to the Builder)

- Supabase SSR/브라우저/미들웨어 클라이언트 유틸리티 파일 분리(`src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`).
- `supabase/migrations/20261117000000_init_ongi_board.sql` SQL 마이그레이션 파일 작성 및 Supabase MCP `apply_migration` 실행.
- 기존 `src/lib/db.ts`, `src/lib/seed-data.ts` 제거 또는 정리(상용 코드에서 가짜 시드 코드가 실행되지 않도록 제거).
- Supabase Auth 에러 메시지(`Invalid login credentials`, `User already registered` 등)의 한국어 안내 문구 매핑.
- `next.config.ts`에서 `images: { unoptimized: true }` 유지 및 Vercel·Capacitor 배포 환경변수 안내를 `README.md`에 업데이트.
