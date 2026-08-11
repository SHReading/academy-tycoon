대상: [Hextris 공식 웹 빌드](https://hextris.io/) · [공식 소스 저장소](https://github.com/Hextris/hextris)
관찰한 것: 390×844 뷰포트에서 첫 화면에 제목, 최고 점수 1개, `Play!` 행동이 함께 표시됐고 별도 로딩 오버레이는 보이지 않았다. 공식 저장소의 배포 브랜치는 `index.html`, CSS, JavaScript, 이미지 파일로 구성되지만 1.5초 이하 측정값은 제시하지 않는다.
우리 문서 어디에: 01_GAME_DESIGN.md 7절 1·4항, 07_ORCA_HANDOFF.md 작업 B `로딩 화면 없음`·`모바일 세로 우선`
그래서 뭘 하자는 건가: 초기 경로에서 로딩 UI를 거치지 않고 제목·최소 상태·첫 행동을 바로 렌더링하되, 1.5초 충족 여부는 우리 빌드로 직접 측정한다.

대상: [A Dark Room 공식 웹 빌드](https://adarkroom.doublespeakgames.com/) · [공식 소스 저장소](https://github.com/doublespeakgames/adarkroom)
관찰한 것: 새 게임 첫 화면에는 `the fire is dead.`, `the room is freezing.`이라는 상태 문장 2개와 `light fire` 행동 1개가 표시됐고, 별도 튜토리얼 화면은 표시되지 않았다.
우리 문서 어디에: 01_GAME_DESIGN.md 7절 3항, 07_ORCA_HANDOFF.md 작업 B `튜토리얼 화면 없음`
그래서 뭘 하자는 건가: 각 선택 화면을 현재 상태 1~2문장과 바로 누를 수 있는 행동·한 줄 설명으로 시작한다.

대상: [Sort the Court! 공식 배포 안내](https://graebor.itch.io/sort-the-court?click_to_load=true) · [안내에서 연결한 업데이트 배포판](https://poki.com/en/g/sort-the-court)
관찰한 것: 공식 배포 안내는 업데이트 배포판을 별도로 연결한다. 그 배포판을 390×844 뷰포트에서 실행했을 때 왼쪽 아래 한 패널에 아이콘과 값 3쌍이 세로로 묶였고, 큰 인물·말풍선과 `Y`/`N` 선택이 같은 게임 영역에 표시됐다. 말풍선 오른쪽 일부는 뷰포트 밖으로 잘렸다.
우리 문서 어디에: 01_GAME_DESIGN.md 5절, 7절 4·5항, 07_ORCA_HANDOFF.md 작업 B `헤드라인 3줄이 주인공`·`숫자 7개 이하`
그래서 뭘 하자는 건가: 자금·평판·점유율 같은 상시 자원은 아이콘+값 3개짜리 단일 스택으로 묶고, 정산 문장 영역은 고정 폭 캔버스가 아니라 세로 뷰포트 안에서 줄바꿈되게 한다.

대상: [Hextris 공식 게임 오버 마크업](https://github.com/Hextris/hextris/blob/gh-pages/index.html#L87-L97) · [공식 게임 오버 CSS](https://github.com/Hextris/hextris/blob/gh-pages/style/style.css#L463-L486)
관찰한 것: 게임 오버 마크업은 `GAME OVER` 다음에 현재 점수와 상위 점수 3개를 둔다. CSS의 `GAME OVER` 제목은 24.2px이고 현재 점수는 60.5px이다.
우리 문서 어디에: 01_GAME_DESIGN.md 5절, 07_ORCA_HANDOFF.md 작업 B `헤드라인 3줄이 주인공, 숫자는 보조`
그래서 뭘 하자는 건가: 일반적인 점수 결과 화면의 크기 위계를 따르지 말고, 정산에서는 헤드라인 글자를 가장 크게 두고 수치는 작은 보조 영역으로 내린다.

대상: [Universal Paperclips 공식 웹 빌드](https://www.decisionproblem.com/paperclips/index2.html)
관찰한 것: 390×844 뷰포트에서 게임 UI 대신 웹 버전이 휴대폰용으로 설계되지 않았다는 문장과 모바일 앱 링크가 표시됐다.
우리 문서 어디에: 01_GAME_DESIGN.md 7절 1·4항, 07_ORCA_HANDOFF.md 작업 B `모바일 세로 우선`
그래서 뭘 하자는 건가: 정적 웹 빌드라는 사실을 모바일 대응 근거로 삼지 말고, 390px 폭에서 첫 행동·자원·정산 문장이 모두 보이는지를 별도 합격 조건으로 확인한다.
