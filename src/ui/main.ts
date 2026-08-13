import type { Archetype, ClassTier, Subject, TeacherCard } from "../core/types";
import "../styles/app.css";

const app = document.querySelector<HTMLElement>("#app");

if (!app) {
  throw new Error("게임 화면을 찾을 수 없습니다.");
}

const academies: ReadonlyArray<readonly [Archetype, string, string, string]> = [
  ["FRANCHISE", "확장형", "큰 자금으로 시장을 주도합니다.", "고정비가 높아 오래 끌수록 불리합니다."],
  ["LEGACY", "명문형", "높은 평판으로 학생을 지킵니다.", "새 강사를 데려오기 어렵습니다."],
  ["SELECTIVE", "선발형", "상위반 성과와 영입에 강합니다.", "자금과 정원이 가장 작습니다."],
];

const teachers: TeacherCard[] = [
  { id: "dummy_korean", name: "국어 강사", subject: "KOREAN", teaching: 4, fame: 2, askingPrice: 18, trait: "TOP_CLASS_SPECIALIST", blurb: "상위반의 실적을 빠르게 끌어올립니다." },
  { id: "dummy_math", name: "수학 강사", subject: "MATH", teaching: 3, fame: 4, askingPrice: 21, trait: "MEDIA_FIGURE", blurb: "인지도로 지원자 흐름을 만듭니다." },
  { id: "dummy_english", name: "영어 강사", subject: "ENGLISH", teaching: 3, fame: 3, askingPrice: 16, trait: "MID_CLASS_SPECIALIST", blurb: "중위반의 등록을 안정시킵니다." },
  { id: "dummy_science", name: "탐구 강사", subject: "SCIENCE", teaching: 2, fame: 2, askingPrice: 12, trait: "BASIC_CLASS_SPECIALIST", blurb: "기초반 이탈을 단단히 막습니다." },
];

const subjectLabels: Record<Subject, string> = {
  KOREAN: "국어",
  MATH: "수학",
  ENGLISH: "영어",
  SCIENCE: "탐구",
};

const tierLabels: Record<ClassTier, string> = {
  TOP: "상위반",
  MID: "중위반",
  BASIC: "기초반",
};

const assignments: Record<ClassTier, Partial<Record<Subject, string>>> = {
  TOP: { KOREAN: "국어 강사", MATH: "수학 강사" },
  MID: { ENGLISH: "영어 강사" },
  BASIC: { SCIENCE: "탐구 강사" },
};

let screen = 0;
let selectedTeacherId = teachers[0].id;

const progress = (label: string) => `
  <div class="progress" role="img" aria-label="${label}">
    ${[0, 1, 2, 3].map((step) => `<span class="${step === screen ? "is-current" : ""}"></span>`).join("")}
  </div>
`;

const academyScreen = () => `
  <section class="screen academy-screen">
    ${progress("학원 선택 단계")}
    <header class="screen-header">
      <p class="eyebrow">학원 타이쿤</p>
      <h1>어떤 방식으로<br>입시 시장을 차지할까요?</h1>
      <p>선택한 학원의 강점이 곧 전략이 됩니다.</p>
    </header>
    <div class="academy-grid">
      ${academies.map(([archetype, title, strength, weakness]) => `
        <button class="academy-card academy-card--${archetype.toLowerCase()}" data-screen="1">
          <span class="card-kicker">${title}</span>
          <strong>${strength}</strong>
          <small>${weakness}</small>
          <span class="button-note">이 학원으로 바로 시작</span>
        </button>
      `).join("")}
    </div>
  </section>
`;

const bidScreen = () => `
  <section class="screen">
    ${progress("강사 입찰 단계")}
    <header class="screen-header compact">
      <p class="eyebrow">블라인드 입찰</p>
      <h1>이번 시장의 강사</h1>
      <p>내가 놓친 강사는 경쟁 학원의 전력이 됩니다.</p>
    </header>
    <div class="market-grid" aria-label="강사 시장">
      ${teachers.map((teacher) => `
        <button class="market-card ${teacher.id === selectedTeacherId ? "is-selected" : ""}" data-teacher="${teacher.id}" aria-pressed="${teacher.id === selectedTeacherId}">
          <span class="subject">${subjectLabels[teacher.subject]}</span>
          <strong>${teacher.name}</strong>
          <span>${teacher.blurb}</span>
          <small>최소 입찰 ${teacher.askingPrice}</small>
        </button>
      `).join("")}
    </div>
    <form class="decision-panel" data-bid-form>
      <label for="bid-amount">내 입찰가</label>
      <input id="bid-amount" name="bid" type="number" min="0" value="18" inputmode="numeric">
      <button class="primary-button" type="submit">
        입찰 확정
        <small>최고가가 낙찰되며, 낙찰가는 매 학기 고정비가 됩니다.</small>
      </button>
    </form>
  </section>
`;

const assignmentScreen = () => `
  <section class="screen wide-screen">
    ${progress("반 편성과 운영 선택 단계")}
    <header class="screen-header compact">
      <p class="eyebrow">반 편성</p>
      <h1>어느 반에 힘을 실을까요?</h1>
      <p>빈 과목은 성적에 불리합니다. 강사를 눌러 배치하세요.</p>
    </header>
    <div class="class-board">
      ${(Object.keys(tierLabels) as ClassTier[]).map((tier) => `
        <section class="class-row">
          <div class="class-title">
            <strong>${tierLabels[tier]}</strong>
            <small>${tier === "TOP" ? "평판" : tier === "MID" ? "매출" : "이탈 방지"}에 유리</small>
          </div>
          <div class="slot-grid">
            ${(Object.keys(subjectLabels) as Subject[]).map((subject) => `
              <button class="teacher-slot ${assignments[tier][subject] ? "is-filled" : ""}" type="button">
                <small>${subjectLabels[subject]}</small>
                <span>${assignments[tier][subject] ?? "빈 자리"}</span>
              </button>
            `).join("")}
          </div>
        </section>
      `).join("")}
    </div>
    <fieldset class="options-panel">
      <legend>운영 옵션 하나 선택</legend>
      ${[
        ["study", "자습 감독 강화", "이탈률 −20% · 비용 중"],
        ["care", "담임 상담 확대", "성적 +5% · 평판 소폭 상승"],
        ["scholarship", "장학금 확대", "상위권 지원자 +30% · 비용 대"],
        ["tuition", "수강료 인상", "매출 +25% · 지원자 −15%"],
        ["none", "아무것도 안 함", "비용 없이 이번 학기를 운영"],
      ].map(([value, title, description], index) => `
        <label class="option-card">
          <input type="radio" name="option" value="${value}" ${index === 0 ? "checked" : ""}>
          <span><strong>${title}</strong><small>${description}</small></span>
        </label>
      `).join("")}
    </fieldset>
    <button class="primary-button" data-screen="3">
      학기 정산하기
      <small>선택을 마치면 성적·평판·지원자·자금을 자동 계산합니다.</small>
    </button>
  </section>
`;

const resultScreen = () => `
  <section class="screen result-screen">
    ${progress("학기 정산 결과 단계")}
    <header class="result-masthead">
      <p class="eyebrow">학기 정산 속보</p>
      <h1>교문 앞 소식</h1>
    </header>
    <div class="headlines" aria-label="이번 학기 주요 소식">
      <p>「신임 강사 합류, 상위반 분위기 반전」</p>
      <p>「중위반 정원 빠르게 차올라… 경쟁 학원 긴장」</p>
      <p>「자습 관리 강화에 학부모 반응 호조」</p>
    </div>
    <dl class="result-stats" aria-label="보조 지표">
      <div><dt>시장 점유율</dt><dd>38%</dd></div>
      <div><dt>평판</dt><dd>64</dd></div>
      <div><dt>남은 자금</dt><dd>52</dd></div>
    </dl>
    <button class="primary-button restart-button" data-screen="0">
      새 판 시작
      <small>한 번 누르면 학원 선택부터 즉시 다시 시작합니다.</small>
    </button>
  </section>
`;

const screens = [academyScreen, bidScreen, assignmentScreen, resultScreen];

const render = () => {
  app.innerHTML = screens[screen]();
  document.title = `${["학원 선택", "강사 입찰", "반 편성", "학기 정산"][screen]} · 학원 타이쿤`;
};

app.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("button");

  if (!button) return;

  if (button.dataset.teacher) {
    selectedTeacherId = button.dataset.teacher;
    render();
    return;
  }

  if (button.dataset.screen) {
    screen = Number(button.dataset.screen);
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

app.addEventListener("submit", (event) => {
  if (!(event.target instanceof HTMLFormElement) || !event.target.matches("[data-bid-form]")) return;
  event.preventDefault();
  screen = 2;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

render();
