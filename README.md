# 작심백일

서로의 오늘 한 걸음을 **실시간 인앱 폴라로이드 사진 + 짧은 한마디**로 나누는 소규모(2~6명) 자기계발 인증 보드 웹앱입니다.

텍스트 수다방 피로나 개인 투두 체크리스트의 죄책감 없이, 방 멤버들이 채워가는 분할 폴라로이드 보드를 보며 자연스럽게 오늘의 행동을 이어갈 수 있도록 설계되었습니다.

## 주요 기능

- **이메일 회원가입/로그인 & `HttpOnly` 세션 보안 (`/auth`)**: Supabase Auth(`@supabase/ssr`)와 Next.js 미들웨어를 통해 사용자별 계정·방 참여·개인 앨범을 안전하게 분리합니다.
- **가변형 1~6인 분할 폴라로이드 보드**: 방 정원(2/4/6명)이 차기 전에도 현재 인원수(`1칸` / `상하 2분할` / `3분할` / `2×2` / `2×3`)에 맞춰 빈칸 없이 보드가 구성됩니다. 1인 방일 때는 같은 `#태그` 메이트들의 최근 인증 스냅샷 스트립을 함께 보여줍니다.
- **인앱 실시간 카메라 & 클라우드 스토리지 업로드**: 갤러리 파일 업로드(`<input type="file">`)를 배제하고, `getUserMedia` 실시간 카메라 스트림 + `<canvas>` 타임스탬프 합성을 통해 촬영한 JPEG 이미지를 서버에서 검증한 뒤 Supabase Storage(`checkins` 버킷)에 저장합니다. (웹캠이 없는 로컬 테스트 시에만 `NEXT_PUBLIC_ALLOW_CAMERA_FALLBACK=true` 설정 가능)
- **주 1회 휴식권 스티커 (`오늘은 쉬어가기`)**: 방별로 월~일 기준 주 1회 휴식 스티커를 사용해 방과 개인의 연속 일수(`Day N`)를 끊기지 않게 보호합니다.
- **3일 연속 미활동 멤버 자동 정리 & 기록 보존**: 직전 과거 3일(`D-3 ~ D-1`) 연속 미활동 멤버를 자동 정리하고 방장 승계를 처리하며, 퇴장 후에도 기존 인증 사진과 내 앨범(`/album`) 기록은 보존됩니다.
- **미달 방 우선 탐색 & 자유 태그 방 개설 (`/explore`)**: 빈자리가 1칸 남은 방과 진행 중인 미달 방을 우선 추천하고, 미참여 방 미리보기 및 `함께하기` 즉시 합류를 지원합니다.
- **개인 월간 앨범 (`/album`)**: 내가 남긴 모든 인증 사진과 휴식 스티커를 월간 캘린더와 방별 필터로 모아보고 라이트박스로 크게 확인할 수 있습니다.

## 기술 스택 및 아키텍처

- **Framework**: Next.js 16 (App Router, React 19, TypeScript)
- **Backend & Auth**: Supabase (`Auth`, `PostgreSQL` + RLS + Atomic RPCs, `Storage`)
- **Testing**: Vitest (`tests/domain.test.ts`, `tests/repository.test.ts`, `tests/api.test.ts`, `tests/ui-guards.test.ts`)
- **Design System**: 크림색 바탕과 테라코타·세이지 강조색, 시스템 한글 명조 제목과 고딕 본문을 사용합니다. 세로 한 열과 하단 탭을 기본으로 하며 넓은 화면에서도 같은 모바일 구성을 보여줍니다.
- **Mobile Packaging Ready**: `capacitor.config.ts` 및 분리된 카메라 어댑터(`src/lib/camera-adapter.ts`)

### 디렉터리 구조

```text
src/
├── app/
│   ├── api/auth/           # 회원가입, 로그인, 로그아웃 API
│   ├── api/                # 인증 보호 REST API (/api/rooms, checkin, rest, like, album)
│   ├── auth/page.tsx       # 로그인 / 회원가입 화면
│   ├── explore/page.tsx    # 방 탐색 및 새 방 만들기
│   ├── album/page.tsx      # 내 월간 인증 앨범
│   ├── rooms/[id]/page.tsx # 단일 방 몰입 풀스크린 폴라로이드 보드
│   └── page.tsx            # 내 참여 방 목록 및 주간 흐름
├── components/             # UI 컴포넌트, AuthClient 및 LiveCameraModal
├── lib/
│   ├── supabase/           # @supabase/ssr 브라우저·서버·미들웨어 클라이언트
│   ├── auth.ts             # 서버 세션 사용자 조회 및 401 가드
│   ├── camera-adapter.ts   # 웹캠/캔버스 캡처 어댑터 (Capacitor Camera 교체 지점)
│   ├── domain.ts           # 순수 도메인 규칙 (레이아웃, 달성률, 연속일수, 잠수 정리)
│   ├── repository.ts       # 멀티유저 비즈니스 계층 및 OngiStore 어댑터
│   ├── store-supabase.ts   # Supabase PostgreSQL + Storage + RPC 구현체
│   ├── store-memory.ts     # 오프라인 Vitest 검증용 인메모리 스토어
│   └── ui-guards.ts        # 보드 푸터 상태·카메라 셔터 가드 헬퍼
└── middleware.ts           # SSR 쿠키 세션 갱신 및 미로그인 리다이렉트/401 차단
```

## 환경변수 및 Supabase 설정

`.env.example`을 참고해 `.env.local`(또는 배포 플랫폼 환경변수)을 설정합니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
NEXT_PUBLIC_ALLOW_CAMERA_FALLBACK=false
```

- 기존 DB에는 [사진·프로필 권한 마이그레이션](supabase/migrations/20261118000000_private_checkin_storage.sql)을 앱 업데이트와 함께 적용하세요. 새 설치는 [초기 스키마](supabase/migrations/20261117000000_init_ongi_board.sql)부터 시간순으로 적용합니다.
- 사진은 로그인한 사용자가 방 보드·미리보기·관련 방 기록에서 열람합니다. 앱은 인증된 이미지 경로를 사용하며 기존 공개 URL 형식의 DB 레코드도 읽습니다. 스토리지의 직접 공개 접근과 다른 회원 이메일 조회는 위 SQL을 적용해야 제한됩니다.
- `service_role` 키는 Next.js 런타임이나 브라우저에 노출하지 않으며, 모든 요청은 로그인 사용자의 세션 + RLS + 최소 권한 `SECURITY DEFINER` RPC로 동작합니다.

## 실행 및 검증 명령어

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (http://localhost:3000)
npm run dev

# 단위/통합 테스트 실행 (Vitest)
npm test

# TypeScript 타입 체크
npm run typecheck

# 프로덕션 빌드 및 실행
npm run build
npm start
```

## Vercel & Capacitor 배포 안내

1. **Vercel 배포**: GitHub 저장소 연결 후 프로젝트 환경변수에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ALLOW_CAMERA_FALLBACK=false`를 등록하면 즉시 상용 배포됩니다. (Supabase Authentication → URL Configuration의 Site URL/Redirect URLs에 배포 도메인을 추가하세요.)
2. **Capacitor (iOS / Android) 패키징**:
   - `src/lib/camera-adapter.ts`의 웹 `getUserMedia` 캡처 함수를 `@capacitor/camera`의 `Camera.getPhoto({ source: CameraSource.Camera })` 호출로 교체하면 네이티브 카메라를 사용할 수 있습니다.
   - `capacitor.config.ts`의 `server.url`에 배포된 Next.js 주소를 지정한 뒤 `npx cap add ios && npx cap add android && npx cap sync`를 실행합니다.
