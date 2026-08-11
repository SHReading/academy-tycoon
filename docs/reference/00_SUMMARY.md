# 레퍼런스 조사 요약

## 1. 우리 설계를 반증하는 발견

대상: [Universal Paperclips 공식 웹 빌드](https://www.decisionproblem.com/paperclips/index2.html) · [Sort the Court! 공식 배포 안내](https://graebor.itch.io/sort-the-court?click_to_load=true)
관찰한 것: 전자는 휴대폰에서 웹판 대신 모바일 앱 링크만 보여줬고, 후자는 390×844 뷰포트에서 말풍선 일부가 잘렸다.
우리 문서 어디에: 01_GAME_DESIGN.md 7절 1·4항, 07_ORCA_HANDOFF.md 작업 B
그래서 뭘 하자는 건가: 정적 웹 빌드라는 이유로 모바일 대응을 간주하지 말고, 390px 폭에서 첫 행동·자원·정산 문장을 별도로 검수한다.

대상: [OpenAI Build Week 2026 공식 규칙](https://openai.devpost.com/rules)
관찰한 것: 실행 링크가 필수지만 심사자는 빌드를 테스트하지 않고 소개·이미지·영상만으로 평가할 수 있다.
우리 문서 어디에: 04_SUBMISSION_CHECKLIST.md 2·3절
그래서 뭘 하자는 건가: 실행 링크만으로 핵심 루프가 전달된다고 가정하지 말고, 영상 첫 20초에 입찰 조작과 헤드라인 결과를 보여준다.

## 2. 지금 구현 계획에 바로 반영 가능한 것

대상: [Root: The Clockwork Expansion 공식 개발자 일지](https://ledergames.com/blogs/news/root-the-clockwork-expansion-2-developer-diary)
관찰한 것: 자동 세력을 따라하기 쉽게 만드는 것이 초기 목표였고, 3–4인 경기의 타깃 선택은 우선순위로 조정했다.
우리 문서 어디에: 07_ORCA_HANDOFF.md A-4 “강한 AI가 아니라 읽히는 AI”
그래서 뭘 하자는 건가: 경쟁사별 입찰·배치 우선순위를 한 줄로 표시하고 난이도용 예외 규칙은 추가하지 않는다.

대상: [A Dark Room 공식 웹 빌드](https://adarkroom.doublespeakgames.com/) · [For Sale 공식 규칙서](https://iellogames.com/wp-content/uploads/2020/07/For-Sale_Rulebook_EN_V2.pdf)
관찰한 것: 전자는 상태 문장 2개와 행동 1개로 시작하고, 후자는 한 차례의 선택을 입찰가 인상 또는 패스로 제한한다.
우리 문서 어디에: 01_GAME_DESIGN.md 4절, 7절 3항
그래서 뭘 하자는 건가: 세 입력 횟수를 유지하고, 각 화면에는 현재 결정 하나와 한 줄 설명만 우선 표시한다.

대상: [End of The Year GameJam 2026 공식 필수 요건](https://itch.io/jam/end-of-the-year-gamejam-2026) · [공식 자산 규정](https://itch.io/jam/end-of-the-year-gamejam-2026)
관찰한 것: 시작 시 조작법과 목표 설명, 게임오버 후 재시작을 필수로 두고, 외부 아트와 오디오의 크레딧을 요구한다.
우리 문서 어디에: 04_SUBMISSION_CHECKLIST.md 2·6절
그래서 뭘 하자는 건가: 최종 점검에 “첫 화면의 승리 목표 1문장”과 “외부 코드·이미지·음원·폰트의 사용 권한·크레딧”을 추가한다.

## 3. 조사했지만 쓸 데 없다고 판단한 것

대상: [RPG Maker 2025 Game Jam 공식 플레이 지침](https://itch.io/jam/rpg-maker-2025-game-jam/topic/4685664/judging-criteria) · [UK Hackathons 공식 심사 지침](https://hack.athon.uk/organise/before/judging/)
관찰한 것: 하나는 작품당 플레이 상한을 1시간으로, 다른 하나는 발표 슬롯을 3–5분으로 제시했으며 고정된 초 단위 판단 시간은 없었다.
우리 문서 어디에: 04_SUBMISSION_CHECKLIST.md 3절 0:00–0:20 훅
그래서 뭘 하자는 건가: “심사자가 N초 안에 결정한다”는 주장은 산출물에서 빼고, 기존 20초 훅은 데모 구성으로만 유지한다.

대상: [Hextris 공식 소스](https://github.com/Hextris/hextris) · [Universal Paperclips 공식 웹 빌드](https://www.decisionproblem.com/paperclips/index2.html)
관찰한 것: 두 자료는 첫 인터랙션까지 1.5초 이하라는 측정값을 제시하지 않았고, Hextris의 게임 오버는 제목보다 점수가 크다.
우리 문서 어디에: 01_GAME_DESIGN.md 5·7절, 07_ORCA_HANDOFF.md 작업 B
그래서 뭘 하자는 건가: 두 사례를 1.5초 성능이나 헤드라인 중심 정산의 직접 근거로 쓰지 않고, 해당 요건은 우리 빌드에서 직접 검증한다.
