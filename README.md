# 학원 타이쿤

재수학원 세 곳이 같은 강사를 놓고 3년(6학기) 동안 경쟁하는 브라우저 경영 시뮬레이션.
설치도 로그인도 없이 바로 시작하고, 한 판이 5분 안에 끝납니다.

**플레이:** https://shreading.github.io/academy-tycoon/

## 개발

```
npm install
npm run dev        # 개발 서버
npm test           # 테스트 67건
npm run typecheck  # 타입 검사
npm run size       # 빌드 + gzip 용량 보고
npm run --silent sim -- --games 100000 --seed 1 > sim.json   # 밸런싱 하네스
node scripts/report-balance.ts sim.json                      # 리포트 생성
```

`main`에 푸시하면 테스트를 돌리고 통과 시 GitHub Pages로 배포됩니다.

## 오프라인 시연

`npm run build`가 `dist/offline.html`을 함께 만듭니다. JS·CSS가 전부 인라인된 단일 파일(43KB)이라
**더블클릭만으로 실행**되며 네트워크가 없어도 돌아갑니다. 배포본에서도 받을 수 있습니다 —
https://shreading.github.io/academy-tycoon/offline.html

## 문서

| 문서 | 내용 |
|---|---|
| `인계문서/01_GAME_DESIGN.md` | 게임 규칙의 단일 출처 |
| `인계문서/02_TECH_SPEC.md` | 아키텍처 원칙 |
| `docs/BALANCE_REPORT.md` | 10만 판 시뮬 판정 |
| `docs/DEV_LOG.md` | 개발 로그 |
