# 온기보드 (Ongi Board)

서로의 오늘 한 걸음을 **실시간 인앱 폴라로이드 사진 + 짧은 한마디**로 나누는 소규모(2~6명) 자기계발 인증 보드 웹앱입니다.

텍스트 수다방 피로나 개인 투두 체크리스트의 죄책감 없이, 방 멤버들이 채워가는 분할 폴라로이드 보드를 보며 자연스럽게 오늘의 행동을 이어갈 수 있도록 설계되었습니다.

## 주요 기능

- **가변형 1~6인 분할 폴라로이드 보드**: 방 정원(2/4/6명)이 차기 전에도 현재 인원수(`1칸` / `상하 2분할` / `3분할` / `2×2` / `2×3`)에 맞춰 빈칸 없이 보드가 구성됩니다. 1인 방일 때는 같은 `#태그` 메이트들의 최근 인증 스냅샷 스트립을 함께 보여줍니다.
- **인앱 실시간 카메라 & 스탬프 워터마크**: 갤러리 파일 업로드(`<input type="file">`)를 배제하고, `getUserMedia` 실시간 카메라 스트림 + `<canvas>` 타임스탬프 합성을 통해 인증합니다. 카메라가 없거나 권한이 차단된 데스크톱 환경에서는 프리뷰 캔버스 스냅샷 폴백 모드를 제공합니다.
- **주 1회 휴식권 스티커 (`오늘은 쉬어가기`)**: 방별로 월~일 기준 주 1회 휴식 스티커를 사용해 방과 개인의 연속 일수(`Day N`)를 끊기지 않게 보호합니다.
- **3일 연속 미활동 멤버 자동 정리 & 방장 승계**: 직전 과거 3일(`D-3 ~ D-1`) 연속 미활동 멤버를 자동 정리하고, 방장이 떠날 경우 가장 먼저 참여한 멤버에게 `is_host`를 자동 승계합니다(마지막 1인은 보호).
- **미달 방 우선 탐색 & 자유 태그 방 개설 (`/explore`)**: 빈자리가 1칸 남은 방과 진행 중인 미달 방을 우선 추천하고, 자유 `#태그`와 정원(2/4/6명)으로 새 방을 만들 수 있습니다.
- **개인 월간 앨범 (`/album`)**: 내가 남긴 모든 인증 사진과 휴식 스티커를 월간 캘린더와 방별 필터로 모아보고 라이트박스로 크게 확인할 수 있습니다.

## 기술 스택 및 아키텍처

- **Framework**: Next.js 16 (App Router, React 19, TypeScript)
- **Database**: Node.js 내장 `node:sqlite` (`DatabaseSync`, 네이티브 C++ 컴파일 불필요, `data/ongi.db`)
- **Testing**: Vitest (`tests/domain.test.ts`, `tests/repository.test.ts`, `tests/api.test.ts`)
- **Design System**: Cozy Daylight (`#F4EDE2` Warm Oat, `#FAF6F0` Warm Milk, `#FFFDF9` Cream Ivory, `#EE6348` Persimmon Coral, `#F2A93B` Marigold Honey, `#4F9866` Clover Sage, `Pretendard Variable` × `Fraunces`, 2px 둥근 선형 SVG 아이콘)
- **Mobile Packaging Ready**: `capacitor.config.ts` 및 분리된 카메라 어댑터(`src/lib/camera-adapter.ts`)

### 디렉터리 구조

```text
src/
├── app/
│   ├── api/                # REST API 핸들러 (/api/rooms, checkin, rest, like, album)
│   ├── explore/page.tsx    # 화면 3: 방 탐색 및 새 방 만들기
│   ├── album/page.tsx      # 화면 4: 내 월간 인증 앨범
│   ├── rooms/[id]/page.tsx # 화면 2: 단일 방 몰입 풀스크린 폴라로이드 보드
│   └── page.tsx            # 화면 1: 내 참여 방 목록 및 주간 흐름
├── components/             # UI 컴포넌트 및 LiveCameraModal
├── lib/
│   ├── camera-adapter.ts   # 웹캠/캔버스 캡처 어댑터 (Capacitor Camera 교체 지점)
│   ├── db.ts               # node:sqlite 스키마 및 자동 시딩
│   ├── domain.ts           # 순수 도메인 규칙 (레이아웃, 달성률, 연속일수, 잠수 정리)
│   ├── repository.ts       # SQLite 트랜잭션 및 방/체크인/앨범 로직
│   └── seed-data.ts        # 오프라인 안전 시드 데이터 및 포스터 아트
└── types/ongi.ts           # 공용 도메인/API 타입 정의
```

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

> **참고**: Node.js 내장 `node:sqlite` 모듈을 사용하므로 Node v22.5+ (본 프로젝트는 Node v26 기준 구성) 환경이 필요합니다.

## Capacitor (iOS / Android) 패키징 안내

본 프로젝트는 `capacitor.config.ts`와 어댑터 분리를 통해 모바일 앱 패키징에 바로 대응할 수 있도록 구성되어 있습니다.

1. **카메라 어댑터 교체**: `src/lib/camera-adapter.ts`의 웹 `getUserMedia` 캡처 함수를 `@capacitor/camera`의 `Camera.getPhoto({ source: CameraSource.Camera })` 호출로 교체하면 UI 컴포넌트(`LiveCameraModal.tsx`) 수정 없이 네이티브 카메라를 사용할 수 있습니다.
2. **라이브 서버 연동 (API + SQLite 유지)**: Next.js 앱을 배포한 뒤 `capacitor.config.ts`의 `server.url`에 배포 주소를 지정하고 `npx cap add ios && npx cap add android && npx cap sync`를 실행하면 App Router API 및 SQLite 영속성을 그대로 사용하면서 네이티브 앱으로 패키징됩니다.
