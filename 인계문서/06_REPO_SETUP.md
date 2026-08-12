# 06. 저장소 셋업 명세

> 이 문서는 **명세**다. 실제 스캐폴딩 실행은 워커 에이전트(오르카)가 07 문서를 보고 수행한다.
> 목적: P1 착수 시점에 트랙 A~D가 서로 안 밟고 병렬로 굴러가는 상태를 만드는 것.

---

## 1. 디렉터리 구조 (확정)

```
hackathon/
├── AGENTS.md                  ← 워커 에이전트 규칙 (작성 완료)
├── CLAUDE.md                  ← 코디네이터 규칙 (작성 완료)
├── README.md                  ← 5줄. 프로젝트 한 줄 + 실행법 + 배포 링크
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── 인계문서/                   ← 기획 문서. 규칙의 단일 출처
│   ├── 00_PROJECT_BRIEF.md
│   ├── 01_GAME_DESIGN.md
│   ├── 02_TECH_SPEC.md
│   ├── 03_AGENT_WORKFLOW.md
│   ├── 04_SUBMISSION_CHECKLIST.md
│   ├── 05_P0_PAPER_PROTOTYPE.md
│   ├── 06_REPO_SETUP.md
│   └── 07_ORCA_HANDOFF.md
├── docs/
│   ├── DEV_LOG.md             ← 하루 한 줄. 제출 서사의 원재료
│   └── PARKED.md              ← 스코프 밖으로 밀어낸 아이디어 무덤
├── p0/
│   └── cards.html             ← 종이 프로토타입 인쇄물
├── schema/
│   ├── teacher.schema.json
│   ├── event.schema.json
│   ├── headline.schema.json
│   └── banned-terms.txt       ← 실명 필터 금칙어 목록
├── scripts/
│   ├── validate-content.ts    ← 스키마 + 값범위 + 중복 + 실명 검사
│   └── report-balance.ts      ← 하네스 출력 → 마크다운 리포트
└── src/
    ├── core/                  ← 트랙 A. 순수 함수만
    │   ├── types.ts
    │   ├── rng.ts
    │   ├── reducer.ts
    │   ├── scoring.ts
    │   ├── ai.ts
    │   └── telemetry.ts
    ├── content/               ← 트랙 C
    │   ├── teachers.json
    │   ├── events.json
    │   └── headlines.json
    ├── ui/                    ← 트랙 B
    │   ├── main.ts
    │   ├── screens/
    │   └── components/
    ├── styles/
    │   └── app.css
    └── harness/               ← 트랙 D
        └── simulate.ts
```

**`src/core/`는 `src/content/`의 JSON을 데이터로만 읽는다. 로직을 JSON에 넣지 않는다.** (02 문서 3절)

---

## 2. npm 스크립트 (확정)

| 명령 | 동작 | 통과 조건 |
|---|---|---|
| `npm run dev` | Vite 개발 서버 | — |
| `npm run build` | 프로덕션 빌드 | gzip 200KB 이하 |
| `npm run preview` | 빌드 결과 로컬 확인 | — |
| `npm run typecheck` | `tsc --noEmit` | 에러 0 |
| `npm run test` | 유닛 테스트 | 전부 통과 |
| `npm run validate:content` | 콘텐츠 4종 검사 (3절) | 위반 0 |
| `npm run sim` | 헤드리스 대량 시뮬 | `-- --games 100000 --seed 1` |
| `npm run size` | 번들 gzip 크기 출력 | 예산 이내 |

**커밋 전 관문**: `npm run typecheck && npm run test && npm run validate:content`

---

## 3. 콘텐츠 검증기 규격 (`validate:content`)

배치 생산물은 이걸 통과해야만 머지된다. 검사는 4종이고, **하나라도 걸리면 배치 전체를 반려한다.**

| 검사 | 내용 | 실패 시 |
|---|---|---|
| **① 스키마** | `schema/*.json`과 대조. 필수 필드 누락·타입 불일치 | 해당 배치 반려 |
| **② 값 범위** | 강의력·인지도 1~5 정수, 요구연봉 `(강의력+인지도)×3 ±30%` 이내, id 형식 | 해당 카드 제외 |
| **③ 중복·유사도** | id 중복 0, `blurb` 정규화 후 완전일치 0, 동일 `(subject, teaching, fame, trait)` 조합 5장 초과 시 경고 | 초과분 제외 |
| **④ 실명 필터 ★** | `schema/banned-terms.txt` 금칙어 부분일치 검사 | **배치 전체 반려 + 즉시 보고** |

**④는 00 문서 가드레일 1의 기술적 담보다.** 다른 검사와 달리 부분 통과를 허용하지 않는다.

### `banned-terms.txt` 구성 원칙

- 실존 학원·강사·교육기업·입시 브랜드명을 한 줄에 하나씩. 한글/영문/축약형 모두 등재.
- **이 파일에 실명이 들어간다는 점 자체가 리스크**이므로, 저장소는 공개하되 이 파일은 목록 형태로만 두고 문서에 인용하지 않는다.
- 목록 작성은 **사람이 한다.** 에이전트가 웹 검색으로 채우지 않는다.
- 추가로 정규식 규칙을 둔다: `/(학원|에듀|입시|아카데미)/`가 붙은 고유명사형 토큰은 경고 처리 후 사람이 확인.

---

## 4. 스키마 확정본

`schema/` 아래 3개. **P1에서 확정하고 이후 변경하지 않는다.** (02 문서 4절)
스키마가 흔들리면 배치 생산물 전체를 버려야 하므로, 변경 요청은 코디네이터를 거쳐 사람이 승인한다.

파일: `schema/teacher.schema.json`, `schema/event.schema.json`, `schema/headline.schema.json`

### 특성 6종 — 8/13 사람 승인 완료

03 문서는 "특성 6종 균등 배분"을 지시하지만 01 문서에는 5종만 예시되어 있었다.
6번째를 승인해 6종으로 확정했다. **콘텐츠 배치는 6종 균등 배분으로 생산한다.**

| # | 코드 | 효과 | 출처 |
|---|---|---|---|
| 1 | `TOP_CLASS_SPECIALIST` | 상위반 배치 시 강의력 +1 | 01 문서 |
| 2 | `BASIC_CLASS_SPECIALIST` | 기초반 배치 시 이탈률 추가 감소 | 01 문서 |
| 3 | `MEDIA_FIGURE` | 인지도 +2, 강의력 −1 | 01 문서 |
| 4 | `PICKY` | 평판 45 미만 학원의 입찰 무효 | 01 문서 |
| 5 | `FACTION` | 같은 과목 동료 보유 시 강의력 +1 | 01 문서 |
| 6 | `MID_CLASS_SPECIALIST` | 중위반 배치 시 등록 인원 가중 +15% | **8/13 승인** |

6번을 제안한 이유: 상위반·기초반 특화는 있는데 중위반만 비어 있어 반 편성 딜레마가 한쪽으로 기운다.
스키마 enum과 **콘텐츠 배치 생산 모두 6종으로 돌린다.**

---

## 5. 배포

- 정적 호스팅. **P2 완료 시점(8/17)에 최초 배포한다.** 마감 직전 첫 배포 금지. (02 문서 6절)
- 배포 후 확인: 시크릿 창 / 모바일 실기기 / 새로고침 후 정상 / 로딩 화면 없음 / 다른 네트워크
- 제출 후 저장소를 비공개로 돌리거나 도메인을 옮기지 않는다. 링크는 심사 기간 내내 살아 있어야 한다.

---

## 6. 착수 순서 (의존 관계)

```
       [0] 스캐폴딩 + 스키마 확정        ← 여기까지가 오르카 1일차
              │
       [A] core/types.ts + rng.ts       ← 다른 모든 트랙의 전제
        ┌─────┼─────┬─────┐
       [A]   [B]   [C]   [D]            ← 여기부터 병렬
      나머지  UI   콘텐츠  하네스
```

**A의 타입과 스키마가 확정되기 전에는 B·C·D를 착수하지 않는다.** (03 문서 2절)
타입이 흔들린 채로 병렬을 돌리면 병합 지옥이 된다 — 병렬화가 오히려 손해가 되는 유일한 구간이다.
